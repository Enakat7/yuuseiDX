import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

// 「一括送信」。対象期間内で作成済(status='作成済')の発注書のみsent_atを設定する。
// statusはそのまま作成済を維持し、送信済かどうかはsent_atの有無で判定する。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const body = (req.body ?? {}) as { driver_ids?: string[]; period_start?: string; period_end?: string };
  if (!Array.isArray(body.driver_ids) || body.driver_ids.length === 0 || !body.period_start || !body.period_end) {
    return res.status(400).json({ error: "driver_ids・period_start・period_endは必須です。" });
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ sent_at: new Date().toISOString() })
    .eq("period_start", body.period_start)
    .eq("period_end", body.period_end)
    .eq("status", "作成済")
    .in("driver_id", body.driver_ids)
    .select();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "一括送信",
    screenName: "発注書(稼働表)",
    params: { period_start: body.period_start, period_end: body.period_end, count: data.length },
    targetTable: "purchase_orders",
  });

  return res.status(200).json({ sent: data.length });
}
