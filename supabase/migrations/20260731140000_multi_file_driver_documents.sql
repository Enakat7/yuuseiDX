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
