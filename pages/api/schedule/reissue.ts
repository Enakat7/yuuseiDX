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

  const body = (req.body ?? {}) as { order_id?: string };
  if (!body.order_id) {
    return res.status(400).json({ error: "order_idは必須です。" });
  }

  const { data: order, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("reissue_count")
    .eq("id", body.order_id)
    .single();
  if (fetchError || !order) return res.status(404).json({ error: "発注書が見つかりません。" });

  const { data, error } = await supabase
    .from("purchase_orders")
    .update({
      status: "送信済",
      sent_at: new Date().toISOString(),
      reissue_count: order.reissue_count + 1,
    })
    .eq("id", body.order_id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "再発行",
    screenName: "発注書(稼働表)",
    targetTable: "purchase_orders",
    targetId: body.order_id,
  });

  return res.status(200).json({ data });
}
