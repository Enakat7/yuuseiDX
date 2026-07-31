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
