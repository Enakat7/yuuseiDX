import type { Database } from "@/types/database.types";

export type WorkScheduleDay = Database["public"]["Tables"]["work_schedule_days"]["Row"];
export type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
export type PurchaseOrderStatus = PurchaseOrder["status"];

export type ScheduleDayCell = {
  deliveryDistrictId: string | null;
  code: string | null; // 配達地区マスタのコード。未割り当てはnull
  backgroundColor: string | null;
};

export type ScheduleRow = {
  driverId: string;
  driverName: string;
  districtNames: string[];
  days: ScheduleDayCell[]; // 対象月の1日〜末日分
  orderStatus: PurchaseOrderStatus | null; // nullは当該期間の発注書が未作成
  orderId: string | null;
};
