import type { Database } from "@/types/database.types";

export type DeductionItem = Database["public"]["Tables"]["deduction_items"]["Row"];
export type DeductionAmount = Database["public"]["Tables"]["deduction_amounts"]["Row"];

export type CostRowItem = {
  itemId: string;
  label: string;
  amount: number;
};

export type CostRow = {
  driverId: string;
  driverName: string;
  areaName: string | null;
  items: CostRowItem[];
  total: number;
};
