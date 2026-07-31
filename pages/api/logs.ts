import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";

// 操作ログ（要件6.9）。管理者限定のため明示的にチェックする
// （requireStaffOrAdminは管理者/スタッフ両方を通すが、ログ画面自体は管理者のみ）。
// ブラウザはセッションを持てずSupabase Realtimeをそのまま使えないため、
// この画面のみポーリングで擬似リアルタイム表示する（他画面はAPI Route経由の都度取得）。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (profile.role !== "管理者") {
    return res.status(403).json({ error: "ログ画面は管理者限定です。" });
  }

  const since = req.query.since;
  const role = req.query.role;

  let query = supabase.from("operation_logs").select("*").order("created_at", { ascending: false }).limit(100);
  if (typeof since === "string" && since) {
    query = supabase
      .from("operation_logs")
      .select("*")
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);
  }
  if (typeof role === "string" && role && role !== "すべて") {
    query = query.eq("actor_role", role);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ data, serverTime: new Date().toISOString() });
}
