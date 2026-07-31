import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";
import { type DriverBody, validateDriverEnums } from "@/lib/driverFields";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("drivers")
      .select(
        "*, area:areas(id, name), driver_districts(district:districts(id, name)), driver_documents(*)"
      )
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as DriverBody;

    if (!body.name || !body.area_id || !body.contract_start_date || !body.contract_type || !body.pay_type) {
      return res.status(400).json({ error: "氏名・契約形態・エリア・契約開始日・支払種別は必須です。" });
    }

    const enumError = validateDriverEnums(body);
    if (enumError) return res.status(400).json({ error: enumError });

    const districtIds = [...(body.district_ids ?? [])];

    if (body.new_district_name?.trim()) {
      const { data: newDistrict, error: districtError } = await supabase
        .from("districts")
        .insert({ area_id: body.area_id, name: body.new_district_name.trim() })
        .select()
        .single();
      if (districtError) return res.status(500).json({ error: districtError.message });
      districtIds.push(newDistrict.id);
    }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .insert({
        name: body.name,
        contract_type: body.contract_type,
        area_id: body.area_id,
        contract_start_date: body.contract_start_date,
        phone: body.phone || null,
        email: body.email || null,
        pay_type: body.pay_type,
        company_name: body.company_name || null,
        driver_role: body.driver_role || null,
        contract_end_date: body.contract_end_date || null,
        contract_indefinite: body.contract_indefinite ?? false,
        contract_deadline_date: body.contract_indefinite ? null : body.contract_deadline_date || null,
        fixed_cost: body.fixed_cost ?? null,
        other_conditions: body.other_conditions || null,
        emergency_contact_name: body.emergency_contact_name || null,
        emergency_contact_relation: body.emergency_contact_relation || null,
        emergency_contact_phone: body.emergency_contact_phone || null,
        address: body.address || null,
        bank_name: body.bank_name || null,
        bank_branch: body.bank_branch || null,
        bank_account_type: body.bank_account_type || null,
        bank_account_number: body.bank_account_number || null,
        bank_account_holder: body.bank_account_holder || null,
        advance_eligible: body.advance_eligible ?? false,
        vehicle_number: body.vehicle_number || null,
        vehicle_ownership: body.vehicle_ownership || null,
        vehicle_lease_cost: body.vehicle_lease_cost ?? null,
        vehicle_lease_start_date: body.vehicle_lease_start_date || null,
        vehicle_inspection_deadline: body.vehicle_inspection_deadline || null,
        vehicle_insurance_deadline: body.vehicle_insurance_deadline || null,
        gas_card_provided: body.gas_card_provided ?? false,
        gas_card_issued_date: body.gas_card_issued_date || null,
        gas_card_type: body.gas_card_type || null,
      })
      .select()
      .single();
    if (driverError) return res.status(500).json({ error: driverError.message });

    if (districtIds.length > 0) {
      const { error: linkError } = await supabase
        .from("driver_districts")
        .insert(districtIds.map((district_id) => ({ driver_id: driver.id, district_id })));
      if (linkError) return res.status(500).json({ error: linkError.message });
    }

    // 管理費集計（6.4・6.5）の控除項目デフォルト7件をドライバー個別項目としてクローンする
    const { data: defaults, error: defaultsError } = await supabase
      .from("deduction_item_defaults")
      .select("label, sort_order");
    if (defaultsError) return res.status(500).json({ error: defaultsError.message });
    if (defaults && defaults.length > 0) {
      const { error: deductionError } = await supabase.from("deduction_items").insert(
        defaults.map((d) => ({ driver_id: driver.id, label: d.label, sort_order: d.sort_order }))
      );
      if (deductionError) return res.status(500).json({ error: deductionError.message });
    }

    await logOperation(supabase, {
      action: "新規登録",
      screenName: "マスタ管理(ドライバー)",
      params: { name: body.name },
      targetTable: "drivers",
      targetId: driver.id,
    });

    return res.status(201).json({ data: driver });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
