import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

type DriverDocumentBody = {
  expires_on?: string | null;
  license_holder_name?: string | null;
  license_birth_date?: string | null;
  license_address?: string | null;
  license_issued_date?: string | null;
  license_conditions?: string | null;
  license_number?: string | null;
  vehicle_cert_number?: string | null;
  vehicle_cert_type?: string | null;
  vehicle_cert_purpose?: string | null;
  vehicle_cert_usage?: string | null;
  vehicle_cert_model_name?: string | null;
  vehicle_cert_max_load?: string | null;
  vehicle_cert_chassis_number?: string | null;
  vehicle_cert_displacement?: string | null;
  vehicle_cert_owner_name?: string | null;
  vehicle_cert_owner_address?: string | null;
  vehicle_cert_base_location?: string | null;
  insurance_policy_number?: string | null;
  insurance_period_start?: string | null;
  insurance_insured_name?: string | null;
  insurance_vehicle_owner?: string | null;
  insurance_driver_condition?: string | null;
  insurance_insured_vehicle?: string | null;
  insurance_coverage_bodily?: string | null;
  insurance_coverage_property?: string | null;
  insurance_coverage_personal?: string | null;
  insurance_coverage_vehicle?: string | null;
  insurance_coverage_cargo?: string | null;
  cali_registration_place?: string | null;
  cali_registration_classification?: string | null;
  cali_registration_usage?: string | null;
  cali_registration_number?: string | null;
  cali_period_start?: string | null;
  cali_policyholder_address?: string | null;
  cali_policyholder_name?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  const body = (req.body ?? {}) as DriverDocumentBody;

  const update: Record<string, unknown> = {};
  const assignIfPresent = (key: keyof DriverDocumentBody) => {
    if (body[key] !== undefined) update[key] = body[key];
  };

  assignIfPresent("expires_on");
  assignIfPresent("license_holder_name");
  assignIfPresent("license_birth_date");
  assignIfPresent("license_address");
  assignIfPresent("license_issued_date");
  assignIfPresent("license_conditions");
  assignIfPresent("license_number");
  assignIfPresent("vehicle_cert_number");
  assignIfPresent("vehicle_cert_type");
  assignIfPresent("vehicle_cert_purpose");
  assignIfPresent("vehicle_cert_usage");
  assignIfPresent("vehicle_cert_model_name");
  assignIfPresent("vehicle_cert_max_load");
  assignIfPresent("vehicle_cert_chassis_number");
  assignIfPresent("vehicle_cert_displacement");
  assignIfPresent("vehicle_cert_owner_name");
  assignIfPresent("vehicle_cert_owner_address");
  assignIfPresent("vehicle_cert_base_location");
  assignIfPresent("insurance_policy_number");
  assignIfPresent("insurance_period_start");
  assignIfPresent("insurance_insured_name");
  assignIfPresent("insurance_vehicle_owner");
  assignIfPresent("insurance_driver_condition");
  assignIfPresent("insurance_insured_vehicle");
  assignIfPresent("insurance_coverage_bodily");
  assignIfPresent("insurance_coverage_property");
  assignIfPresent("insurance_coverage_personal");
  assignIfPresent("insurance_coverage_vehicle");
  assignIfPresent("insurance_coverage_cargo");
  assignIfPresent("cali_registration_place");
  assignIfPresent("cali_registration_classification");
  assignIfPresent("cali_registration_usage");
  assignIfPresent("cali_registration_number");
  assignIfPresent("cali_period_start");
  assignIfPresent("cali_policyholder_address");
  assignIfPresent("cali_policyholder_name");

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "更新項目がありません。" });
  }

  const { data, error } = await supabase.from("driver_documents").update(update).eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "書類情報更新",
    screenName: "マスタ管理(ドライバー)",
    targetTable: "driver_documents",
    targetId: id,
  });

  return res.status(200).json({ data });
}
