import type { Database } from "@/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type OperationAccountRole = Extract<Profile["role"], "管理者" | "スタッフ">;

export type OperationPagePermission = Database["public"]["Tables"]["operation_page_permissions"]["Row"];

export type AccountRow = {
  id: string;
  name: string;
  role: OperationAccountRole;
};
