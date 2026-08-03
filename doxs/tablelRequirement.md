# テーブル定義書

対象DB: Supabase (PostgreSQL) / スキーマ: `public`
生成日時点（2026-08-03）のマイグレーション適用済み状態を反映。

## 共通事項

- 主キーは基本的に `id uuid default gen_random_uuid()`。中間テーブル（`driver_districts`）のみ複合PK。
- 更新日時 `updated_at` を持つテーブルには `set_updated_at()` トリガー（BEFORE UPDATE）が付与され、更新時に自動更新される。
- ほぼ全テーブルに `audit_trigger()`（AFTER INSERT/UPDATE/DELETE）が付与されており、変更内容が `operation_logs` に自動記録される。
- RLSは全テーブルで有効。多くは `is_staff_or_admin()`（管理者/スタッフ）にフル権限を許可する単一ポリシー。ドライバー本人に一部SELECTのみ許可するテーブルは `current_driver_id()`（`profiles.id` → `drivers.profile_id` を解決するヘルパー）で行を絞り込む。
- 主なヘルパー関数: `is_admin()` / `is_staff_or_admin()` / `current_driver_id()`（すべて `SECURITY DEFINER`、RLS内での再帰参照を避けるため）、`driver_earnings(driver_id, date_from, date_to)`（件数×卸単価でドライバー売上を算出、支払通知書生成と前払依頼書シミュレーションで共用）。

### ENUM型

| 型名 | 値 |
|---|---|
| `user_role` | `管理者` / `スタッフ` / `ドライバー` |

---

## 認証・権限・ログ

### profiles

`auth.users` と1:1で紐づくアプリ側プロフィール（表示名・権限）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | - | `auth.users(id)` を参照（ON DELETE CASCADE） |
| name | text | NOT NULL | - | 表示名 |
| role | user_role | NOT NULL | 'スタッフ' | 管理者/スタッフ/ドライバー |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

- トリガー: `profiles_prevent_role_escalation`（BEFORE UPDATE）— 権限昇格を防止する専用トリガー（`audit_trigger`とは別）。
- ポリシー: 本人または管理者のみSELECT/UPDATE可。

### operation_page_permissions

スタッフ単位の画面アクセス許可（ページ単位のON/OFF）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| profile_id | uuid FK→profiles | NOT NULL | - | |
| page_key | text | NOT NULL | - | 画面キー（`lib/pages.ts` の `OPERATION_PAGE_KEYS`） |
| can_access | boolean | NOT NULL | true | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

- UNIQUE: (profile_id, page_key)
- ポリシー: 本人または管理者がSELECT、変更系（INSERT/UPDATE/DELETE）は管理者のみ。

### operation_logs

全テーブルの変更・主要操作の監査ログ（`audit_trigger()` により自動記録、一部APIから明示記録）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | bigint PK | NOT NULL | identity | |
| actor_id | uuid FK→profiles | NULL可 | - | 実行者（service_role経由等でprofile未特定の場合はnull） |
| actor_role | user_role | NOT NULL | - | |
| actor_name | text | NOT NULL | - | |
| screen_name | text | NOT NULL | - | 画面名 |
| action | text | NOT NULL | - | 操作内容 |
| params | jsonb | NOT NULL | '{}' | 操作パラメータ／トリガー時は変更後の行 |
| target_table | text | NULL可 | - | |
| target_id | text | NULL可 | - | |
| source | text | NOT NULL | - | `app`（APIから明示記録）/ `trigger`（DBトリガー自動記録） |
| created_at | timestamptz | NOT NULL | now() | |

- CHECK: source in ('app','trigger')
- インデックス: created_at DESC
- ポリシー: 管理者のみSELECT可（INSERTはトリガー/service_role経由）。
- Supabase Realtime publication対象（`supabase_realtime`）。

### login_lockouts

ログイン試行の段階ロック状態（IPアドレス単位、DB永続化）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| ip | text PK | NOT NULL | - | |
| fail_count | integer | NOT NULL | 0 | 失敗回数 |
| lock_until | timestamptz | NULL可 | - | 一時ロックの解除時刻 |
| permanent | boolean | NOT NULL | false | 恒久ロック（15回目以降） |
| updated_at | timestamptz | NOT NULL | now() | |

- RLSは有効だがポリシーなし（service_role経由のみアクセス可）。
- 3回ごとにロック（3分→5分→10分→15分→15回目以降は恒久ロック）。恒久ロックは管理者専用ページ（`/dashboard/login-locks`）から解除。

---

## マスタ管理

### areas

エリアマスタ（7エリア想定）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| name | text UNIQUE | NOT NULL | - | |
| sort_order | integer | NOT NULL | 0 | |
| active | boolean | NOT NULL | true | |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- 被参照: districts, drivers, payment_notices, purchase_orders, unit_prices

### districts

地区マスタ（エリア配下）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| area_id | uuid FK→areas | NOT NULL | - | ON DELETE CASCADE |
| name | text | NOT NULL | - | |
| sort_order | integer | NOT NULL | 0 | |
| active | boolean | NOT NULL | true | |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- UNIQUE: (area_id, name)
- 被参照: driver_districts, purchase_orders

### delivery_types（配送種別マスタ）

配送種別。単価マスタ・件数集計の対象可否（`price_master_target`）を持つ。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| code | text UNIQUE | NOT NULL | - | 例: D01, M01, N01, L01, P01, Y01, U01 |
| name | text | NOT NULL | - | 種別名 |
| price_master_target | boolean | NOT NULL | false | 単価マスタ対象か。falseの種別は単価・件数集計・支払通知書・前払依頼書のいずれからも除外される |
| sort_order | integer | NOT NULL | 0 | |
| active | boolean | NOT NULL | true | |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- 被参照: count_categories, unit_prices

### count_categories（件数区分）

件数集計・支払通知書の集計区分（10区分）。`delivery_type_id` で配送種別マスタと対応づく（null許容＝配送種別マスタに存在しない区分も許容する設計だったが、現状は10区分すべて紐づけ済み）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| label | text UNIQUE | NOT NULL | - | 区分名 |
| delivery_type_id | uuid FK→delivery_types | NULL可 | - | 対応する配送種別（単価マスタ対象外の判定に使用） |
| sort_order | integer | NOT NULL | 0 | |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- 被参照: count_entries, payment_notice_items
- `price_master_target=false` の配送種別に紐づく区分は `/api/counts/categories` 等で除外され、件数集計・支払通知書に表示されない。

### document_types（保管書類種類マスタ）

ドライバー保管書類の種類（8種＋追加可能）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| label | text UNIQUE | NOT NULL | - | 例: 免許証、車検証、任意保険証、自賠責保険証、インボイス申請書、業務委託契約書、履歴書、貨物軽自動車運送事業経営届出書 |
| is_expiring | boolean | NOT NULL | false | 有効期限の概念があるか |
| is_system | boolean | NOT NULL | true | システム標準種別か |
| sort_order | integer | NOT NULL | 0 | |
| max_files | integer | NULL可 | - | アップロード上限枚数（nullは無制限） |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- 被参照: driver_documents

### drivers（ドライバーマスタ）

ドライバー情報一式（基本情報・契約・振込口座・車両・ガソリンカード）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | UIDとして画面表示 |
| profile_id | uuid FK→profiles UNIQUE | NULL可 | - | ログインアカウント発行済みの場合のみ設定（ON DELETE SET NULL） |
| name | text | NOT NULL | - | 氏名 |
| contract_type | text | NOT NULL | - | CHECK: 個人委託／法人委託／直接雇用 |
| area_id | uuid FK→areas | NOT NULL | - | |
| contract_start_date | date | NOT NULL | - | |
| phone / email | text | NULL可 | - | |
| pay_type | text | NOT NULL | - | CHECK: 週払い／月払い |
| active | boolean | NOT NULL | true | 論理削除フラグ |
| company_name | text | NULL可 | - | |
| driver_role | text | NULL可 | - | CHECK: 固定ドライバー/代走ドライバー/ドライバー/リーダー/正社員/契約社員/パート/アルバイト |
| contract_end_date | date | NULL可 | - | |
| contract_indefinite | boolean | NOT NULL | false | 無期雇用フラグ（trueなら契約期限は強制null） |
| contract_deadline_date | date | NULL可 | - | |
| fixed_cost | numeric | NULL可 | - | 固定費 |
| other_conditions | text | NULL可 | - | その他条件 |
| emergency_contact_name / _relation / _phone | text | NULL可 | - | 緊急連絡先 |
| address | text | NULL可 | - | 住所 |
| bank_name / bank_branch / bank_account_number / bank_account_holder | text | NULL可 | - | 振込口座 |
| bank_account_type | text | NULL可 | - | CHECK: 普通／当座 |
| advance_eligible | boolean | NOT NULL | false | 前払可能有無 |
| vehicle_number | text | NULL可 | - | 車両ナンバー |
| vehicle_ownership | text | NULL可 | - | CHECK: 持込／貸出 |
| vehicle_lease_cost | numeric | NULL可 | - | 貸出費用 |
| vehicle_lease_start_date | date | NULL可 | - | |
| vehicle_inspection_deadline | date | NULL可 | - | 車検期限 |
| vehicle_insurance_deadline | date | NULL可 | - | 任意保険期限 |
| gas_card_provided | boolean | NOT NULL | false | |
| gas_card_issued_date | date | NULL可 | - | |
| gas_card_type | text | NULL可 | - | CHECK: 大野石油／イチネン |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- 被参照: advance_requests, count_entries, deduction_items, driver_districts, driver_documents, payment_notices, purchase_orders, work_schedule_days
- ポリシー: `drivers_select_own`（本人のみ自分の行をSELECT）+ `drivers_staff_or_admin_all`
- 単価（卸単価）・パスワードはカラムを持たず、単価マスタ／Supabase Authから都度算出・管理。

### driver_districts（ドライバー×地区）

1ドライバーが複数地区を掛け持つための中間テーブル。

| カラム | 型 | NULL | デフォルト |
|---|---|---|---|
| driver_id | uuid FK→drivers (ON DELETE CASCADE) | NOT NULL | - |
| district_id | uuid FK→districts (ON DELETE CASCADE) | NOT NULL | - |

- PK: (driver_id, district_id)
- ポリシー: `driver_districts_select_own`（本人のみ）+ staff_or_admin_all

### driver_documents（ドライバー保管書類）

書類種別ごとの記載事項（1ドライバー×1書類種別につき1行）。実ファイルは `driver_document_files` に分離。ドライバー本人は閲覧不可（管理者/スタッフのみ、署名付きURL経由）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| driver_id | uuid FK→drivers (ON DELETE CASCADE) | NOT NULL | - | |
| document_type_id | uuid FK→document_types | NOT NULL | - | |
| expires_on | date | NULL可 | - | 有効期限（免許証・車検証・任意保険証・自賠責保険証は各Details内の期限入力欄と共用） |
| license_holder_name / license_birth_date / license_address / license_issued_date / license_conditions / license_number | text/date | NULL可 | - | 免許証の記載事項 |
| vehicle_cert_number / _type / _purpose / _usage / _model_name / _max_load / _chassis_number / _displacement / _owner_name / _owner_address / _base_location | text | NULL可 | - | 車検証の記載事項 |
| insurance_policy_number / _period_start / _insured_name / _vehicle_owner / _driver_condition / _insured_vehicle / _coverage_bodily / _coverage_property / _coverage_personal / _coverage_vehicle / _coverage_cargo | text/date | NULL可 | - | 任意保険証の記載事項（保険期間の満了日は`expires_on`を流用） |
| cali_registration_place / _classification / _usage / _number / cali_period_start / cali_policyholder_address / cali_policyholder_name | text/date | NULL可 | - | 自賠責保険証の記載事項（保険期間の満了日は`expires_on`を流用） |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- UNIQUE: (driver_id, document_type_id)
- 被参照: driver_document_files

### driver_document_files（ドライバー保管書類ファイル）

`driver_documents` 1行に対して複数枚の実ファイルを保持する子テーブル（書類種別ごとの上限枚数は `document_types.max_files`）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| driver_document_id | uuid FK→driver_documents (ON DELETE CASCADE) | NOT NULL | - | |
| storage_path | text | NOT NULL | - | Storageバケット`driver-documents`内のパス |
| original_filename | text | NOT NULL | - | 画面表示用の元ファイル名 |
| uploaded_by | uuid FK→profiles | NULL可 | - | |
| created_at | timestamptz | NOT NULL | now() | |

- Storageバケット `driver-documents` は非公開。署名付きURL（60秒）経由でのみ閲覧可能。

### unit_prices（単価マスタ）

受注単価／卸単価。適用開始日ベースの追記型バージョン管理（更新せず新規行を追加）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| price_kind | text | NOT NULL | - | CHECK: 受注単価／卸単価 |
| area_id | uuid FK→areas | NOT NULL | - | |
| delivery_type_id | uuid FK→delivery_types | NOT NULL | - | |
| effective_from | date | NOT NULL | - | 適用開始日 |
| price_yen | numeric(10,2) | NOT NULL | - | |
| created_by | uuid FK→profiles | NULL可 | - | |
| created_at | timestamptz | NOT NULL | now() | |

- UNIQUE: (price_kind, area_id, delivery_type_id, effective_from)
- 「対象日時点で有効な最新の適用開始日」の単価を都度算出して使用する（`driver_earnings()` 等）。

### deduction_item_defaults（控除項目デフォルト）

管理費集計の控除項目デフォルト一覧（7項目）。ドライバー新規登録時に `deduction_items` へクローンされる。

| カラム | 型 | NULL | デフォルト |
|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() |
| label | text UNIQUE | NOT NULL | - |
| sort_order | integer | NOT NULL | 0 |

### deduction_items（ドライバー別控除項目）

ドライバーごとにカスタマイズ可能な控除項目。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| driver_id | uuid FK→drivers (ON DELETE CASCADE) | NOT NULL | - | |
| label | text | NOT NULL | - | |
| sort_order | integer | NOT NULL | 0 | |
| active | boolean | NOT NULL | true | |
| created_at | timestamptz | NOT NULL | now() | |

- 被参照: deduction_amounts

---

## 件数集計

### count_entries

日次の件数実績（ドライバー×区分×日付）。日報機能はなく、専用画面から管理者/スタッフが直接入力する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| driver_id | uuid FK→drivers (ON DELETE CASCADE) | NOT NULL | - | |
| category_id | uuid FK→count_categories | NOT NULL | - | |
| work_date | date | NOT NULL | - | |
| count | integer | NOT NULL | 0 | |
| entered_by | uuid FK→profiles | NULL可 | - | |
| approved | boolean | NOT NULL | false | |
| approved_by | uuid FK→profiles | NULL可 | - | |
| approved_at | timestamptz | NULL可 | - | |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- UNIQUE: (driver_id, category_id, work_date)
- インデックス: work_date、(driver_id, work_date)、部分インデックス work_date WHERE NOT approved（月間40万件規模を想定）
- 保存は差分保存（実際に値が変わったセルのみ upsert）。同一セルを複数人が同時編集した場合は後勝ち。

---

## 管理費集計

### deduction_amounts

月次の控除金額（控除項目×対象月）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| deduction_item_id | uuid FK→deduction_items (ON DELETE CASCADE) | NOT NULL | - | |
| period_month | date | NOT NULL | - | 対象月（月初日で保持） |
| amount | integer | NOT NULL | 0 | |
| entered_by | uuid FK→profiles | NULL可 | - | |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- UNIQUE: (deduction_item_id, period_month)
- インデックス: period_month
- 保存は差分保存（件数集計と同じ方式）。前払依頼書の前払可能額計算にも使用される。

---

## 支払通知書

### payment_notices

支払通知書本体。生成→承認（仮確定）→局・NC突合後に確定、の3ステータス。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| notice_no | text UNIQUE | NOT NULL | - | 自動採番 |
| driver_id | uuid FK→drivers | NOT NULL | - | |
| area_id | uuid FK→areas | NULL可 | - | |
| pay_type | text | NOT NULL | - | CHECK: 週払い／月払い |
| period_start / period_end | date | NOT NULL | - | 対象期間 |
| amount | integer | NOT NULL | 0 | |
| status | text | NOT NULL | '未承認' | CHECK: 未承認／仮確定／確定 |
| remarks | text | NULL可 | - | |
| confirmed_at | timestamptz | NULL可 | - | |
| confirmed_by | uuid FK→profiles | NULL可 | - | |
| driver_acknowledged_at | timestamptz | NULL可 | - | ドライバーがmypageで確認した日時 |
| driver_acknowledged_ip | text | NULL可 | - | |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- UNIQUE: (driver_id, period_start, period_end, pay_type)
- 被参照: payment_notice_email_sends, payment_notice_items, payment_notice_revisions
- ポリシー: `payment_notices_select_own`（本人かつ status≠未承認のみ閲覧可）+ staff_or_admin_all

### payment_notice_items

支払通知書の件数内訳明細（区分ごとの件数・単価スナップショット・金額）。

| カラム | 型 | NULL | デフォルト |
|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() |
| payment_notice_id | uuid FK→payment_notices (ON DELETE CASCADE) | NOT NULL | - |
| category_id | uuid FK→count_categories | NOT NULL | - |
| count | integer | NOT NULL | 0 |
| unit_price_snapshot | integer | NOT NULL | 0 |
| amount | integer | NOT NULL | 0 |

- ポリシー: `payment_notice_items_select_own`（紐づく通知書が本人かつ未承認以外の場合のみ）+ staff_or_admin_all

### payment_notice_revisions

確定後修正の履歴（修正すると未承認へ差し戻され再承認が必要）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| payment_notice_id | uuid FK→payment_notices (ON DELETE CASCADE) | NOT NULL | - | |
| revised_at | timestamptz | NOT NULL | now() | |
| revised_by | uuid FK→profiles | NULL可 | - | |
| diff_summary | text | NULL可 | - | |
| previous_amount | integer | NOT NULL | - | |
| new_amount | integer | NOT NULL | - | |

### payment_notice_email_sends

支払通知書メール送信履歴。

| カラム | 型 | NULL | デフォルト |
|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() |
| payment_notice_id | uuid FK→payment_notices (ON DELETE CASCADE) | NOT NULL | - |
| sent_to | text | NOT NULL | - |
| sent_at | timestamptz | NOT NULL | now() |
| sent_by | uuid FK→profiles | NULL可 | - |

---

## 前払依頼書

### advance_requests

前払依頼書。承認フローなし（確定要件）。前払可能額 = 現時点までの売上（`driver_earnings`）− 当月の控除予定額。可能額を上回る申請は「超過（要確認）」として識別されるが、マイナスでも実行は許容する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| request_no | text UNIQUE | NOT NULL | - | 自動採番 |
| driver_id | uuid FK→drivers | NOT NULL | - | |
| payout_date | date | NOT NULL | - | 入金日 |
| amount | integer | NOT NULL | - | 前払金額 |
| available_amount_snapshot | integer | NOT NULL | - | 作成時点の前払可能額（サーバー側で自動算出） |
| status | text | NOT NULL | '申請中' | CHECK: 申請中／超過（要確認）／実行済 |
| note | text | NULL可 | - | |
| created_by | uuid FK→profiles | NULL可 | - | |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

---

## 発注書（稼働表）

### work_schedule_days

日単位の実稼働データ。稼働内容が変わると発注書が自動で「要再送信」になる。

| カラム | 型 | NULL | デフォルト |
|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() |
| driver_id | uuid FK→drivers (ON DELETE CASCADE) | NOT NULL | - |
| work_date | date | NOT NULL | - |
| worked | boolean | NOT NULL | false |
| updated_by | uuid FK→profiles | NULL可 | - |
| created_at / updated_at | timestamptz | NOT NULL | now() |

- UNIQUE: (driver_id, work_date)
- インデックス: work_date
- トリガー: `work_schedule_days_flag_reissue`（AFTER INSERT/UPDATE OF worked）— 対応する発注書を「要再送信」に自動更新
- ポリシー: `work_schedule_days_select_own`（本人）+ staff_or_admin_all

### purchase_orders

発注書（稼働表PDF）。手動発行、稼働内容変更後は自動で「要再送信」。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | uuid PK | NOT NULL | gen_random_uuid() | |
| order_no | text UNIQUE | NOT NULL | - | 自動採番 |
| driver_id | uuid FK→drivers | NOT NULL | - | |
| area_id | uuid FK→areas | NULL可 | - | |
| district_id | uuid FK→districts | NULL可 | - | |
| period_start / period_end | date | NOT NULL | - | |
| status | text | NOT NULL | '未送信' | CHECK: 未送信／送信済／要再送信 |
| issued_at | timestamptz | NULL可 | - | |
| issued_by | uuid FK→profiles | NULL可 | - | |
| sent_at | timestamptz | NULL可 | - | |
| reissue_count | integer | NOT NULL | 0 | |
| pdf_storage_path | text | NULL可 | - | |
| created_at / updated_at | timestamptz | NOT NULL | now() | |

- UNIQUE: (driver_id, period_start, period_end)
- ポリシー: `purchase_orders_select_own`（本人）+ staff_or_admin_all

---

## 設定

### app_settings

汎用key-value設定（通知設定・CSV/PDF出力設定など仕様が薄い項目の保存先）。キー追加にマイグレーションを不要にする設計。

| カラム | 型 | NULL | デフォルト |
|---|---|---|---|
| key | text PK | NOT NULL | - |
| value | jsonb | NOT NULL | - |
| updated_at | timestamptz | NOT NULL | now() |
| updated_by | uuid FK→profiles | NULL可 | - |

---

## テーブル間の主な関連図（概略）

```
areas ──< districts ──< driver_districts >── drivers
  │                                              │
  ├──< unit_prices >── delivery_types            ├──< driver_documents ──< driver_document_files
  │                        │                      │        └─ document_types
  ├──< payment_notices     └──< count_categories ─┤
  │        ├──< payment_notice_items              ├──< count_entries
  │        ├──< payment_notice_revisions          ├──< deduction_items ──< deduction_amounts
  │        └──< payment_notice_email_sends        ├──< advance_requests
  ├──< purchase_orders                            └──< work_schedule_days
  │
profiles ──< drivers (profile_id)
profiles ──< operation_page_permissions
profiles ──< operation_logs (actor_id)
```
