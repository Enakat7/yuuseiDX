-- ドライバー本人の発注書のみ修正依頼可能なSECURITY DEFINER RPC。
-- 承認とは逆に、稼働表の内容修正が必要なことをスタッフ側（作成中扱い）に戻して示す
-- （approve_purchase_orderと同様、引数のorder_idは信用せずcurrent_driver_id()で所有者確認する）。
create function public.request_purchase_order_correction(p_order_id uuid)
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
    raise exception 'request_purchase_order_correction: not a driver session';
  end if;

  update public.purchase_orders
  set status = '作成中', driver_approved_at = null, driver_approved_ip = null
  where id = p_order_id and driver_id = v_driver_id;

  if not found then
    raise exception 'request_purchase_order_correction: order not found or not owned by driver';
  end if;
end;
$$;
