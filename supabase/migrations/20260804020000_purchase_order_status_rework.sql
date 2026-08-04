-- 発注書(稼働表)のステータス運用を「未送信/送信済/要再送信」から
-- 「未作成/作成中/作成済」の3状態へ変更する。稼働カレンダーモーダルの
-- 「確定」操作で作成済に、確定せず閉じた場合は作成中に戻す運用に合わせる。
-- 送信(一括送信)は作成済の発注書に対して行い、送信によってstatus自体は変更しない
-- （sent_atで送信済かどうかを判定する）。

alter table public.purchase_orders drop constraint purchase_orders_status_check;

update public.purchase_orders
set status = case status
  when '未送信' then '未作成'
  when '送信済' then '作成済'
  when '要再送信' then '作成中'
  else status
end;

alter table public.purchase_orders alter column status set default '未作成';

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status in ('未作成', '作成中', '作成済'));

-- 稼働内容が変更された日が、既に作成済の発注書の対象期間に含まれる場合は
-- 「作成中」に自動的に戻す（再確定が必要なことを示す）。
create or replace function public.flag_purchase_order_reissue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.purchase_orders
  set status = '作成中', driver_approved_at = null, driver_approved_ip = null
  where driver_id = new.driver_id
    and status = '作成済'
    and new.work_date between period_start and period_end;
  return new;
end;
$$;
