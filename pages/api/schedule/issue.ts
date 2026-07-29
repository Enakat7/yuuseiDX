import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

// 発注書の手動発行。対象期間の発注書がまだ存在しないドライバーに限り新規作成し、
// 送信済とする（自動発行ではなくスタッフの明示操作でのみ発行される。要件6.1）。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  const body = (req.body ?? {}) as { driver_ids?: string[]; period_start?: string; period_end?: string };
  if (!Array.isArray(body.driver_ids) || body.driver_ids.length === 0 || !body.period_start || !body.period_end) {
    return res.status(400).json({ error: "driver_ids・period_start・period_endは必須です。" });
  }

  const { data: existing } = await supabase
    .from("purchase_orders")
    .select("driver_id")
    .eq("period_start", body.period_start)
    .eq("period_end", body.period_end)
    .in("driver_id", body.driver_ids);
  const existingIds = new Set((existing ?? []).map((e) => e.driver_id));

  const { data: drivers, error: driverError } = await supabase
    .from("drivers")
    .select("id, area_id")
    .in("id", body.driver_ids);
  if (driverError) return res.status(500).json({ error: driverError.message });

  const targets = (drivers ?? []).filter((d) => !existingIds.has(d.id));
  if (targets.length === 0) {
    return res.status(200).json({ issued: 0 });
  }

  const now = new Date().toISOString();
  const rows = targets.map((d) => ({
    order_no: `PO-${body.period_start!.replace(/-/g, "")}-${d.id.slice(0, 8)}`,
    driver_id: d.id,
    area_id: d.area_id,
    period_start: body.period_start as string,
    period_end: body.period_end as string,
    status: "送信済",
    issued_at: now,
    issued_by: profile.id,
    sent_at: now,
  }));

  const { error: insertError } = await supabase.from("purchase_orders").insert(rows);
  if (insertError) return res.status(500).json({ error: insertError.message });

  await logOperation(supabase, {
    action: "発行",
    screenName: "発注書(稼働表)",
    params: { period_start: body.period_start, period_end: body.period_end, count: targets.length },
    targetTable: "purchase_orders",
  });

  return res.status(200).json({ issued: targets.length });
}
