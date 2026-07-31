import type { Database } from "@/types/database.types";

export type WorkScheduleDay = Database["public"]["Tables"]["work_schedule_days"]["Row"];
export type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
export type PurchaseOrderStatus = PurchaseOrder["status"];

export type ScheduleRow = {
  driverId: string;
  driverName: string;
  districtNames: string[];
  week: boolean[]; // Mon..Sun, 7要素
  orderStatus: PurchaseOrderStatus | null; // nullは当該期間の発注書が未作成
  orderId: string | null;
};
