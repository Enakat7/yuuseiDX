import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

type ImportRow = {
  name: string;
  contract_type: string;
  area: string;
  districts: string;
  contract_start_date: string;
  phone: string;
  email: string;
  pay_type: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const { rows } = (req.body ?? {}) as { rows?: ImportRow[] };
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: "rowsが不正です。" });
  }

  const [{ data: areas }, { data: districts }] = await Promise.all([
    supabase.from("areas").select("*"),
    supabase.from("districts").select("*"),
  ]);

  let imported = 0;
  for (const row of rows) {
    const area = (areas ?? []).find((a) => a.name === row.area);
    if (!area || !row.name || !row.contract_start_date) continue;

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .insert({
        name: row.name,
        contract_type: row.contract_type === "法人" ? "法人" : "個人事業主",
        area_id: area.id,
        contract_start_date: row.contract_start_date,
        phone: row.phone || null,
        email: row.email || null,
        pay_type: row.pay_type === "月払い" ? "月払い" : "週払い",
      })
      .select()
      .single();
    if (driverError || !driver) continue;

    const districtNames = (row.districts ?? "")
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const districtName of districtNames) {
      let district = (districts ?? []).find((d) => d.area_id === area.id && d.name === districtName);
      if (!district) {
        const { data: newDistrict } = await supabase
          .from("districts")
          .insert({ area_id: area.id, name: districtName })
          .select()
          .single();
        if (newDistrict) {
          district = newDistrict;
          districts?.push(newDistrict);
        }
      }
      if (district) {
        await supabase.from("driver_districts").insert({ driver_id: driver.id, district_id: district.id });
      }
    }
    imported += 1;
  }

  await logOperation(supabase, {
    action: "CSVインポート",
    screenName: "マスタ管理(ドライバー)",
    params: { count: imported },
  });

  return res.status(200).json({ imported });
}
