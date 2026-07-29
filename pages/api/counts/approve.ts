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

  const body = (req.body ?? {}) as { work_date?: string; driver_ids?: string[] };
  if (!body.work_date || !Array.isArray(body.driver_ids) || body.driver_ids.length === 0) {
    return res.status(400).json({ error: "work_date・driver_idsは必須です。" });
  }

  const { data, error } = await supabase
    .from("count_entries")
    .update({ approved: true, approved_by: profile.id, approved_at: new Date().toISOString() })
    .eq("work_date", body.work_date)
    .in("driver_id", body.driver_ids)
    .select();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "承認",
    screenName: "件数集計",
    params: { work_date: body.work_date, drivers: body.driver_ids.length },
    targetTable: "count_entries",
  });

  return res.status(200).json({ data });
}
