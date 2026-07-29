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

  const body = (req.body ?? {}) as { ids?: string[] };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return res.status(400).json({ error: "idsは必須です。" });
  }

  const { data, error } = await supabase
    .from("payment_notices")
    .update({ status: "確定", confirmed_at: new Date().toISOString(), confirmed_by: profile.id })
    .in("id", body.ids)
    .eq("status", "仮確定")
    .select();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "確定",
    screenName: "支払通知書",
    params: { count: body.ids.length },
    targetTable: "payment_notices",
  });

  return res.status(200).json({ data });
}
