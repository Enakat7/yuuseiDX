import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

// 実際の振込処理はシステム外で行う（要件6.5）。このAPIは、システム外で振込が完了した後に
// ステータスを「実行済」へ更新するための記録用エンドポイント。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  const { data, error } = await supabase
    .from("advance_requests")
    .update({ status: "実行済" })
    .eq("id", id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "実行済に変更",
    screenName: "前払依頼書",
    targetTable: "advance_requests",
    targetId: id,
  });

  return res.status(200).json({ data });
}
