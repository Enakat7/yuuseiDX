-- 件数集計（要件6.3）。日報機能はなく、専用画面から管理者/スタッフが直接入力する。
create table public.count_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  category_id uuid not null references public.count_categories (id),
  work_date date not null,
  count integer not null default 0,
  entered_by uuid references public.profiles (id),
  approved boolean not null default false,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, category_id, work_date)
);

-- 月間40万件規模を想定した検索用インデックス
create index count_entries_work_date_idx on public.count_entries (work_date);
create index count_entries_driver_work_date_idx on public.count_entries (driver_id, work_date);
create index count_entries_pending_idx on public.count_entries (work_date) where not approved;

alter table public.count_entries enable row level security;

create trigger count_entries_set_updated_at
  before update on public.count_entries
  for each row execute procedure public.set_updated_at();

create trigger count_entries_audit
  after insert or update or delete on public.count_entries
  for each row execute procedure public.audit_trigger();

-- ドライバーはアクセス不可（要件1.3で確定：マイページと下請法関連リンクのみ）
create policy "count_entries_staff_or_admin_all"
  on public.count_entries for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
