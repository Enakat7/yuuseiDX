import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

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
    const body = (req.body ?? {}) as {
      name?: string;
      contract_type?: string;
      area_id?: string;
      contract_start_date?: string;
      phone?: string | null;
      email?: string | null;
      pay_type?: string;
      district_ids?: string[];
      new_district_name?: string;
    };

    if (!body.name || !body.area_id || !body.contract_start_date || !body.contract_type || !body.pay_type) {
      return res.status(400).json({ error: "氏名・契約形態・エリア・契約開始日・支払種別は必須です。" });
    }

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
