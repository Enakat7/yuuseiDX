import type { Database } from "@/types/database.types";

export type CountEntry = Database["public"]["Tables"]["count_entries"]["Row"];

// 件数集計グリッド1行分（ドライバー単位、10区分を横持ちにしたもの）
export type CountRow = {
  driverId: string;
  driverName: string;
  areaName: string | null;
  counts: Record<string, number>; // category_id -> count
  hasEntries: boolean;
  approved: boolean;
};

export type CountSummaryRow = {
  driverId: string;
  driverName: string;
  areaName: string | null;
  totals: Record<string, number>; // category_id -> 合計
};
