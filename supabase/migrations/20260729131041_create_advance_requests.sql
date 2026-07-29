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
