import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";
import { listLockedLogins } from "@/lib/rateLimit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  if (auth.profile.role !== "管理者") {
    return res.status(403).json({ error: "管理者のみ閲覧できます。" });
  }

  return res.status(200).json({ data: await listLockedLogins() });
}
