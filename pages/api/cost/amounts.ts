import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  const body = (req.body ?? {}) as {
    period_month?: string;
    entries?: { item_id: string; amount: number }[];
  };
  if (!body.period_month || !Array.isArray(body.entries)) {
    return res.status(400).json({ error: "period_month・entriesは必須です。" });
  }

  if (body.entries.length === 0) {
    return res.status(200).json({ data: [] });
  }

  const rows = body.entries.map((e) => ({
    deduction_item_id: e.item_id,
    period_month: body.period_month as string,
    amount: Number(e.amount) || 0,
    entered_by: profile.id,
  }));

  const { data, error } = await supabase
    .from("deduction_amounts")
    .upsert(rows, { onConflict: "deduction_item_id,period_month" })
    .select();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "保存",
    screenName: "管理費集計",
    params: { period_month: body.period_month, count: body.entries.length },
    targetTable: "deduction_amounts",
  });

  return res.status(200).json({ data });
}
