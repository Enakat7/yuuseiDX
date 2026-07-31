import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

type PriceRow = {
  price_kind: "受注単価" | "卸単価";
  area_id: string;
  delivery_type_id: string;
  effective_from: string;
  price_yen: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (req.method === "GET") {
    const { data, error } = await supabase.from("unit_prices").select("*");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    const { rows } = (req.body ?? {}) as { rows?: PriceRow[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "rowsが不正です。" });
    }

    const { data, error } = await supabase
      .from("unit_prices")
      .upsert(
        rows.map((row) => ({ ...row, created_by: profile.id })),
        { onConflict: "price_kind,area_id,delivery_type_id,effective_from" }
      )
      .select();
    if (error) return res.status(500).json({ error: error.message });

    await logOperation(supabase, {
      action: "保存",
      screenName: "マスタ管理(単価)",
      params: { effective_from: rows[0]?.effective_from, count: rows.length },
      targetTable: "unit_prices",
    });

    return res.status(200).json({ data });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
