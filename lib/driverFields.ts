import {
  BANK_ACCOUNT_TYPES,
  CONTRACT_TYPES,
  DRIVER_ROLES,
  GAS_CARD_TYPES,
  PAY_TYPES,
  VEHICLE_OWNERSHIPS,
} from "@/lib/constants";

// マスタ管理(ドライバー)の新規登録・編集で共通して受け渡すフィールド一式。
export type DriverBody = {
  name?: string;
  contract_type?: string;
  area_id?: string;
  contract_start_date?: string;
  phone?: string | null;
  email?: string | null;
  pay_type?: string;
  district_ids?: string[];
  new_district_name?: string;
  company_name?: string | null;
  driver_role?: string | null;
  contract_end_date?: string | null;
  contract_indefinite?: boolean;
  contract_deadline_date?: string | null;
  fixed_cost?: number | null;
  other_conditions?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_relation?: string | null;
  emergency_contact_phone?: string | null;
  address?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
  advance_eligible?: boolean;
  vehicle_number?: string | null;
  vehicle_ownership?: string | null;
  vehicle_lease_cost?: number | null;
  vehicle_lease_start_date?: string | null;
  vehicle_inspection_deadline?: string | null;
  vehicle_insurance_deadline?: string | null;
  gas_card_provided?: boolean;
  gas_card_issued_date?: string | null;
  gas_card_type?: string | null;
};

// 新規登録・編集共通のenum系フィールドバリデーション。不正値は400として弾き、
// 無言での丸めは行わない（import.tsの旧バグと同じ轍を踏まない）。
export function validateDriverEnums(body: DriverBody): string | null {
  if (body.contract_type !== undefined && !(CONTRACT_TYPES as readonly string[]).includes(body.contract_type)) {
    return "契約形態が不正です。";
  }
  if (body.pay_type !== undefined && !(PAY_TYPES as readonly string[]).includes(body.pay_type)) {
    return "支払種別が不正です。";
  }
  if (body.driver_role != null && !(DRIVER_ROLES as readonly string[]).includes(body.driver_role)) {
    return "役割が不正です。";
  }
  if (
    body.vehicle_ownership != null &&
    !(VEHICLE_OWNERSHIPS as readonly string[]).includes(body.vehicle_ownership)
  ) {
    return "所有車両区分が不正です。";
  }
  if (body.gas_card_type != null && !(GAS_CARD_TYPES as readonly string[]).includes(body.gas_card_type)) {
    return "ガソリンカード種類が不正です。";
  }
  if (
    body.bank_account_type != null &&
    !(BANK_ACCOUNT_TYPES as readonly string[]).includes(body.bank_account_type)
  ) {
    return "口座種別が不正です。";
  }
  return null;
}
