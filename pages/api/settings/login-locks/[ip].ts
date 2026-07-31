import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";
import { unlockLoginIp } from "@/lib/rateLimit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (profile.role !== "管理者") {
    return res.status(403).json({ error: "管理者のみ解除できます。" });
  }

  const ip = req.query.ip;
  if (typeof ip !== "string") {
    return res.status(400).json({ error: "ipが不正です。" });
  }

  await unlockLoginIp(ip);

  await logOperation(supabase, {
    action: "ログインロック解除",
    screenName: "ログインロック管理",
    params: { ip },
  });

  return res.status(200).json({ data: { ok: true } });
}
