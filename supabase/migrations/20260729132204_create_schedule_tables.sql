-- 発注書(稼働表)（要件6.1）。稼働日は実データ（日単位）で管理し、
-- 発注書は手動発行、稼働内容変更後は自動で「要再送信」にする。

create table public.work_schedule_days (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  work_date date not null,
  worked boolean not null default false,
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
  status text not null default '未送信' check (status in ('未送信', '送信済', '要再送信')),
  issued_at timestamptz,
  issued_by uuid references public.profiles (id),
  sent_at timestamptz,
  reissue_count integer not null default 0,
  pdf_storage_path text,
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

-- 稼働内容が変更された日が、既に送信済の発注書の対象期間に含まれる場合は
-- 「要再送信」に自動変更する（要件6.1）。
create function public.flag_purchase_order_reissue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.purchase_orders
  set status = '要再送信'
  where driver_id = new.driver_id
    and status = '送信済'
    and new.work_date between period_start and period_end;
  return new;
end;
$$;

create trigger work_schedule_days_flag_reissue
  after insert or update of worked on public.work_schedule_days
  for each row execute procedure public.flag_purchase_order_reissue();
