-- 稼働表の日別セルに配達地区マスタのコードを割り当てられるようにする。
-- workedは既存の発注書フロー（trigger・稼働日数集計等）が参照するため引き続き維持し、
-- API側でdelivery_district_idから導出して整合させる
-- （area_idがnullの「休」「希休」等は非稼働として扱う）。
alter table public.work_schedule_days
  add column delivery_district_id uuid references public.delivery_districts (id);
