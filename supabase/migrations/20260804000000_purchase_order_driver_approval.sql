-- ドライバーマイページの発注書タブに「承認」操作を追加する。
-- ドライバーが発注書（稼働表）の内容を確認したことを示す承認済/未承認の状態を、
-- 発行フロー用のstatus（未送信/送信済/要再送信）とは別カラムで管理する。
alter table public.purchase_orders
  add column driver_approved_at timestamptz,
  add column driver_approved_ip text;

-- ドライバー本人の発注書のみ承認可能なSECURITY DEFINER RPC
-- （acknowledge_payment_noticeと同様、引数のorder_idは信用せずcurrent_driver_id()で所有者確認する）。
create function public.approve_purchase_order(p_order_id uuid, p_ip text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
begin
  v_driver_id := public.current_driver_id();
  if v_driver_id is null then
    raise exception 'approve_purchase_order: not a driver session';
  end if;

  update public.purchase_orders
  set driver_approved_at = now(), driver_approved_ip = p_ip
  where id = p_order_id and driver_id = v_driver_id;

  if not found then
    raise exception 'approve_purchase_order: order not found or not owned by driver';
  end if;
end;
$$;

-- 稼働内容の変更で「要再送信」に戻る場合は、ドライバーの承認も無効化する
-- （承認後に内容が変わった発注書を承認済のままにしないため）。
create or replace function public.flag_purchase_order_reissue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.purchase_orders
  set status = '要再送信', driver_approved_at = null, driver_approved_ip = null
  where driver_id = new.driver_id
    and status = '送信済'
    and new.work_date between period_start and period_end;
  return new;
end;
$$;
