import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const body = (req.body ?? {}) as { driver_id?: string; label?: string };
  if (!body.driver_id || !body.label) {
    return res.status(400).json({ error: "driver_id・labelは必須です。" });
  }

  const { count } = await supabase
    .from("deduction_items")
    .select("*", { count: "exact", head: true })
    .eq("driver_id", body.driver_id);

  const { data, error } = await supabase
    .from("deduction_items")
    .insert({ driver_id: body.driver_id, label: body.label, sort_order: (count ?? 0) + 1 })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "控除項目追加",
    screenName: "管理費集計",
    params: { label: body.label },
    targetTable: "deduction_items",
    targetId: body.driver_id,
  });

  return res.status(201).json({ data });
}
