-- 支払通知書（要件6.2）。
-- 生成フロー: 件数集計で承認済みのcount_entriesから金額を算出して未承認の通知書を生成
-- （POST /api/payments/generate）→ スタッフが個別/一括承認して仮確定（ドライバーに開示）
-- → 局・NC突合後に確定。確定後の修正はpayment_notice_revisionsに記録し再承認が必要。

-- 件数×卸単価でドライバーの売上を算出する共通関数（前払依頼書のシミュレーションと共有）。
-- 単価は対象日時点で有効な最新の適用開始日のものを使う。ゆうパケット・不在個数など
-- delivery_type_idを持たない区分（=配送種別マスタ非対象、単価未設定）は金額計算に含めない。
create function public.driver_earnings(p_driver_id uuid, p_date_from date, p_date_to date)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(ce.count * up.price_yen), 0)
  from public.count_entries ce
  join public.count_categories cc on cc.id = ce.category_id
  join public.drivers d on d.id = ce.driver_id
  join public.unit_prices up on up.delivery_type_id = cc.delivery_type_id
    and up.area_id = d.area_id
    and up.price_kind = '卸単価'
    and up.effective_from = (
      select max(up2.effective_from)
      from public.unit_prices up2
      where up2.delivery_type_id = cc.delivery_type_id
        and up2.area_id = d.area_id
        and up2.price_kind = '卸単価'
        and up2.effective_from <= ce.work_date
    )
  where ce.driver_id = p_driver_id
    and ce.work_date between p_date_from and p_date_to
    and ce.approved = true
    and cc.delivery_type_id is not null;
$$;

create table public.payment_notices (
  id uuid primary key default gen_random_uuid(),
  notice_no text not null unique,
  driver_id uuid not null references public.drivers (id),
  area_id uuid references public.areas (id),
  pay_type text not null check (pay_type in ('週払い', '月払い')),
  period_start date not null,
  period_end date not null,
  amount integer not null default 0,
  status text not null default '未承認' check (status in ('未承認', '仮確定', '確定')),
  remarks text,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id),
  driver_acknowledged_at timestamptz,
  driver_acknowledged_ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, period_start, period_end, pay_type)
);

alter table public.payment_notices enable row level security;

create trigger payment_notices_set_updated_at
  before update on public.payment_notices
  for each row execute procedure public.set_updated_at();

create trigger payment_notices_audit
  after insert or update or delete on public.payment_notices
  for each row execute procedure public.audit_trigger();

create policy "payment_notices_staff_or_admin_all"
  on public.payment_notices for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- ドライバー本人の閲覧ポリシーは意図的に定義しない（マイページ実装は対象外。
-- 仮確定・確定後にドライバーへ公開する要件〔6.2〕は、マイページ実装時にselectポリシーを追加する）

create table public.payment_notice_items (
  id uuid primary key default gen_random_uuid(),
  payment_notice_id uuid not null references public.payment_notices (id) on delete cascade,
  category_id uuid not null references public.count_categories (id),
  count integer not null default 0,
  unit_price_snapshot integer not null default 0,
  amount integer not null default 0
);

alter table public.payment_notice_items enable row level security;

create trigger payment_notice_items_audit
  after insert or update or delete on public.payment_notice_items
  for each row execute procedure public.audit_trigger();

create policy "payment_notice_items_staff_or_admin_all"
  on public.payment_notice_items for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- 確定後の修正履歴。修正が入った場合は再承認フローが必要（クライアント確認済み）。
create table public.payment_notice_revisions (
  id uuid primary key default gen_random_uuid(),
  payment_notice_id uuid not null references public.payment_notices (id) on delete cascade,
  revised_at timestamptz not null default now(),
  revised_by uuid references public.profiles (id),
  diff_summary text,
  previous_amount integer not null,
  new_amount integer not null
);

alter table public.payment_notice_revisions enable row level security;

create policy "payment_notice_revisions_staff_or_admin_all"
  on public.payment_notice_revisions for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- 明示義務対応のメール送付履歴（閲覧用リンクのみ、PDF添付なし。要件6.2・7.3）
create table public.payment_notice_email_sends (
  id uuid primary key default gen_random_uuid(),
  payment_notice_id uuid not null references public.payment_notices (id) on delete cascade,
  sent_to text not null,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles (id)
);

alter table public.payment_notice_email_sends enable row level security;

create policy "payment_notice_email_sends_staff_or_admin_all"
  on public.payment_notice_email_sends for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- ドライバー側の「承認」ボタン（明示義務対応、6.2参照）用のRPC。マイページ実装は対象外だが、
-- 将来の実装に備えてSECURITY DEFINERで用意しておく。ドライバーは自分の通知書のみ操作可能。
create function public.acknowledge_payment_notice(p_notice_id uuid, p_ip text default null)
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
    raise exception 'acknowledge_payment_notice: not a driver session';
  end if;

  update public.payment_notices
  set driver_acknowledged_at = now(), driver_acknowledged_ip = p_ip
  where id = p_notice_id and driver_id = v_driver_id;

  if not found then
    raise exception 'acknowledge_payment_notice: notice not found or not owned by driver';
  end if;
end;
$$;
