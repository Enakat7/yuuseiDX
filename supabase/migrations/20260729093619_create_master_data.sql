-- マスタ管理（ドライバー／単価／配送種別）のスキーマ。要件6.7・6.8参照。

-- ===== エリア（要件6.7で確定した7エリア） =====
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.areas enable row level security;

create trigger areas_set_updated_at
  before update on public.areas
  for each row execute procedure public.set_updated_at();

create trigger areas_audit
  after insert or update or delete on public.areas
  for each row execute procedure public.audit_trigger();

create policy "areas_staff_or_admin_all"
  on public.areas for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

insert into public.areas (name, sort_order) values
  ('西', 1), ('安佐南', 2), ('中央(中区)', 3), ('中央(東区)', 4),
  ('府中', 5), ('伴', 6), ('宇品', 7);

-- ===== 地区（エリア配下。マスタ管理画面としては未定のため、ドライバー登録時に
-- その場で追加する運用を想定し、初期データは投入しない） =====
create table public.districts (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (area_id, name)
);

alter table public.districts enable row level security;

create trigger districts_set_updated_at
  before update on public.districts
  for each row execute procedure public.set_updated_at();

create trigger districts_audit
  after insert or update or delete on public.districts
  for each row execute procedure public.audit_trigger();

create policy "districts_staff_or_admin_all"
  on public.districts for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- ===== 配送種別マスタ（要件6.7で確定した8種。うち単価マスタ対象は6種） =====
create table public.delivery_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_master_target boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_types enable row level security;

create trigger delivery_types_set_updated_at
  before update on public.delivery_types
  for each row execute procedure public.set_updated_at();

create trigger delivery_types_audit
  after insert or update or delete on public.delivery_types
  for each row execute procedure public.audit_trigger();

create policy "delivery_types_staff_or_admin_all"
  on public.delivery_types for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

insert into public.delivery_types (code, name, price_master_target, sort_order) values
  ('D01', '配達完了①', true, 1),
  ('D02', '配達完了②', false, 2),
  ('M01', '転居大口等①', true, 3),
  ('M02', '転居大口等②', false, 4),
  ('N01', '夜間配送', true, 5),
  ('L01', '大配送', true, 6),
  ('P01', '集荷①', true, 7),
  ('P02', '集荷②', true, 8);

-- ===== 件数集計の区分（要件6.3で確定した10区分）。配送種別マスタの8種に対応するものは
-- delivery_type_idで紐づけ、ゆうパケット・不在個数は配送種別マスタに含まれない
-- （単価非設定・集計のみ）ためnullとする。 =====
create table public.count_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  delivery_type_id uuid references public.delivery_types (id),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.count_categories enable row level security;

create trigger count_categories_set_updated_at
  before update on public.count_categories
  for each row execute procedure public.set_updated_at();

create trigger count_categories_audit
  after insert or update or delete on public.count_categories
  for each row execute procedure public.audit_trigger();

create policy "count_categories_staff_or_admin_all"
  on public.count_categories for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

insert into public.count_categories (label, delivery_type_id, sort_order)
select dt.name, dt.id, dt.sort_order from public.delivery_types dt
union all
select 'ゆうパケット', null, 9
union all
select '不在個数', null, 10;

-- ===== 書類種類マスタ（要件6.8で確定した8種＋追加可能） =====
create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_expiring boolean not null default false,
  is_system boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_types enable row level security;

create trigger document_types_set_updated_at
  before update on public.document_types
  for each row execute procedure public.set_updated_at();

create trigger document_types_audit
  after insert or update or delete on public.document_types
  for each row execute procedure public.audit_trigger();

create policy "document_types_staff_or_admin_all"
  on public.document_types for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

insert into public.document_types (label, is_expiring, sort_order) values
  ('免許証', true, 1),
  ('車検証', true, 2),
  ('任意保険証', true, 3),
  ('自賠責保険証', true, 4),
  ('インボイス申請書', false, 5),
  ('業務委託契約書', false, 6),
  ('履歴書', false, 7),
  ('貨物軽自動車運送事業経営届出書', false, 8);

-- ===== ドライバーマスタ（要件6.7） =====
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  -- ログインアカウントを持たないドライバーも存在しうるためnullable
  profile_id uuid unique references public.profiles (id) on delete set null,
  name text not null,
  contract_type text not null check (contract_type in ('個人事業主', '法人')),
  area_id uuid not null references public.areas (id),
  contract_start_date date not null,
  phone text,
  email text,
  pay_type text not null check (pay_type in ('週払い', '月払い')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drivers enable row level security;

create trigger drivers_set_updated_at
  before update on public.drivers
  for each row execute procedure public.set_updated_at();

create trigger drivers_audit
  after insert or update or delete on public.drivers
  for each row execute procedure public.audit_trigger();

create policy "drivers_staff_or_admin_all"
  on public.drivers for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- Phase 2で用意予定だったが、drivers作成後でないと定義できないためここで作成する
create function public.current_driver_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.drivers where profile_id = auth.uid();
$$;

-- ドライバー本人は自分の行のみ閲覧可（マイページ実装時に使用。詳細は6.7・1.3参照）
create policy "drivers_select_own"
  on public.drivers for select
  to authenticated
  using (id = public.current_driver_id());

-- ===== ドライバー×地区（1エリア内で複数地区を掛け持つ業務ルールに対応する中間テーブル） =====
create table public.driver_districts (
  driver_id uuid not null references public.drivers (id) on delete cascade,
  district_id uuid not null references public.districts (id) on delete cascade,
  primary key (driver_id, district_id)
);

alter table public.driver_districts enable row level security;

create trigger driver_districts_audit
  after insert or update or delete on public.driver_districts
  for each row execute procedure public.audit_trigger();

create policy "driver_districts_staff_or_admin_all"
  on public.driver_districts for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

create policy "driver_districts_select_own"
  on public.driver_districts for select
  to authenticated
  using (driver_id = public.current_driver_id());

-- ===== ドライバー保管書類（要件6.8。ドライバー本人は閲覧不可、
-- ファイルはSupabase Storageの非公開バケットに保存し署名付きURL経由でのみ閲覧させる） =====
create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  document_type_id uuid not null references public.document_types (id),
  storage_path text not null,
  original_filename text not null,
  expires_on date,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, document_type_id)
);

alter table public.driver_documents enable row level security;

create trigger driver_documents_set_updated_at
  before update on public.driver_documents
  for each row execute procedure public.set_updated_at();

create trigger driver_documents_audit
  after insert or update or delete on public.driver_documents
  for each row execute procedure public.audit_trigger();

-- ドライバー本人向けのselectポリシーは意図的に定義しない（要件6.8：本人は閲覧不可）
create policy "driver_documents_staff_or_admin_all"
  on public.driver_documents for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- ===== 単価マスタ（受注単価／卸単価。要件6.7、適用開始日による追記型バージョン管理） =====
create table public.unit_prices (
  id uuid primary key default gen_random_uuid(),
  price_kind text not null check (price_kind in ('受注単価', '卸単価')),
  area_id uuid not null references public.areas (id),
  delivery_type_id uuid not null references public.delivery_types (id),
  effective_from date not null,
  price_yen integer not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (price_kind, area_id, delivery_type_id, effective_from)
);

alter table public.unit_prices enable row level security;

create trigger unit_prices_audit
  after insert or update or delete on public.unit_prices
  for each row execute procedure public.audit_trigger();

create policy "unit_prices_staff_or_admin_all"
  on public.unit_prices for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- ===== ドライバー書類の保管用ストレージバケット（非公開、署名付きURL経由のみ閲覧可） =====
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;

create policy "driver_documents_bucket_staff_or_admin"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'driver-documents' and public.is_staff_or_admin())
  with check (bucket_id = 'driver-documents' and public.is_staff_or_admin());
