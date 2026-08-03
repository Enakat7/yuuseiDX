-- 配送種別マスタに後から追加された「ゆうパック」「不在個数」を、対応する
-- 件数区分（ゆうパケット・不在個数）にdelivery_type_idで紐づける。
-- これにより単価マスタ対象外の配送種別を件数集計等から除外する既存ロジック
-- （pages/api/counts/categories.ts等）が、この2区分にも正しく適用されるようになる。
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
