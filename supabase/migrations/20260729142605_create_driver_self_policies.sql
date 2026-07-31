-- ドライバー側 /mypage 実装（Phase D）。ドライバー本人が自分のデータのみ閲覧できるよう
-- 既存テーブルにselectポリシーを追加する。driver_documents・count_entries・
-- deduction_amounts・advance_requestsには要件1.3・6.8により引き続きポリシーを追加しない。

-- 支払通知書は仮確定・確定のみ閲覧可（未承認の段階はドライバーに見せない、要件6.2）
create policy "payment_notices_select_own"
  on public.payment_notices for select
  to authenticated
  using (driver_id = public.current_driver_id() and status <> '未承認');

-- 親payment_noticesが自分のものであることをEXISTSで確認して閲覧許可
create policy "payment_notice_items_select_own"
  on public.payment_notice_items for select
  to authenticated
  using (
    exists (
      select 1 from public.payment_notices pn
      where pn.id = payment_notice_id
        and pn.driver_id = public.current_driver_id()
        and pn.status <> '未承認'
    )
  );

create policy "purchase_orders_select_own"
  on public.purchase_orders for select
  to authenticated
  using (driver_id = public.current_driver_id());

create policy "work_schedule_days_select_own"
  on public.work_schedule_days for select
  to authenticated
  using (driver_id = public.current_driver_id());

-- ホーム画面の前払可能額表示用。deduction_amounts・deduction_itemsにはRLSポリシーを
-- 追加しない方針のため、本人分の計算結果のみをSECURITY DEFINERで返す狭い窓口を用意する
-- （acknowledge_payment_noticeと同様、引数のdriver_idは信用せずcurrent_driver_id()から導出する）。
create function public.driver_available_advance(p_period_month date)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_driver_id uuid;
  v_earnings numeric;
  v_deductions numeric;
begin
  v_driver_id := public.current_driver_id();
  if v_driver_id is null then
    raise exception 'driver_available_advance: not a driver session';
  end if;

  v_earnings := public.driver_earnings(v_driver_id, p_period_month, (p_period_month + interval '1 month - 1 day')::date);

  select coalesce(sum(da.amount), 0) into v_deductions
  from public.deduction_amounts da
  join public.deduction_items di on di.id = da.deduction_item_id
  where di.driver_id = v_driver_id
    and di.active = true
    and da.period_month = p_period_month;

  return v_earnings - v_deductions;
end;
$$;
