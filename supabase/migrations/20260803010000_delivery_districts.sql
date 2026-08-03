-- ===== 配達地区マスタ（エリアごとの配達コース区分。稼働カレンダー等で日別の担当地区を
-- 色分け表示するために使用する。コード・背景色はクライアント側で自由に割り振ってよいため、
-- 初期データは doxs/配達地区.md の内容をそのまま投入する。
-- 「共通」（休・希休等、特定のエリアに属さない区分）はarea_id nullで表現する。 =====
create table public.delivery_districts (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references public.areas (id) on delete cascade,
  code text not null unique,
  name text not null,
  background_color text not null default '#ffffff' check (background_color ~* '^#[0-9a-f]{6}$'),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_districts enable row level security;

create trigger delivery_districts_set_updated_at
  before update on public.delivery_districts
  for each row execute procedure public.set_updated_at();

create policy "delivery_districts_staff_or_admin_all"
  on public.delivery_districts for all
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

insert into public.delivery_districts (area_id, code, name, background_color, sort_order) values
  ((select id from public.areas where name = '宇品'), 'U01', '丹那一円・楠那・黄金山・本浦一円・東雲本町3', '#ffffff', 1),
  ((select id from public.areas where name = '宇品'), 'U02', '仁保一円・日宇那', '#ffffff', 2),
  ((select id from public.areas where name = '宇品'), 'U03', '東西霞・旭・山城・南北大河', '#ffffff', 3),
  ((select id from public.areas where name = '宇品'), 'U04', '東雲一円', '#ffffff', 4),
  ((select id from public.areas where name = '宇品'), 'U05', '翠・西旭・出汐2.3', '#ffffff', 5),
  ((select id from public.areas where name = '宇品'), 'U06', '大洲・南蟹屋・西蟹屋3.4', '#ffffff', 6),
  ((select id from public.areas where name = '宇品'), 'U07', '段原・段原日出・段原山崎', '#ffffff', 7),
  ((select id from public.areas where name = '宇品'), 'U08', '比治山本町・段原南・出汐1.4', '#ffffff', 8),
  ((select id from public.areas where name = '宇品'), 'U09', '荒神一円・比治山・的場・松川・西蟹屋1.2', '#ffffff', 9),
  ((select id from public.areas where name = '宇品'), 'U10', '荒神一円・比治山・的場・松川・西蟹屋1.2・霞', '#ffffff', 10),
  ((select id from public.areas where name = '宇品'), 'U11', '荒神一円・比治山・的場・松川・西蟹屋1.2・段原2', '#ffffff', 11),
  ((select id from public.areas where name = '宇品'), 'U12', '霞一円・旭・山城・南北大河', '#ffffff', 12),
  ((select id from public.areas where name = '宇品'), 'U13', '出汐・翠・西旭', '#ffffff', 13),
  ((select id from public.areas where name = '宇品'), 'U14', '大洲・南蟹屋・西蟹屋・荒神', '#ffffff', 14),
  ((select id from public.areas where name = '宇品'), 'U15', '段原・段原日出・段原山崎・段原南2', '#ffffff', 15),
  ((select id from public.areas where name = '宇品'), 'U16', '比治山本町・段原南1・比治山町・的場町・松川町', '#ffffff', 16),
  ((select id from public.areas where name = '宇品'), 'U17', '霞・東雲本町1・2', '#ffffff', 17),
  ((select id from public.areas where name = '宇品'), 'U18', '府中郵便局シフト確認', '#f5aa5f', 18),

  ((select id from public.areas where name = '安佐南'), 'A01', '西原1-4', '#ffffff', 19),
  ((select id from public.areas where name = '安佐南'), 'A02', '西原5.6.8.9', '#ffffff', 20),
  ((select id from public.areas where name = '安佐南'), 'A03', '中須・古市1-3', '#ffffff', 21),
  ((select id from public.areas where name = '安佐南'), 'A04', '八木', '#ffffff', 22),
  ((select id from public.areas where name = '安佐南'), 'A05', '緑井1.3.4.7.8', '#ffffff', 23),
  ((select id from public.areas where name = '安佐南'), 'A06', '祇園1-3', '#ffffff', 24),
  ((select id from public.areas where name = '安佐南'), 'A07', '祇園4-8・古市4', '#ffffff', 25),
  ((select id from public.areas where name = '安佐南'), 'A08', '東原・西原7', '#ffffff', 26),
  ((select id from public.areas where name = '安佐南'), 'A09', '西原1-4.5.6', '#ffffff', 27),
  ((select id from public.areas where name = '安佐南'), 'A10', '東原・西原8.9', '#ffffff', 28),
  ((select id from public.areas where name = '安佐南'), 'A11', '府中郵便局シフト確認', '#f5aa5f', 29),

  ((select id from public.areas where name = '西'), 'N01', '新庄町/三滝本町/山手町/三滝山/己斐東1・2丁目/竜王町', '#ffffff', 30),
  ((select id from public.areas where name = '西'), 'N02', '己斐上1・3・4・5・6丁目/己斐大迫', '#ffffff', 31),
  ((select id from public.areas where name = '西'), 'N03', '己斐中1丁目/己斐西/己斐本町', '#ffffff', 32),
  ((select id from public.areas where name = '西'), 'N04', '己斐中2・3丁目/己斐上2丁目/高須3・4丁目/高須台', '#ffffff', 33),
  ((select id from public.areas where name = '西'), 'N05', '古江西町/古江東町/高須1・2丁目/古江上', '#ffffff', 34),
  ((select id from public.areas where name = '西'), 'N06', '庚午南1・2丁目/草津東1・2丁目/古江新町/庚午中2・3丁目/庚午北2・3丁目', '#ffffff', 35),
  ((select id from public.areas where name = '西'), 'N07', '庚午北1・4丁目/庚午中1・4丁目', '#ffffff', 36),
  ((select id from public.areas where name = '西'), 'N08', 'bコース', '#ffffff', 37),
  ((select id from public.areas where name = '西'), 'N09', '己斐大迫/竜王', '#ffffff', 38),

  ((select id from public.areas where name = '中央(中区)'), 'C01', '千田1-3丁目/南千田/大手町5丁目', '#ffffff', 39),
  ((select id from public.areas where name = '中央(中区)'), 'C02', '東白島/白島九軒/白島中町', '#ffffff', 40),
  ((select id from public.areas where name = '中央(中区)'), 'C03', '大手町1-4丁目', '#ffffff', 41),
  ((select id from public.areas where name = '中央(中区)'), 'C04', '堺/榎町/猫屋/小網', '#ffffff', 42),
  ((select id from public.areas where name = '中央(中区)'), 'C05', '十日市/本川/寺町', '#ffffff', 43),
  ((select id from public.areas where name = '中央(中区)'), 'C06', '広瀬/広瀬北/西十日市', '#ffffff', 44),
  ((select id from public.areas where name = '中央(中区)'), 'C07', '白島北/基町/西白島', '#ffffff', 45),
  ((select id from public.areas where name = '中央(中区)'), 'C08', '上八丁堀', '#ffffff', 46),
  ((select id from public.areas where name = '中央(中区)'), 'C09', '三川/胡/堀川/新天地', '#ffffff', 47),
  ((select id from public.areas where name = '中央(中区)'), 'C10', '光南/吉島', '#ffffff', 48),
  ((select id from public.areas where name = '中央(中区)'), 'C11', '舟入/舟入中/幸/本町一部', '#ffffff', 49),
  ((select id from public.areas where name = '中央(中区)'), 'C12', '舟入川口/西川口/幸/本町一部', '#ffffff', 50),
  ((select id from public.areas where name = '中央(中区)'), 'C13', '東白島/白島九軒/白島中・上八丁堀', '#ffffff', 51),
  ((select id from public.areas where name = '中央(中区)'), 'C14', '東白島/白島九軒/白島中・白島北/西白島', '#ffffff', 52),
  ((select id from public.areas where name = '中央(中区)'), 'C15', '東白島/白島九軒/白島中・上八丁堀/三川/胡/堀川/新天地', '#ffffff', 53),
  ((select id from public.areas where name = '中央(中区)'), 'C16', '大手町1-4丁目・三川/胡/堀川/新天地', '#ffffff', 54),

  ((select id from public.areas where name = '中央(東区)'), 'H01', '牛田新町', '#ffffff', 55),
  ((select id from public.areas where name = '中央(東区)'), 'H02', '牛田本町1.2.3.4・牛田旭・牛田中・牛田早稲田1', '#ffffff', 56),
  ((select id from public.areas where name = '中央(東区)'), 'H03', '牛田早稲田2.3.4・牛田東', '#ffffff', 57),
  ((select id from public.areas where name = '中央(東区)'), 'H04', '牛田本町5.6・牛田南・牛田東1.2の一部', '#ffffff', 58),
  ((select id from public.areas where name = '中央(東区)'), 'H05', '牛田新町・牛田本町5.6', '#ffffff', 59),
  ((select id from public.areas where name = '中央(東区)'), 'H06', '牛田早稲田2.3.4・牛田東・牛田南', '#ffffff', 60),

  ((select id from public.areas where name = '伴'), 'T01', '大塚西', '#ffffff', 61),
  ((select id from public.areas where name = '伴'), 'T02', '伴東', '#ffffff', 62),
  ((select id from public.areas where name = '伴'), 'T03', '伴南、伴西', '#ffffff', 63),

  ((select id from public.areas where name = '府中'), 'F01', '本町・鶴江・山田・瀬戸ハイム・大通（夕方からAコース）', '#ffffff', 64),
  ((select id from public.areas where name = '府中'), 'F02', '青崎東・中・茂陰・鹿籠・桃山・緑ヶ丘', '#ffffff', 65),
  ((select id from public.areas where name = '府中'), 'F03', '八幡・柳ヶ丘・浜田', '#ffffff', 66),

  (null, '休', '休日', '#808080', 67),
  (null, '希休', '希望休', '#e493f5', 68);

create trigger delivery_districts_audit
  after insert or update or delete on public.delivery_districts
  for each row execute procedure public.audit_trigger();
