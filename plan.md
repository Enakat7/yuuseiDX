# オペレーションダッシュボード実装プラン

> ドライバー側画面（`/mypage`）の機能実装は対象外。ルーティング整理のみ実施済み。
> REQUIREMENT.md（確定仕様）・question.md（未回答項目）と合わせて参照すること。

## 進捗状況

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | ルーティングリネーム（`dashboard-operation`→`dashboard`, `dashboard-driver`→`mypage`） | 完了 |
| 1 | 共通基盤（`lib/constants.ts`・`lib/csv.ts`・`lib/pdf/`・`lib/realtime.ts`・`lib/pages.ts`） | 完了 |
| 2 | RBAC拡張・ページ単位権限テーブル・操作ログ基盤 | 完了 |
| 3 | マスタ管理（ドライバー／単価／配送種別） | 完了 |
| 4 | 件数集計 | 完了 |
| 5 | 管理費集計 | 完了 |
| 6 | 支払通知書 | 完了 |
| 7 | 前払依頼書 | 完了 |
| 8 | 発注書(稼働表) | 完了 |
| 9 | 設定／権限管理UI | 完了 |
| 10 | ログ画面（リアルタイム表示） | 完了（ポーリング方式を採用） |
| 11 | CSV/PDF出力の仕上げ | 未着手 |

保留事項: question.mdに追加されたドライバーマスタの詳細項目（UID・会社名・所属・契約形態〔個人委託／法人委託／直接雇用の3区分〕・役割・契約終了日／契約期限・単価自動取得・固定費・その他条件・緊急連絡先・住所・振込口座、車両情報、ガソリンカード、免許、書類6種等。REQUIREMENT.md §6.7・6.8に反映済み）は、`drivers`テーブルの大幅拡張が必要だが、ユーザー指示により**別途指示があるまで着手しない**。Phase 4以降は現状の`drivers`スキーマ（氏名・契約形態〔個人事業主／法人の2区分のまま〕・エリア・契約開始日・連絡先・支払種別）を前提に進める。

**Phase 3実装済み分との既知の差分（着手時に要修正）**:
- `drivers.contract_type`は現状`個人事業主／法人`の2区分だが、確定仕様は`個人委託／法人委託／直接雇用`の3区分
- `document_types`のseedは現状8種（免許証／車検証／任意保険証／自賠責保険証／インボイス申請書／業務委託契約書／履歴書／貨物軽自動車運送事業経営届出書）だが、確定仕様は6種（車検証／経営届出書(開業届)／免許証／任意保険証／履歴書／インボイス書類、ファイル形式はjpeg/jpg/png/pdf/webp）。自賠責保険証・業務委託契約書は意図的に対象外
- `areas`のseedは西／安佐南／中央(中区)／中央(東区)／府中／伴／宇品の7件のままでよい（ドライバーマスタの「安芸府中」は「府中」と同一と確認済み、表記統一不要）

---

## 重要な設計方針（Phase 3で確定・以降すべてのフェーズに適用）

**全データアクセスはサーバー側API Route経由とする。ブラウザから直接Supabaseテーブルを叩いてはいけない。**

- 理由: `lib/supabase/server.ts`が認証Cookieを意図的に`httpOnly`で発行しているため（XSS対策）、ブラウザ側の`lib/supabase/client.ts`（`createBrowserClient`）はセッションを取得できない。ブラウザから直接`.from()`を呼ぶとRLSにより常に空/失敗になる。
- パターン: `lib/apiAuth.ts`の`requireStaffOrAdmin(req, res)`で認可チェック＋サーバー側クライアント取得 → `pages/api/**`配下にRESTライクなAPI Routeを作る → フロントは`lib/apiClient.ts`の`apiRequest()`でfetchする。
- 例: `pages/api/master/drivers/index.ts`, `pages/dashboard/master/index.tsx`（Phase 3実装済み、以降のフェーズはこれをテンプレートにする）。
- ログ記録（`log_operation` RPC）もこのサーバー側クライアントから呼ぶ（ブラウザから直接RPCは呼べない）。

**Realtime（Phase 10）は例外的に検討が必要**: ブラウザにセッションがないため、標準の`supabase.channel()`購読もそのままではRLS認証されない。Phase 10着手時に「短命トークンを発行してRealtime専用に`setAuth()`する」か「ポーリングに倒す」かを決定する（現時点では未決定、下記Phase 10参照）。

---

## Phase 4: 件数集計

**テーブル**
- `count_entries`（id, driver_id→drivers, category_id→count_categories, work_date date, count integer not null default 0, entered_by→profiles, approved boolean default false, approved_by, approved_at, created_at, updated_at）。unique(driver_id, category_id, work_date)。RLS: 管理者/スタッフのみ（ドライバーは§1.3で確定した通りアクセス不可）。`audit_trigger`付与。
- インデックス: `(work_date)`, `(driver_id, work_date)`, 承認待ちキュー用に`(approved, work_date)`の部分インデックス。月間40万件規模を想定。

**API Route**
- `GET /api/counts?date=YYYY-MM-DD&area=` — 指定日・エリアの件数一覧（driver結合、10区分を横持ちに変換して返す）
- `POST /api/counts` — 件数の一括保存（upsert、`entered_by`は認証ユーザー）
- `POST /api/counts/approve` — 個別/一括承認（`ids: string[]`を受け取り`approved/approved_by/approved_at`を更新）
- `GET /api/counts/summary?period=daily|weekly|monthly&date=` — 集計表示用（§6.3「日次・週次・月次すべてで確認できるように」に対応）

**フロント**: `pages/dashboard/aggregation.tsx`を実データ化。既存UIの日付ナビ・エリアタブ・チェックボックス一括承認はそのまま活かし、`COLUMNS`を`count_categories`から動的取得（10区分、現状ハードコードされている8区分から修正）。日次/週次/月次切替タブを追加。CSVエクスポート実装。

---

## Phase 5: 管理費集計

**テーブル**
- `deduction_item_defaults`（id, label, sort_order）— 7項目seed（大野ガソリン/イチネンガソリン/車両修理費/リース料/貸借料/自動車税/スタッフ貸出料）
- `deduction_items`（id, driver_id→drivers, label, sort_order, active）— ドライバー作成時に`deduction_item_defaults`からクローンする。**Phase 3の`POST /api/master/drivers`にこのクローン処理を追加する**（新規ドライバー作成の直後）。
- `deduction_amounts`（id, deduction_item_id→deduction_items, period_month date, amount integer, entered_by, created_at, updated_at）。unique(deduction_item_id, period_month)

**API Route**
- `GET /api/cost?month=YYYY-MM-01&area=` — ドライバー×項目の金額一覧
- `POST /api/cost/amounts` — 月次金額の一括保存
- `POST /api/cost/items` — ドライバー個別の控除項目追加

**フロント**: `pages/dashboard/cost.tsx`実データ化。既存の7列テーブル・合計列はそのまま、CSVインポート/エクスポート実装。

---

## Phase 6: 支払通知書

**テーブル**
- `payment_notices`（id, notice_no, driver_id, area_id snapshot, pay_type, period_start, period_end, amount, status check(未承認/仮確定/確定), remarks, confirmed_at, confirmed_by, driver_acknowledged_at, driver_acknowledged_ip, created_at, updated_at）。unique(driver_id, period_start, period_end, pay_type)
- `payment_notice_items`（id, payment_notice_id, category_id→count_categories, count, unit_price_snapshot, amount）— 単価は生成時にスナップショットし、後から単価マスタを変更しても過去の通知書に影響しないようにする
- `payment_notice_revisions`（id, payment_notice_id, revised_at, revised_by, diff_summary, previous_amount, new_amount）— 確定後に件数・金額の修正が入った場合は再承認フローが必要（クライアント確認済み）。修正発生時に`payment_notices.status`を`確定`から`未承認`（または`仮確定`）へ戻し、再度承認〜確定を通す運用とする。具体的な操作フロー（誰がどの画面で再承認するか）は未定のため、着手時に詳細化する。
- `payment_notice_email_sends`（id, payment_notice_id, sent_to, sent_at, sent_by）

**共通ロジック**
- `public.driver_earnings(driver_id, date_from, date_to)` SQL関数 — `count_entries × unit_prices(卸単価)`で売上を算出。Phase 7の前払依頼書シミュレーションと共有する。
- 明示義務対応（閲覧・承認ボタン等）は契約形態（個人委託／法人委託／直接雇用）に関わらず全ドライバーに一律適用する（直接雇用はフリーランス法・下請法の対象外だが、発注書がシフト表を兼ねるためクライアント確認済み）。契約形態による分岐ロジックは設けない。

**API Route**
- `GET /api/payments?status=&period=`
- `POST /api/payments/generate` — 承認済み`count_entries`から通知書を生成（週払い=金曜／月払い=月末締め、pay_typeで分岐）
- `POST /api/payments/approve` — 個別/一括承認
- `POST /api/payments/confirm` — 局・NC突合後の確定操作、備考欄の自動生成
- `POST /api/payments/:id/revise` — 確定後の修正受付。`payment_notice_revisions`に記録し、ステータスを差し戻して再承認を要求する
- `POST /api/payments/:id/acknowledge` — ドライバー承認ボタン用RPC（`/mypage`側の実装は対象外だが、RPC自体はここで用意しておく）

**フロント**: `pages/dashboard/payment.tsx`実データ化。ステータスタブ・一括承認は既存UI流用、詳細モーダルを新規追加。

---

## Phase 7: 前払依頼書

**テーブル**
- `advance_requests`（id, request_no, driver_id, payout_date, amount, available_amount_snapshot, status check(申請中/超過（要確認）/実行済), note, created_by, created_at, updated_at）。承認フローなし（確定要件）。

**API Route**
- `GET /api/advance?driver=`
- `POST /api/advance` — 作成（`driver_earnings()` − `deduction_amounts`で前払可能額を計算し、`amount > available`なら`超過（要確認）`を自動セット）

**フロント**: `pages/dashboard/advance.tsx`実データ化。シミュレーション計算テーブル・新規作成フォーム・一覧はそのまま、木曜締め→金曜作業→翌週水曜払いのサイクル表記を追加。

---

## Phase 8: 発注書(稼働表)

**テーブル**
- `work_schedule_days`（id, driver_id, work_date, worked boolean, updated_by, created_at, updated_at）。unique(driver_id, work_date)。既存の`lib/calendar.ts`の`buildMonthGrid`が消費するMon–Sunの稼働パターンの実データ元になる。
- `purchase_orders`（id, order_no, driver_id, area_id/district_id snapshot, period_start, period_end, status check(未送信/送信済/要再送信), issued_at, issued_by, sent_at, reissue_count, pdf_storage_path, created_at, updated_at）
- トリガー: `work_schedule_days`更新時、対象日が既に`送信済`の`purchase_orders`期間内なら`status`を`要再送信`に自動変更（§6.1「稼働内容変更時は再発行」）

**API Route**
- `GET /api/schedule?area=&month=`
- `POST /api/schedule/days` — 稼働日の更新
- `POST /api/schedule/issue` — 発注書の手動発行（自動発行ではない、要確認済み）
- `POST /api/schedule/reissue`

**フロント**: `pages/dashboard/schedule.tsx`実データ化。既存のエリアタブ・週間グリッド・月間カレンダーモーダルはそのまま、`DRIVERS_BY_AREA`のハードコードを`work_schedule_days`ベースに置き換え。

---

## Phase 9: 設定／権限管理UI

- `operation_page_permissions`（Phase 2で作成済み）を編集するUI。アカウント一覧＋ページ別トグル。
- アカウント作成: `SUPABASE_SERVICE_ROLE_KEY`を使うAdmin APIをサーバー側API Route（`pages/api/settings/accounts.ts`）経由で叩く（§1.3「設定ページから管理者が作成」）。**service roleキーは絶対にクライアントに渡さず、このAPI Route内でのみ使用する。**
- 通知設定・帳票発行タイミング・CSV/PDF出力設定は確定仕様が薄いため、UIシェル＋保存機能程度に留める（詳細はREQUIREMENT.md §8参照）。

---

## Phase 10: ログ画面（完了）

- `operation_logs`を一覧表示。管理者限定（クライアント側ガード＋RLS＋APIルート内の明示チェックの三重）。
- Realtime方式は不採用とし、`GET /api/logs?since=`を3秒間隔でポーリングする方式を採用（他フェーズと同じ「データアクセスはサーバー側API Route経由」の方針を崩さないため）。
- 副次的に発見したlib/currentUser.tsxのハイドレーション競合バグ（フルページ読み込み時に一瞬デフォルト権限と誤判定される問題）を`ready`フラグ導入で修正済み。

---

## Phase 11: CSV/PDF出力の仕上げ

- 全ページのCSVエクスポートボタンを`lib/csv.ts`で統一実装（Phase 4-9で個別実装したものの最終確認・統一）。
- 発注書・支払通知書のPDF単票/一括出力を`@react-pdf/renderer`で実装。生成はNode.jsランタイムのAPI Route（`pages/api/pdf/*`）で行う。テンプレートは未確定のため`lib/pdf/PdfLayout.tsx`をベースにした差し替え可能な構成にする。
- CSV/PDF出力を`operation_page_permissions`のページアクセス権限と連動させる（そのページにアクセスできないアカウントはエクスポートもできないようにする）。

---

## 主な前提・未確定事項（要件上ブロッカーにしない）

- ドライバーマスタの詳細項目拡張（REQUIREMENT.md§6.7に反映済み、DBスキーマへの反映はユーザー指示があるまで保留）
- 配送種別マスタ8件 vs 件数区分10件の分離 — Phase 3で実装済み、要クライアント最終確認
- 管理者/スタッフの業務範囲差分は未確定 → RLSは同等権限、`operation_page_permissions`で段階的に絞る
- 支払通知書確定後の金額修正時の再承認フロー → 必要と確認済み（Phase 6参照）、具体的な操作フローは着手時に詳細化する
- 単価マスタの遡及編集ルール、発注書PDFテンプレート、書類期限アラートの通知方式 → いずれもスキーマ/UIの土台のみ用意し、機構本体は保留
- ログ画面のRealtime方式（上記Phase 10参照）— 着手時に決定

---

## 検証方法（各フェーズ共通）

1. `npm run build` / `npm run lint` を通す
2. `supabase db reset` でマイグレーション再適用 → `npm run db:types` で型再生成
3. ローカルSupabase起動中に、Playwright（または`chromium-cli`）でログイン→対象画面の主要操作→スクリーンショット確認まで一連の操作をブラウザ実行で確認する
4. 確認後はテスト用データを`supabase db reset`でクリアしてからコミットする
