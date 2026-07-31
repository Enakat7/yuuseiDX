-- 保管書類タブの自賠責保険証ペインに表示する自賠責保険証固有の記載事項。
-- 保険期間(至)は既存のdriver_documents.expires_onを流用し、重複カラムは作らない。
alter table public.driver_documents add column cali_registration_place text;
alter table public.driver_documents add column cali_registration_classification text;
alter table public.driver_documents add column cali_registration_usage text;
alter table public.driver_documents add column cali_registration_number text;
alter table public.driver_documents add column cali_period_start date;
alter table public.driver_documents add column cali_policyholder_address text;
alter table public.driver_documents add column cali_policyholder_name text;
