import type { NextApiRequest, NextApiResponse } from "next";
import { requireDriver } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireDriver(req, res);
  if (!auth) return;
  const { supabase, driver } = auth;

  const status = req.query.status;

  // RLS(payment_notices_select_own)により未承認の通知書はそもそも取得できない。
  let query = supabase
    .from("payment_notices")
    .select("*")
    .eq("driver_id", driver.id)
    .order("period_start", { ascending: false });
  if (typeof status === "string" && status && status !== "すべて") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ data: data ?? [] });
}
