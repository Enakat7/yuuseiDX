// マスタ管理の正式な7エリア（ドライバー/単価マスタが紐づく単位）。
// 単価マスタのモックアップのみ「広島西」表記だったが、他の全画面は「西」のため「西」に統一する。
export const AREAS = [
  "西",
  "安佐南",
  "中央(中区)",
  "中央(東区)",
  "府中",
  "伴",
  "宇品",
] as const;

export type Area = (typeof AREAS)[number];

// 稼働表(発注書)のエリアタブ。7エリア＋どれにも属さないドライバー用の「その他」。
export const AREA_TABS = [...AREAS, "その他"] as const;

export type AreaTab = (typeof AREA_TABS)[number];

// 件数集計・管理費集計のエリア絞り込みタブ。AREA_TABSに「全エリア」を加えたもの。
export const AREA_FILTER_TABS = ["全エリア", ...AREA_TABS] as const;

export type AreaFilterTab = (typeof AREA_FILTER_TABS)[number];

export type StatusTone = "confirmed" | "provisional" | "pending" | "alert";
