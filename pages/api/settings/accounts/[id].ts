import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (profile.role !== "管理者") {
    return res.status(403).json({ error: "権限の変更は管理者のみ行えます。" });
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  const body = (req.body ?? {}) as { role?: string };
  if (body.role !== "管理者" && body.role !== "スタッフ") {
    return res.status(400).json({ error: "roleは管理者またはスタッフを指定してください。" });
  }

  const { data, error } = await supabase.from("profiles").update({ role: body.role }).eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "権限変更",
    screenName: "設定",
    params: { role: body.role },
    targetTable: "profiles",
    targetId: id,
  });

  return res.status(200).json({ data });
}
