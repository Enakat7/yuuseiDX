import type { Database } from "@/types/database.types";

export type Area = Database["public"]["Tables"]["areas"]["Row"];
export type District = Database["public"]["Tables"]["districts"]["Row"];
export type DeliveryType = Database["public"]["Tables"]["delivery_types"]["Row"];
export type CountCategory = Database["public"]["Tables"]["count_categories"]["Row"];
export type DocumentType = Database["public"]["Tables"]["document_types"]["Row"];
export type Driver = Database["public"]["Tables"]["drivers"]["Row"];
export type DriverDistrict = Database["public"]["Tables"]["driver_districts"]["Row"];
export type DriverDocument = Database["public"]["Tables"]["driver_documents"]["Row"];
export type UnitPrice = Database["public"]["Tables"]["unit_prices"]["Row"];

export type ContractType = Driver["contract_type"];
export type PayType = Driver["pay_type"];
export type PriceKind = UnitPrice["price_kind"];

export type DriverWithRelations = Driver & {
  area: Pick<Area, "id" | "name"> | null;
  districts: Pick<District, "id" | "name">[];
  documents: DriverDocument[];
};
