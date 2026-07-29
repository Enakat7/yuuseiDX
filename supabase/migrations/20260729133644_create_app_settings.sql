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
