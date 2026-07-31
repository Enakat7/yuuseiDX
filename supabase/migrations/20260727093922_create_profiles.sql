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
