-- ============================================================
-- 元ファイル: 20260727093922_create_profiles.sql
-- ============================================================
-- ユーザーロール（管理者／スタッフ／ドライバー）
create type public.user_role as enum ('管理者', 'スタッフ', 'ドライバー');

-- auth.users に 1:1 で紐づくプロフィール（表示名・権限を保持）
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role public.user_role not null default 'スタッフ',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- RLSの自己参照ポリシーが無限再帰しないよう、権限判定はSECURITY DEFINER関数で行う
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = '管理者'
  );
$$;

-- 本人の行、または管理者は全行を参照可能
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

-- 更新は本人または管理者のみ（role の書き換えはトリガーで別途制限する）
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- insert/delete のポリシーは意図的に定義しない（RLSはデフォルト拒否）。
-- 行の作成は下記トリガー（SECURITY DEFINER）経由のみに限定し、
-- クライアントから直接プロフィールを作成・削除できないようにする。

-- 管理者以外による role の書き換え（権限昇格）を拒否する
create function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'insufficient_privilege: role change requires admin';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_role_escalation();

-- auth.users 作成時にプロフィールを自動生成する。
-- 最初に作成されたアカウントのみ管理者権限を付与する（要件1.3）。
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    case when (select count(*) from public.profiles) = 0 then '管理者' else 'スタッフ' end::public.user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 元ファイル: 20260729092149_create_permissions_and_logs.sql
-- ============================================================
-- 管理者に加えて「管理者またはスタッフ」を判定するヘルパー（is_adminと同じ再帰回避のためSECURITY DEFINER）
create function public.is_staff_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('管理者', 'スタッフ')
  );
$$;

-- 以後のテーブルで共通して使うupdated_at自動更新トリガー
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- アカウント（オペレーション担当者）ごとのページ単位アクセス設定。
-- 管理者/スタッフの業務範囲の差異は未確定のため（question.md参照）、RLSはいったん
-- 管理者・スタッフ同等の権限とし、実際のページ制限はこのテーブル＋アプリ側（proxy.ts等）
-- で段階的に絞る。行が存在しない場合はcan_access=trueとみなす（既定はアクセス許可、
-- 管理者が明示的に制限した場合のみ行を作成/更新する運用）。
-- page_keyはDB enumにせず、lib/pages.tsのOPERATION_PAGE_KEYSをアプリ側の正とする
-- （ページ追加時にマイグレーション不要にするため）。
create table public.operation_page_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  page_key text not null,
  can_access boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, page_key)
);

alter table public.operation_page_permissions enable row level security;

create trigger operation_page_permissions_set_updated_at
  before update on public.operation_page_permissions
  for each row execute procedure public.set_updated_at();

-- 本人の設定行は本人も閲覧可（自分がどのページにアクセスできるか確認できるように）、
-- 全件の閲覧・書き込みは管理者のみ
create policy "page_permissions_select_own_or_admin"
  on public.operation_page_permissions for select
  to authenticated
  using (auth.uid() = profile_id or public.is_admin());

create policy "page_permissions_insert_admin"
  on public.operation_page_permissions for insert
  to authenticated
  with check (public.is_admin());

create policy "page_permissions_update_admin"
  on public.operation_page_permissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "page_permissions_delete_admin"
  on public.operation_page_permissions for delete
  to authenticated
  using (public.is_admin());

-- 操作ログ（要件6.9）。誰がいつ何を操作したかを記録し、ログ画面でリアルタイムに表示する。
create table public.operation_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role public.user_role not null,
  actor_name text not null,
  screen_name text not null,
  action text not null,
  params jsonb not null default '{}'::jsonb,
  target_table text,
  target_id text,
  -- 'app'   = API Route等からlog_operation()を明示的に呼んで記録
  -- 'trigger' = audit_trigger()による自動記録（呼び出し漏れのバックストップ）
  source text not null check (source in ('app', 'trigger')),
  created_at timestamptz not null default now()
);

create index operation_logs_created_at_idx on public.operation_logs (created_at desc);

alter table public.operation_logs enable row level security;

-- スタッフへの公開可否は未確定（question.md参照）。現状は管理者限定。
create policy "operation_logs_select_admin"
  on public.operation_logs for select
  to authenticated
  using (public.is_admin());

-- insert/update/deleteのポリシーは意図的に定義しない。書き込みはlog_operation()／
-- audit_trigger()（いずれもSECURITY DEFINER）経由のみに限定し、クライアントから
-- 直接ログを書き換え・削除できないようにする。

-- API Route等の更新系処理から明示的に呼び出し、要件6.9の
-- 「権限名：氏名 - 画面名(パラメータ1,パラメータ2,...)」形式の元になる可読ログを記録する。
create function public.log_operation(
  p_action text,
  p_screen_name text,
  p_params jsonb default '{}'::jsonb,
  p_target_table text default null,
  p_target_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null then
    raise exception 'log_operation: no authenticated profile found';
  end if;

  insert into public.operation_logs (
    actor_id, actor_role, actor_name, screen_name, action, params, target_table, target_id, source
  ) values (
    v_actor.id, v_actor.role, v_actor.name, p_screen_name, p_action, p_params, p_target_table, p_target_id, 'app'
  );
end;
$$;

-- 汎用の監査トリガー。Phase 3以降で作成する各業務テーブルに
-- 「after insert or update or delete ... execute procedure public.audit_trigger()」として
-- 最初から付与し、log_operation()呼び出し漏れのバックストップとする。
create function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
  v_row jsonb;
begin
  select * into v_actor from public.profiles where id = auth.uid();

  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  insert into public.operation_logs (
    actor_id, actor_role, actor_name, screen_name, action, params, target_table, target_id, source
  ) values (
    v_actor.id,
    -- 認証セッションに紐づくprofileが見つからない場合（service_role経由の変更など）は
    -- 記録自体は残しつつ、非nullのroleが必須のため便宜上「スタッフ」を既定値とする。
    coalesce(v_actor.role, 'スタッフ'),
    coalesce(v_actor.name, 'system'),
    tg_table_name,
    tg_op,
    v_row,
    tg_table_name,
    v_row ->> 'id',
    'trigger'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ログ画面（管理者限定）のリアルタイム購読対象に追加
alter publication supabase_realtime add table public.operation_logs;


-- ============================================================
-- 元ファイル: 20260729093619_create_master_data.sql
-- ============================================================
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

create policy "areas_staff_or_admin_all"
  on public.areas for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- 監査トリガーは初期データ投入後に作成する。投入時点では認証セッションがなく
-- audit_trigger()内のactor解決がフォールバック（'スタッフ'/'system'）になるため、
-- 実在しない操作者のログが記録されるのを避ける。
insert into public.areas (name, sort_order) values
  ('西', 1), ('安佐南', 2), ('中央(中区)', 3), ('中央(東区)', 4),
  ('府中', 5), ('伴', 6), ('宇品', 7);

create trigger areas_audit
  after insert or update or delete on public.areas
  for each row execute procedure public.audit_trigger();

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
  ('P02', '集荷②', true, 8),
  ('U01', '不在個数', false, 9),
  ('Y01', 'ゆうパケット', false, 10);

create trigger delivery_types_audit
  after insert or update or delete on public.delivery_types
  for each row execute procedure public.audit_trigger();

-- ===== 件数集計の区分（要件6.3で確定した10区分）。配送種別マスタの全10種に
-- delivery_type_idで紐づける（うち不在個数・ゆうパケットは単価非設定・集計のみ）。 =====
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

create policy "count_categories_staff_or_admin_all"
  on public.count_categories for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

insert into public.count_categories (label, delivery_type_id, sort_order)
select dt.name, dt.id, dt.sort_order from public.delivery_types dt;

create trigger count_categories_audit
  after insert or update or delete on public.count_categories
  for each row execute procedure public.audit_trigger();

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

create trigger document_types_audit
  after insert or update or delete on public.document_types
  for each row execute procedure public.audit_trigger();

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
  price_yen numeric(10, 2) not null,
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


-- ============================================================
-- 元ファイル: 20260729120636_create_count_entries.sql
-- ============================================================
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


-- ============================================================
-- 元ファイル: 20260729123514_create_deduction_tables.sql
-- ============================================================
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


-- ============================================================
-- 元ファイル: 20260729124614_create_payment_notices.sql
-- ============================================================
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


-- ============================================================
-- 元ファイル: 20260729131041_create_advance_requests.sql
-- ============================================================
-- 前払依頼書（要件6.5・6.6）。承認フローは設けない（確定要件）。
-- 前払可能額 = 現時点までの売上（driver_earnings） − 当月の控除予定額（deduction_amounts）。
-- 前払可能額を上回る申請は「超過（要確認）」として識別する。マイナスでも前払い実行を許容する。
create table public.advance_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  driver_id uuid not null references public.drivers (id),
  payout_date date not null,
  amount integer not null,
  available_amount_snapshot integer not null,
  status text not null default '申請中' check (status in ('申請中', '超過（要確認）', '実行済')),
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.advance_requests enable row level security;

create trigger advance_requests_set_updated_at
  before update on public.advance_requests
  for each row execute procedure public.set_updated_at();

create trigger advance_requests_audit
  after insert or update or delete on public.advance_requests
  for each row execute procedure public.audit_trigger();

-- ドライバーはアクセス不可（要件1.3で確定：マイページと下請法関連リンクのみ。
-- 前払依頼書自体はオペレーション側の帳票のため対象外）
create policy "advance_requests_staff_or_admin_all"
  on public.advance_requests for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());


-- ============================================================
-- 元ファイル: 20260803010000_delivery_districts.sql
-- ============================================================
-- ===== 配達地区マスタ（エリアごとの配達コース区分。稼働カレンダー等で日別の担当地区を
-- 色分け表示するために使用する。コード・背景色はクライアント側で自由に割り振ってよいため、
-- 初期データは doxs/配達地区.md の内容をそのまま投入する。
-- 「共通」（休・希休等、特定のエリアに属さない区分）はarea_id nullで表現する。 =====
create table public.delivery_districts (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references public.areas (id) on delete cascade,
  code text not null unique,
  name text not null,
  background_color text not null default '#ffffff' check (background_color ~* '^#[0-9a-f]{6}$'),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_districts enable row level security;

create trigger delivery_districts_set_updated_at
  before update on public.delivery_districts
  for each row execute procedure public.set_updated_at();

create policy "delivery_districts_staff_or_admin_all"
  on public.delivery_districts for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- ドライバーマイページの稼働カレンダーで配達地区コード・色を表示するため、
-- 配達地区マスタ（コード・名称・色のみで機微情報を含まない）の閲覧を
-- 認証済み全ユーザーに許可する（更新系は引き続きスタッフ/管理者限定）。
create policy "delivery_districts_select_authenticated"
  on public.delivery_districts for select
  to authenticated
  using (active = true);

insert into public.delivery_districts (area_id, code, name, background_color, sort_order) values
  ((select id from public.areas where name = '宇品'), 'U01', '丹那一円・楠那・黄金山・本浦一円・東雲本町3', '#ffffff', 1),
  ((select id from public.areas where name = '宇品'), 'U02', '仁保一円・日宇那', '#ffffff', 2),
  ((select id from public.areas where name = '宇品'), 'U03', '東西霞・旭・山城・南北大河', '#ffffff', 3),
  ((select id from public.areas where name = '宇品'), 'U04', '東雲一円', '#ffffff', 4),
  ((select id from public.areas where name = '宇品'), 'U05', '翠・西旭・出汐2.3', '#ffffff', 5),
  ((select id from public.areas where name = '宇品'), 'U06', '大洲・南蟹屋・西蟹屋3.4', '#ffffff', 6),
  ((select id from public.areas where name = '宇品'), 'U07', '段原・段原日出・段原山崎', '#ffffff', 7),
  ((select id from public.areas where name = '宇品'), 'U08', '比治山本町・段原南・出汐1.4', '#ffffff', 8),
  ((select id from public.areas where name = '宇品'), 'U09', '荒神一円・比治山・的場・松川・西蟹屋1.2', '#ffffff', 9),
  ((select id from public.areas where name = '宇品'), 'U10', '荒神一円・比治山・的場・松川・西蟹屋1.2・霞', '#ffffff', 10),
  ((select id from public.areas where name = '宇品'), 'U11', '荒神一円・比治山・的場・松川・西蟹屋1.2・段原2', '#ffffff', 11),
  ((select id from public.areas where name = '宇品'), 'U12', '霞一円・旭・山城・南北大河', '#ffffff', 12),
  ((select id from public.areas where name = '宇品'), 'U13', '出汐・翠・西旭', '#ffffff', 13),
  ((select id from public.areas where name = '宇品'), 'U14', '大洲・南蟹屋・西蟹屋・荒神', '#ffffff', 14),
  ((select id from public.areas where name = '宇品'), 'U15', '段原・段原日出・段原山崎・段原南2', '#ffffff', 15),
  ((select id from public.areas where name = '宇品'), 'U16', '比治山本町・段原南1・比治山町・的場町・松川町', '#ffffff', 16),
  ((select id from public.areas where name = '宇品'), 'U17', '霞・東雲本町1・2', '#ffffff', 17),
  ((select id from public.areas where name = '宇品'), 'U18', '府中郵便局シフト確認', '#f5aa5f', 18),

  ((select id from public.areas where name = '安佐南'), 'A01', '西原1-4', '#ffffff', 19),
  ((select id from public.areas where name = '安佐南'), 'A02', '西原5.6.8.9', '#ffffff', 20),
  ((select id from public.areas where name = '安佐南'), 'A03', '中須・古市1-3', '#ffffff', 21),
  ((select id from public.areas where name = '安佐南'), 'A04', '八木', '#ffffff', 22),
  ((select id from public.areas where name = '安佐南'), 'A05', '緑井1.3.4.7.8', '#ffffff', 23),
  ((select id from public.areas where name = '安佐南'), 'A06', '祇園1-3', '#ffffff', 24),
  ((select id from public.areas where name = '安佐南'), 'A07', '祇園4-8・古市4', '#ffffff', 25),
  ((select id from public.areas where name = '安佐南'), 'A08', '東原・西原7', '#ffffff', 26),
  ((select id from public.areas where name = '安佐南'), 'A09', '西原1-4.5.6', '#ffffff', 27),
  ((select id from public.areas where name = '安佐南'), 'A10', '東原・西原8.9', '#ffffff', 28),
  ((select id from public.areas where name = '安佐南'), 'A11', '府中郵便局シフト確認', '#f5aa5f', 29),

  ((select id from public.areas where name = '西'), 'N01', '新庄町/三滝本町/山手町/三滝山/己斐東1・2丁目/竜王町', '#ffffff', 30),
  ((select id from public.areas where name = '西'), 'N02', '己斐上1・3・4・5・6丁目/己斐大迫', '#ffffff', 31),
  ((select id from public.areas where name = '西'), 'N03', '己斐中1丁目/己斐西/己斐本町', '#ffffff', 32),
  ((select id from public.areas where name = '西'), 'N04', '己斐中2・3丁目/己斐上2丁目/高須3・4丁目/高須台', '#ffffff', 33),
  ((select id from public.areas where name = '西'), 'N05', '古江西町/古江東町/高須1・2丁目/古江上', '#ffffff', 34),
  ((select id from public.areas where name = '西'), 'N06', '庚午南1・2丁目/草津東1・2丁目/古江新町/庚午中2・3丁目/庚午北2・3丁目', '#ffffff', 35),
  ((select id from public.areas where name = '西'), 'N07', '庚午北1・4丁目/庚午中1・4丁目', '#ffffff', 36),
  ((select id from public.areas where name = '西'), 'N08', 'bコース', '#ffffff', 37),
  ((select id from public.areas where name = '西'), 'N09', '己斐大迫/竜王', '#ffffff', 38),

  ((select id from public.areas where name = '中央(中区)'), 'C01', '千田1-3丁目/南千田/大手町5丁目', '#ffffff', 39),
  ((select id from public.areas where name = '中央(中区)'), 'C02', '東白島/白島九軒/白島中町', '#ffffff', 40),
  ((select id from public.areas where name = '中央(中区)'), 'C03', '大手町1-4丁目', '#ffffff', 41),
  ((select id from public.areas where name = '中央(中区)'), 'C04', '堺/榎町/猫屋/小網', '#ffffff', 42),
  ((select id from public.areas where name = '中央(中区)'), 'C05', '十日市/本川/寺町', '#ffffff', 43),
  ((select id from public.areas where name = '中央(中区)'), 'C06', '広瀬/広瀬北/西十日市', '#ffffff', 44),
  ((select id from public.areas where name = '中央(中区)'), 'C07', '白島北/基町/西白島', '#ffffff', 45),
  ((select id from public.areas where name = '中央(中区)'), 'C08', '上八丁堀', '#ffffff', 46),
  ((select id from public.areas where name = '中央(中区)'), 'C09', '三川/胡/堀川/新天地', '#ffffff', 47),
  ((select id from public.areas where name = '中央(中区)'), 'C10', '光南/吉島', '#ffffff', 48),
  ((select id from public.areas where name = '中央(中区)'), 'C11', '舟入/舟入中/幸/本町一部', '#ffffff', 49),
  ((select id from public.areas where name = '中央(中区)'), 'C12', '舟入川口/西川口/幸/本町一部', '#ffffff', 50),
  ((select id from public.areas where name = '中央(中区)'), 'C13', '東白島/白島九軒/白島中・上八丁堀', '#ffffff', 51),
  ((select id from public.areas where name = '中央(中区)'), 'C14', '東白島/白島九軒/白島中・白島北/西白島', '#ffffff', 52),
  ((select id from public.areas where name = '中央(中区)'), 'C15', '東白島/白島九軒/白島中・上八丁堀/三川/胡/堀川/新天地', '#ffffff', 53),
  ((select id from public.areas where name = '中央(中区)'), 'C16', '大手町1-4丁目・三川/胡/堀川/新天地', '#ffffff', 54),

  ((select id from public.areas where name = '中央(東区)'), 'H01', '牛田新町', '#ffffff', 55),
  ((select id from public.areas where name = '中央(東区)'), 'H02', '牛田本町1.2.3.4・牛田旭・牛田中・牛田早稲田1', '#ffffff', 56),
  ((select id from public.areas where name = '中央(東区)'), 'H03', '牛田早稲田2.3.4・牛田東', '#ffffff', 57),
  ((select id from public.areas where name = '中央(東区)'), 'H04', '牛田本町5.6・牛田南・牛田東1.2の一部', '#ffffff', 58),
  ((select id from public.areas where name = '中央(東区)'), 'H05', '牛田新町・牛田本町5.6', '#ffffff', 59),
  ((select id from public.areas where name = '中央(東区)'), 'H06', '牛田早稲田2.3.4・牛田東・牛田南', '#ffffff', 60),

  ((select id from public.areas where name = '伴'), 'T01', '大塚西', '#ffffff', 61),
  ((select id from public.areas where name = '伴'), 'T02', '伴東', '#ffffff', 62),
  ((select id from public.areas where name = '伴'), 'T03', '伴南、伴西', '#ffffff', 63),

  ((select id from public.areas where name = '府中'), 'F01', '本町・鶴江・山田・瀬戸ハイム・大通（夕方からAコース）', '#ffffff', 64),
  ((select id from public.areas where name = '府中'), 'F02', '青崎東・中・茂陰・鹿籠・桃山・緑ヶ丘', '#ffffff', 65),
  ((select id from public.areas where name = '府中'), 'F03', '八幡・柳ヶ丘・浜田', '#ffffff', 66),

  (null, '休', '休日', '#808080', 67),
  (null, '希休', '希望休', '#e493f5', 68);

create trigger delivery_districts_audit
  after insert or update or delete on public.delivery_districts
  for each row execute procedure public.audit_trigger();

-- ============================================================
-- 元ファイル: 20260729132204_create_schedule_tables.sql
-- ============================================================
-- 発注書(稼働表)（要件6.1）。稼働日は実データ（日単位）で管理する。
-- 発注書は稼働カレンダーの「確定」操作で作成済になり、稼働内容変更後は
-- 自動で「作成中」に戻る（要再確定）。「一括送信」は作成済の発注書に対して行い、
-- 送信によってstatus自体は変更しない（sent_atで送信済かどうかを判定する）。

create table public.work_schedule_days (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  work_date date not null,
  worked boolean not null default false,
  delivery_district_id uuid references public.delivery_districts (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, work_date)
);

create index work_schedule_days_work_date_idx on public.work_schedule_days (work_date);

alter table public.work_schedule_days enable row level security;

create trigger work_schedule_days_set_updated_at
  before update on public.work_schedule_days
  for each row execute procedure public.set_updated_at();

create trigger work_schedule_days_audit
  after insert or update or delete on public.work_schedule_days
  for each row execute procedure public.audit_trigger();

create policy "work_schedule_days_staff_or_admin_all"
  on public.work_schedule_days for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  driver_id uuid not null references public.drivers (id),
  area_id uuid references public.areas (id),
  district_id uuid references public.districts (id),
  period_start date not null,
  period_end date not null,
  status text not null default '未作成' check (status in ('未作成', '作成中', '作成済')),
  issued_at timestamptz,
  issued_by uuid references public.profiles (id),
  sent_at timestamptz,
  reissue_count integer not null default 0,
  pdf_storage_path text,
  driver_approved_at timestamptz,
  driver_approved_ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, period_start, period_end)
);

alter table public.purchase_orders enable row level security;

create trigger purchase_orders_set_updated_at
  before update on public.purchase_orders
  for each row execute procedure public.set_updated_at();

create trigger purchase_orders_audit
  after insert or update or delete on public.purchase_orders
  for each row execute procedure public.audit_trigger();

create policy "purchase_orders_staff_or_admin_all"
  on public.purchase_orders for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- 稼働内容が変更された日が、既に作成済の発注書の対象期間に含まれる場合は
-- 「作成中」に自動的に戻す（再確定が必要なことを示す。あわせてドライバーの
-- 承認も無効化し、承認後に内容が変わった発注書を承認済のままにしない）。
create function public.flag_purchase_order_reissue()
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

create trigger work_schedule_days_flag_reissue
  after insert or update of worked on public.work_schedule_days
  for each row execute procedure public.flag_purchase_order_reissue();

-- ドライバー本人の発注書のみ承認・修正依頼可能なSECURITY DEFINER RPC
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

-- 承認とは逆に、稼働表の内容修正が必要なことをスタッフ側（作成中扱い）に戻して示す。
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


-- ============================================================
-- 元ファイル: 20260729133644_create_app_settings.sql
-- ============================================================
-- 設定画面（要件8章）のうち、通知設定・CSV/PDF出力設定など仕様がまだ薄い項目の保存先。
-- 汎用のkey-value形式とし、キーの追加にマイグレーションを不要にする
-- （operation_page_permissionsのpage_keyと同じ考え方）。
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.app_settings enable row level security;

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute procedure public.set_updated_at();

create trigger app_settings_audit
  after insert or update or delete on public.app_settings
  for each row execute procedure public.audit_trigger();

create policy "app_settings_staff_or_admin_all"
  on public.app_settings for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());


-- ============================================================
-- 元ファイル: 20260729142605_create_driver_self_policies.sql
-- ============================================================
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


-- ============================================================
-- 元ファイル: 20260730100000_rework_drivers_master.sql
-- ============================================================
-- ドライバーマスタ大幅リニューアル（REQUIREMENT.md改訂に合わせた対応）。
-- 契約形態の区分見直し（個人事業主／法人 → 個人委託／法人委託／直接雇用）と、
-- 詳細モーダルで扱う多数の新規項目（会社名・役割・契約期間・単価表示は都度計算・
-- 固定費・その他条件・緊急連絡先・住所・振込口座・前払可能有無・車両情報・
-- ガソリンカード）をdriversテーブルにフラットカラムとして追加する。

alter table public.drivers drop constraint if exists drivers_contract_type_check;

-- 旧値からの移行。個人事業主→個人委託、法人→法人委託とする。
-- なお契約形態のCSVインポート時の丸めバグ（import.ts）により、既に個人事業主へ
-- 誤って集約されたテスト行はこのUPDATEでは元の値（直接雇用/法人委託）に復元でき
-- ない。バグ修正後にMD/driver.csvを再インポートして正しいデータに戻すこと。
update public.drivers
set contract_type = case contract_type
  when '個人事業主' then '個人委託'
  when '法人' then '法人委託'
  else contract_type
end
where contract_type in ('個人事業主', '法人');

alter table public.drivers
  add constraint drivers_contract_type_check
  check (contract_type in ('個人委託', '法人委託', '直接雇用'));

-- ===== 基本情報タブ =====
alter table public.drivers add column company_name text;
alter table public.drivers add column driver_role text
  check (driver_role in ('固定ドライバー', '代走ドライバー', 'ドライバー', 'リーダー', '正社員', '契約社員', 'パート', 'アルバイト'));
alter table public.drivers add column contract_end_date date;
alter table public.drivers add column contract_indefinite boolean not null default false;
-- 契約期限。contract_indefinite=trueの場合はAPI層でnullを強制する運用とし、
-- DB CHECKでの相互排他制約は設けない（既存スキーマの慣習に合わせシンプルに保つ）。
alter table public.drivers add column contract_deadline_date date;
alter table public.drivers add column fixed_cost numeric;
alter table public.drivers add column other_conditions text;
alter table public.drivers add column emergency_contact_name text;
alter table public.drivers add column emergency_contact_relation text;
alter table public.drivers add column emergency_contact_phone text;
alter table public.drivers add column address text;
alter table public.drivers add column bank_name text;
alter table public.drivers add column bank_branch text;
alter table public.drivers add column bank_account_type text check (bank_account_type in ('普通', '当座'));
alter table public.drivers add column bank_account_number text;
alter table public.drivers add column bank_account_holder text;
-- 前払依頼書の計算値「前払可能額」とは別物。ドライバーごとに前払を許可するかの
-- 手動フラグ。
alter table public.drivers add column advance_eligible boolean not null default false;

-- ===== 車両情報タブ =====
alter table public.drivers add column vehicle_number text;
alter table public.drivers add column vehicle_ownership text check (vehicle_ownership in ('持込', '貸出'));
alter table public.drivers add column vehicle_lease_cost numeric;
alter table public.drivers add column vehicle_lease_start_date date;
alter table public.drivers add column vehicle_inspection_deadline date;
alter table public.drivers add column vehicle_insurance_deadline date;

-- ===== ガソリンカードタブ =====
-- 種類は管理費集計の控除項目（大野ガソリン／イチネンガソリン）とは別カラム。
-- 参照・JOINは行わない。
alter table public.drivers add column gas_card_provided boolean not null default false;
alter table public.drivers add column gas_card_issued_date date;
alter table public.drivers add column gas_card_type text check (gas_card_type in ('大野石油', 'イチネン'));

-- RLS・監査トリガーは変更不要。drivers_staff_or_admin_all / drivers_select_own は
-- 行単位ポリシーのため新規カラムにも自動適用され、drivers_audit（既存）は
-- UPDATE時に新カラムの変更も捕捉する。


-- ============================================================
-- 元ファイル: 20260731090000_create_login_lockouts.sql
-- ============================================================
-- ログイン試行のロック状態（要件: ミスログイン3の倍数ごとに段階ロック、15回目以降は
-- 恒久ロックし管理者が解除するまで自動解除しない）。
--
-- lib/rateLimit.tsの旧実装はプロセス単位のインメモリMapだったが、Next.jsのAPIルートは
-- ルートごとに別モジュールとしてコンパイルされうる（開発サーバーのオンデマンド
-- コンパイル/アイドル時の再コンパイルを含む）ため、別ルート（login.ts/login-status.ts）
-- 間はもちろん同一ルートでも状態が失われることがあった。IPアドレスをキーとした
-- 共有ストアとしてこのテーブルに永続化する。
create table public.login_lockouts (
  ip text primary key,
  fail_count integer not null default 0,
  lock_until timestamptz,
  permanent boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.login_lockouts enable row level security;

-- ログイン前（未認証）のリクエストからも読み書きする必要があるため、RLSポリシーは
-- 意図的に定義しない（anon/authenticatedともに既定拒否）。読み書きはservice role
-- クライアント（lib/supabase/server.tsのcreateAdminClient）経由のみに限定する。


-- ============================================================
-- 元ファイル: 20260731100000_add_license_fields_to_driver_documents.sql
-- ============================================================
-- 保管書類タブの免許証ペインに表示する運転免許証固有の記載事項。
-- 有効期限は既存のdriver_documents.expires_onを流用し、重複カラムは作らない。
alter table public.driver_documents add column license_holder_name text;
alter table public.driver_documents add column license_birth_date date;
alter table public.driver_documents add column license_address text;
alter table public.driver_documents add column license_issued_date date;
alter table public.driver_documents add column license_conditions text;
alter table public.driver_documents add column license_number text;


-- ============================================================
-- 元ファイル: 20260731110000_add_vehicle_cert_fields_to_driver_documents.sql
-- ============================================================
-- 保管書類タブの車検証ペインに表示する車検証固有の記載事項。
-- 有効期間の満了する日は既存のdriver_documents.expires_onを流用し、重複カラムは作らない。
alter table public.driver_documents add column vehicle_cert_number text;
alter table public.driver_documents add column vehicle_cert_type text;
alter table public.driver_documents add column vehicle_cert_purpose text;
alter table public.driver_documents add column vehicle_cert_usage text;
alter table public.driver_documents add column vehicle_cert_model_name text;
alter table public.driver_documents add column vehicle_cert_max_load text;
alter table public.driver_documents add column vehicle_cert_chassis_number text;
alter table public.driver_documents add column vehicle_cert_displacement text;
alter table public.driver_documents add column vehicle_cert_owner_name text;
alter table public.driver_documents add column vehicle_cert_owner_address text;
alter table public.driver_documents add column vehicle_cert_base_location text;


-- ============================================================
-- 元ファイル: 20260731120000_add_insurance_fields_to_driver_documents.sql
-- ============================================================
-- 保管書類タブの任意保険証ペインに表示する任意保険証固有の記載事項。
-- 保険期間の満了日は既存のdriver_documents.expires_onを流用し、重複カラムは作らない。
alter table public.driver_documents add column insurance_policy_number text;
alter table public.driver_documents add column insurance_period_start date;
alter table public.driver_documents add column insurance_insured_name text;
alter table public.driver_documents add column insurance_vehicle_owner text;
alter table public.driver_documents add column insurance_driver_condition text;
alter table public.driver_documents add column insurance_insured_vehicle text;
alter table public.driver_documents add column insurance_coverage_bodily text;
alter table public.driver_documents add column insurance_coverage_property text;
alter table public.driver_documents add column insurance_coverage_personal text;
alter table public.driver_documents add column insurance_coverage_vehicle text;
alter table public.driver_documents add column insurance_coverage_cargo text;


-- ============================================================
-- 元ファイル: 20260731130000_add_cali_fields_to_driver_documents.sql
-- ============================================================
-- 保管書類タブの自賠責保険証ペインに表示する自賠責保険証固有の記載事項。
-- 保険期間(至)は既存のdriver_documents.expires_onを流用し、重複カラムは作らない。
alter table public.driver_documents add column cali_registration_place text;
alter table public.driver_documents add column cali_registration_classification text;
alter table public.driver_documents add column cali_registration_usage text;
alter table public.driver_documents add column cali_registration_number text;
alter table public.driver_documents add column cali_period_start date;
alter table public.driver_documents add column cali_policyholder_address text;
alter table public.driver_documents add column cali_policyholder_name text;


-- ============================================================
-- 元ファイル: 20260731140000_multi_file_driver_documents.sql
-- ============================================================
-- 保管書類は書類種別ごとに複数枚アップロードできるようにする。
-- 記載事項(license_*/vehicle_cert_*/insurance_*/cali_*/expires_on)はこれまで通り
-- 書類種別ごとに1セットのみとし、実ファイルのみ複数持てるようdriver_document_files
-- 子テーブルに分離する。

create table public.driver_document_files (
  id uuid primary key default gen_random_uuid(),
  driver_document_id uuid not null references public.driver_documents(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.driver_document_files enable row level security;

create policy "driver_document_files_staff_or_admin_all"
  on public.driver_document_files
  for all
  to authenticated
  using (is_staff_or_admin())
  with check (is_staff_or_admin());

create trigger driver_document_files_audit
  after insert or delete or update on public.driver_document_files
  for each row execute function public.audit_trigger();

-- 既存の1行1ファイルのデータをそのまま子テーブルへ移行する。
insert into public.driver_document_files (driver_document_id, storage_path, original_filename, uploaded_by, created_at)
select id, storage_path, original_filename, uploaded_by, created_at
from public.driver_documents;

alter table public.driver_documents drop column storage_path;
alter table public.driver_documents drop column original_filename;
alter table public.driver_documents drop column uploaded_by;

-- 書類種別ごとのアップロード上限枚数（nullは上限なし）。
alter table public.document_types add column max_files integer;

update public.document_types set max_files = 2 where label = '免許証';
update public.document_types set max_files = 1 where label = '車検証';
update public.document_types set max_files = 2 where label = '任意保険証';
update public.document_types set max_files = 2 where label = '自賠責保険証';
update public.document_types set max_files = 2 where label = 'インボイス申請書';
update public.document_types set max_files = 3 where label = '履歴書';
update public.document_types set max_files = 2 where label = '貨物軽自動車運送事業経営届出書';
-- 業務委託契約書は上限なし（max_filesはnullのまま）


