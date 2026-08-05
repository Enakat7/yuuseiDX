-- ドライバーマイページの稼働カレンダーで配達地区コード・色を表示するため、
-- 配達地区マスタ（コード・名称・色のみで機微情報を含まない）の閲覧を
-- 認証済み全ユーザーに許可する（更新系は引き続きスタッフ/管理者限定）。
create policy "delivery_districts_select_authenticated"
  on public.delivery_districts for select
  to authenticated
  using (active = true);