-- 管理費集計（要件6.4・6.5）。控除予定額はドライバーごとにカスタマイズ可能で、
-- 前払依頼書の前払可能額計算に使用する。

-- 控除項目のデフォルト一覧（7項目、クライアント確認済み）
create table public.deduction_item_defaults (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  sort_order int not null default 0
);

alter table public.deduction_item_defaults enable row level security;

create policy "deduction_item_defaults_staff_or_admin_all"
  on public.deduction_item_defaults for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

insert into public.deduction_item_defaults (label, sort_order) values
  ('大野ガソリン', 1),
  ('イチネンガソリン', 2),
  ('車両修理費', 3),
  ('リース料', 4),
  ('貸借料', 5),
  ('自動車税', 6),
  ('スタッフ貸出料', 7);

-- ドライバーごとの控除項目（ドライバー作成時にdeduction_item_defaultsからクローンし、
-- 個別に追加・無効化できるようにする）
create table public.deduction_items (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.deduction_items enable row level security;

create trigger deduction_items_audit
  after insert or update or delete on public.deduction_items
  for each row execute procedure public.audit_trigger();

create policy "deduction_items_staff_or_admin_all"
  on public.deduction_items for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- 月次の控除金額
create table public.deduction_amounts (
  id uuid primary key default gen_random_uuid(),
  deduction_item_id uuid not null references public.deduction_items (id) on delete cascade,
  period_month date not null,
  amount integer not null default 0,
  entered_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deduction_item_id, period_month)
);

create index deduction_amounts_period_month_idx on public.deduction_amounts (period_month);

alter table public.deduction_amounts enable row level security;

create trigger deduction_amounts_set_updated_at
  before update on public.deduction_amounts
  for each row execute procedure public.set_updated_at();

create trigger deduction_amounts_audit
  after insert or update or delete on public.deduction_amounts
  for each row execute procedure public.audit_trigger();

create policy "deduction_amounts_staff_or_admin_all"
  on public.deduction_amounts for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
