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

  // 修正依頼で作成中に戻った発注書は、スタッフが再確認・再確定するまで一覧に出さない
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("driver_id", driver.id)
    .eq("status", "作成済")
    .order("period_start", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ data: data ?? [] });
}
