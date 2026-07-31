// オペレーションダッシュボードの画面キー一覧。
// operation_page_permissions（アカウントごとのページ単位アクセス設定）が参照する
//唯一の正とするリスト。画面追加はこの配列を更新するだけでよく、DB側にenumやマイグレーションは不要。
export const OPERATION_PAGE_KEYS = [
  "dashboard",
  "aggregation",
  "cost",
  "schedule",
  "payment",
  "advance",
  "master",
  "settings",
  "log",
  "loginLocks",
] as const;

export type OperationPageKey = (typeof OPERATION_PAGE_KEYS)[number];

export const OPERATION_PAGE_LABELS: Record<OperationPageKey, string> = {
  dashboard: "ダッシュボード",
  aggregation: "件数集計",
  cost: "管理費集計",
  schedule: "発注書(稼働表)",
  payment: "支払通知書",
  advance: "前払依頼書",
  master: "マスタ管理",
  settings: "設定",
  log: "ログ",
  loginLocks: "ログインロック管理",
};
