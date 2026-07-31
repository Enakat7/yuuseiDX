-- 保管書類タブの免許証ペインに表示する運転免許証固有の記載事項。
-- 有効期限は既存のdriver_documents.expires_onを流用し、重複カラムは作らない。
alter table public.driver_documents add column license_holder_name text;
alter table public.driver_documents add column license_birth_date date;
alter table public.driver_documents add column license_address text;
alter table public.driver_documents add column license_issued_date date;
alter table public.driver_documents add column license_conditions text;
alter table public.driver_documents add column license_number text;
