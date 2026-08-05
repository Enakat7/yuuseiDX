-- 「ゆうパケット」「不在個数」の件数区分(count_categories)は、配送種別マスタ
-- (delivery_types)に対応する行を追加した上でdelivery_type_idを紐づける想定
-- だったが、対応するdelivery_typesの追加が行われておらず、以前の紐づけ
-- update（20260802010000_link_count_categories_to_new_delivery_types.sql）は
-- 対象行が見つからず何も更新できていなかった。
--
-- 結果としてこの2区分はdelivery_type_idがnullのままとなり、
-- pages/api/counts/categories.tsのフィルタ（delivery_typesがnullの区分は
-- 無条件で表示する）により、配送種別マスタに存在しないにもかかわらず
-- 件数集計・単価・支払通知書・前払依頼書に表示され続けていた。
--
-- 配送種別マスタに対応行を追加し（単価設定不要のためprice_master_target=false）、
-- count_categoriesを紐づけ直す。これにより配送種別マスタの一覧にも表示され、
-- 単価マスタ対象外の区分として既存の除外ロジックが正しく適用されるようになる。
insert into public.delivery_types (code, name, price_master_target, sort_order) values
  ('U01', '不在個数', false, 9),
  ('Y01', 'ゆうパケット', false, 10);

update public.count_categories
set delivery_type_id = dt.id
from public.delivery_types dt
where count_categories.label = '不在個数'
  and count_categories.delivery_type_id is null
  and dt.code = 'U01';

update public.count_categories
set delivery_type_id = dt.id
from public.delivery_types dt
where count_categories.label = 'ゆうパケット'
  and count_categories.delivery_type_id is null
  and dt.code = 'Y01';
