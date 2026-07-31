-- ドライバーマスタ大幅リニューアル（REQUIREMENT.md改訂に合わせた対応）。
-- 契約形態の区分見直し（個人事業主／法人 → 個人委託／法人委託／直接雇用）と、
-- 詳細モーダルで扱う多数の新規項目（会社名・役割・契約期間・単価表示は都度計算・
-- 固定費・その他条件・緊急連絡先・住所・振込口座・前払可能有無・車両情報・
-- ガソリンカード）をdriversテーブルにフラットカラムとして追加する。

alter table public.drivers drop constraint if exists drivers_contract_type_check;

-- 旧値からの移行。個人事業主→個人委託、法人→法人委託とする。
-- なお契約形態のCSVインポート時の丸めバグ（import.ts）により、既に個人事業主へ
-- 誤って集約されたテスト行はこのUPDATEでは元の値（直接雇用/法人委託）に復元でき
-- ない。バグ修正後にMD/driver.csvを再インポートして正しいデータに戻すこと。
update public.drivers
set contract_type = case contract_type
  when '個人事業主' then '個人委託'
  when '法人' then '法人委託'
  else contract_type
end
where contract_type in ('個人事業主', '法人');

alter table public.drivers
  add constraint drivers_contract_type_check
  check (contract_type in ('個人委託', '法人委託', '直接雇用'));

-- ===== 基本情報タブ =====
alter table public.drivers add column company_name text;
alter table public.drivers add column driver_role text
  check (driver_role in ('固定ドライバー', '代走ドライバー', 'ドライバー', 'リーダー', '正社員', '契約社員', 'パート', 'アルバイト'));
alter table public.drivers add column contract_end_date date;
alter table public.drivers add column contract_indefinite boolean not null default false;
-- 契約期限。contract_indefinite=trueの場合はAPI層でnullを強制する運用とし、
-- DB CHECKでの相互排他制約は設けない（既存スキーマの慣習に合わせシンプルに保つ）。
alter table public.drivers add column contract_deadline_date date;
alter table public.drivers add column fixed_cost numeric;
alter table public.drivers add column other_conditions text;
alter table public.drivers add column emergency_contact_name text;
alter table public.drivers add column emergency_contact_relation text;
alter table public.drivers add column emergency_contact_phone text;
alter table public.drivers add column address text;
alter table public.drivers add column bank_name text;
alter table public.drivers add column bank_branch text;
alter table public.drivers add column bank_account_type text check (bank_account_type in ('普通', '当座'));
alter table public.drivers add column bank_account_number text;
alter table public.drivers add column bank_account_holder text;
-- 前払依頼書の計算値「前払可能額」とは別物。ドライバーごとに前払を許可するかの
-- 手動フラグ。
alter table public.drivers add column advance_eligible boolean not null default false;

-- ===== 車両情報タブ =====
alter table public.drivers add column vehicle_number text;
alter table public.drivers add column vehicle_ownership text check (vehicle_ownership in ('持込', '貸出'));
alter table public.drivers add column vehicle_lease_cost numeric;
alter table public.drivers add column vehicle_lease_start_date date;
alter table public.drivers add column vehicle_inspection_deadline date;
alter table public.drivers add column vehicle_insurance_deadline date;

-- ===== ガソリンカードタブ =====
-- 種類は管理費集計の控除項目（大野ガソリン／イチネンガソリン）とは別カラム。
-- 参照・JOINは行わない。
alter table public.drivers add column gas_card_provided boolean not null default false;
alter table public.drivers add column gas_card_issued_date date;
alter table public.drivers add column gas_card_type text check (gas_card_type in ('大野石油', 'イチネン'));

-- RLS・監査トリガーは変更不要。drivers_staff_or_admin_all / drivers_select_own は
-- 行単位ポリシーのため新規カラムにも自動適用され、drivers_audit（既存）は
-- UPDATE時に新カラムの変更も捕捉する。
