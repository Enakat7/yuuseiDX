import type { NextApiRequest, NextApiResponse } from "next";
import { requireDriver } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireDriver(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null;

  const { error: rpcError } = await supabase.rpc("approve_purchase_order", { p_order_id: id, p_ip: ip });
  if (rpcError) return res.status(400).json({ error: rpcError.message });

  const { data, error } = await supabase.from("purchase_orders").select("*").eq("id", id).single();
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ data });
}
