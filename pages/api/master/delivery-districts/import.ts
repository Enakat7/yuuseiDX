import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const COMMON_LABEL = "共通";

type ImportRow = { area: string; code: string; color: string; name: string };

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

  const [{ data: areas }, { data: existing, count }] = await Promise.all([
    supabase.from("areas").select("id, name"),
    supabase.from("delivery_districts").select("id, code", { count: "exact" }),
  ]);
  const areaIdByName = new Map((areas ?? []).map((a) => [a.name, a.id]));
  const idByCode = new Map((existing ?? []).map((d) => [d.code, d.id]));
  let nextSortOrder = (count ?? 0) + 1;

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const areaId = row.area === COMMON_LABEL ? null : (areaIdByName.get(row.area) ?? undefined);
    const colorValid = !row.color || HEX_COLOR_PATTERN.test(row.color);
    if (!row.code || !row.name || areaId === undefined || !colorValid) {
      skipped += 1;
      continue;
    }
    const backgroundColor = row.color || "#ffffff";
    const existingId = idByCode.get(row.code);

    if (existingId) {
      if (!overwrite) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase
        .from("delivery_districts")
        .update({ area_id: areaId, name: row.name, background_color: backgroundColor })
        .eq("id", existingId);
      if (error) {
        skipped += 1;
        continue;
      }
      updated += 1;
    } else {
      const { data, error } = await supabase
        .from("delivery_districts")
        .insert({
          area_id: areaId,
          code: row.code,
          name: row.name,
          background_color: backgroundColor,
          sort_order: nextSortOrder,
        })
        .select("id")
        .single();
      if (error || !data) {
        skipped += 1;
        continue;
      }
      idByCode.set(row.code, data.id);
      nextSortOrder += 1;
      imported += 1;
    }
  }

  await logOperation(supabase, {
    action: "CSVインポート",
    screenName: "マスタ管理(配達地区)",
    params: { mode: overwrite ? "上書き保存" : "追加", imported, updated, skipped },
  });

  return res.status(200).json({ imported, updated, skipped });
}
