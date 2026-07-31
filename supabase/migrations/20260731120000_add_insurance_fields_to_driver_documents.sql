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
