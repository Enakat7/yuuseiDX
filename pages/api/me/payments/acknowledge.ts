import type { NextApiRequest, NextApiResponse } from "next";
import { requireDriver } from "@/lib/apiAuth";

// 支払通知書の「確認しました」ボタン（明示義務対応、要件6.2）。個別・一括どちらもidsのループでカバーする。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireDriver(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const body = (req.body ?? {}) as { ids?: string[] };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return res.status(400).json({ error: "idsは必須です。" });
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : req.socket.remoteAddress) ?? null;

  for (const id of body.ids) {
    const { error } = await supabase.rpc("acknowledge_payment_notice", { p_notice_id: id, p_ip: ip });
    if (error) return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ acknowledged: body.ids.length });
}
