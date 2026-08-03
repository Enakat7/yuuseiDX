import type { Database } from "@/types/database.types";
import type {
  BankAccountType,
  ContractType,
  DriverRole,
  GasCardType,
  PayType,
  VehicleOwnership,
} from "@/lib/constants";

export type { BankAccountType, ContractType, DriverRole, GasCardType, PayType, VehicleOwnership };

export type Area = Database["public"]["Tables"]["areas"]["Row"];
export type District = Database["public"]["Tables"]["districts"]["Row"];
export type DeliveryType = Database["public"]["Tables"]["delivery_types"]["Row"];
export type DeliveryDistrict = Database["public"]["Tables"]["delivery_districts"]["Row"];
export type DeliveryDistrictWithArea = DeliveryDistrict & { area: Pick<Area, "id" | "name"> | null };
export type CountCategory = Database["public"]["Tables"]["count_categories"]["Row"];
export type DocumentType = Database["public"]["Tables"]["document_types"]["Row"];
export type Driver = Database["public"]["Tables"]["drivers"]["Row"];
export type DriverDistrict = Database["public"]["Tables"]["driver_districts"]["Row"];
export type DriverDocumentFile = Database["public"]["Tables"]["driver_document_files"]["Row"];
export type DriverDocument = Database["public"]["Tables"]["driver_documents"]["Row"] & {
  files: DriverDocumentFile[];
};
export type UnitPrice = Database["public"]["Tables"]["unit_prices"]["Row"];

export type PriceKind = UnitPrice["price_kind"];

export type DriverWithRelations = Driver & {
  area: Pick<Area, "id" | "name"> | null;
  districts: Pick<District, "id" | "name">[];
  documents: DriverDocument[];
};
