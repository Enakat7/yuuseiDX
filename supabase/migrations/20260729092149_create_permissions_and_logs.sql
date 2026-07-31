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
