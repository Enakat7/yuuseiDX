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

  const body = (req.body ?? {}) as { driver_id?: string; work_date?: string; worked?: boolean };
  if (!body.driver_id || !body.work_date || typeof body.worked !== "boolean") {
    return res.status(400).json({ error: "driver_id・work_date・workedは必須です。" });
  }

  const { data, error } = await supabase
    .from("work_schedule_days")
    .upsert(
      { driver_id: body.driver_id, work_date: body.work_date, worked: body.worked, updated_by: profile.id },
      { onConflict: "driver_id,work_date" }
    )
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "稼働日更新",
    screenName: "発注書(稼働表)",
    params: { work_date: body.work_date, worked: body.worked },
    targetTable: "work_schedule_days",
    targetId: body.driver_id,
  });

  return res.status(200).json({ data });
}
