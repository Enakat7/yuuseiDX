import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

type ImportRow = { code: string; name: string; target: string };

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

  const { data: existing, count } = await supabase
    .from("delivery_types")
    .select("id, code", { count: "exact" });
  const idByCode = new Map((existing ?? []).map((d) => [d.code, d.id]));
  let nextSortOrder = (count ?? 0) + 1;

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.code || !row.name) {
      skipped += 1;
      continue;
    }
    const priceMasterTarget = row.target === "対象";
    const existingId = idByCode.get(row.code);

    if (existingId) {
      if (!overwrite) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase
        .from("delivery_types")
        .update({ name: row.name, price_master_target: priceMasterTarget })
        .eq("id", existingId);
      if (error) {
        skipped += 1;
        continue;
      }
      updated += 1;
    } else {
      const { data, error } = await supabase
        .from("delivery_types")
        .insert({
          code: row.code,
          name: row.name,
          price_master_target: priceMasterTarget,
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
    screenName: "マスタ管理(配送種別)",
    params: { mode: overwrite ? "上書き保存" : "追加", imported, updated, skipped },
  });

  return res.status(200).json({ imported, updated, skipped });
}
