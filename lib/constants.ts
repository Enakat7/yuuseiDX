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

// ドライバーマスタの各種区分。DB側はCHECK制約で許可値を強制するのみでリテラル型
// までは生成されないため、ここを唯一の正としてAPI側のバリデーションとフロント側の
// 選択肢の両方で共有する。
export const CONTRACT_TYPES = ["個人委託", "法人委託", "直接雇用"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const DRIVER_ROLES = [
  "固定ドライバー",
  "代走ドライバー",
  "ドライバー",
  "リーダー",
  "正社員",
  "契約社員",
  "パート",
  "アルバイト",
] as const;
export type DriverRole = (typeof DRIVER_ROLES)[number];

export const VEHICLE_OWNERSHIPS = ["持込", "貸出"] as const;
export type VehicleOwnership = (typeof VEHICLE_OWNERSHIPS)[number];

export const GAS_CARD_TYPES = ["大野石油", "イチネン"] as const;
export type GasCardType = (typeof GAS_CARD_TYPES)[number];

export const BANK_ACCOUNT_TYPES = ["普通", "当座"] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

export const PAY_TYPES = ["週払い", "月払い"] as const;
export type PayType = (typeof PAY_TYPES)[number];
