import type { Database } from "@/types/database.types";

export type AdvanceRequest = Database["public"]["Tables"]["advance_requests"]["Row"];
export type AdvanceStatus = AdvanceRequest["status"];

export type AdvanceRequestRow = AdvanceRequest & {
  driverName: string;
};

export type AdvanceSimulation = {
  driverId: string;
  earnings: number;
  deductions: { label: string; amount: number }[];
  deductionTotal: number;
  available: number;
};
