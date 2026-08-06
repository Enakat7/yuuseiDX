import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";
import { CONTRACT_TYPES, PAY_TYPES } from "@/lib/constants";

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

  const { rows, mode } = (req.body ?? {}) as { rows?: ImportRow[]; mode?: "append" | "overwrite" };
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: "rowsが不正です。" });
  }
  const overwrite = mode === "overwrite";

  const [{ data: areas }, { data: districts }, { data: defaults }, { data: existingDrivers }] = await Promise.all([
    supabase.from("areas").select("*"),
    supabase.from("districts").select("*"),
    supabase.from("deduction_item_defaults").select("label, sort_order"),
    supabase.from("drivers").select("id, name"),
  ]);
  // 氏名で既存ドライバーと照合する（CSVにIDを含めない運用のため）。上書き保存モードでのみ使用する。
  const driverIdByName = new Map((existingDrivers ?? []).map((d) => [d.name, d.id]));

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const area = (areas ?? []).find((a) => a.name === row.area);
    const contractTypeValid = (CONTRACT_TYPES as readonly string[]).includes(row.contract_type);
    const payTypeValid = (PAY_TYPES as readonly string[]).includes(row.pay_type);
    if (!area || !row.name || !row.contract_start_date || !contractTypeValid || !payTypeValid) {
      skipped += 1;
      continue;
    }

    const driverFields = {
      name: row.name,
      contract_type: row.contract_type,
      area_id: area.id,
      contract_start_date: row.contract_start_date,
      phone: row.phone || null,
      email: row.email || null,
      pay_type: row.pay_type,
    };

    const existingDriverId = overwrite ? driverIdByName.get(row.name) : undefined;
    let driverId: string;
    let isNewDriver: boolean;

    if (existingDriverId) {
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .update(driverFields)
        .eq("id", existingDriverId)
        .select()
        .single();
      if (driverError || !driver) {
        skipped += 1;
        continue;
      }
      driverId = driver.id;
      isNewDriver = false;
      // 地区の紐づけをCSVの内容で置き換える
      await supabase.from("driver_districts").delete().eq("driver_id", driverId);
    } else {
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .insert(driverFields)
        .select()
        .single();
      if (driverError || !driver) {
        skipped += 1;
        continue;
      }
      driverId = driver.id;
      isNewDriver = true;
    }

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
        await supabase.from("driver_districts").insert({ driver_id: driverId, district_id: district.id });
      }
    }

    // 管理費集計（6.4・6.5）の控除項目デフォルト7件をドライバー個別項目としてクローンする
    // （単発作成のPOST /api/master/driversと同じ処理。新規作成分のみ行い、更新分は
    // 既存の控除項目をそのまま維持する）。
    if (isNewDriver && defaults && defaults.length > 0) {
      await supabase.from("deduction_items").insert(
        defaults.map((d) => ({ driver_id: driverId, label: d.label, sort_order: d.sort_order }))
      );
    }

    if (isNewDriver) {
      imported += 1;
    } else {
      updated += 1;
    }
  }

  await logOperation(supabase, {
    action: "CSVインポート",
    screenName: "マスタ管理(ドライバー)",
    params: { mode: overwrite ? "上書き保存" : "追加", imported, updated, skipped },
  });

  return res.status(200).json({ imported, updated, skipped });
}
