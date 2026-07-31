import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";
import { OPERATION_PAGE_KEYS } from "@/lib/pages";

// ログイン中の自分自身のページ単位アクセス権限を返す。OperationLayoutが
// 画面表示・サイドバー出し分けの根拠として使う（要件1.3・8章）。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (profile.role === "管理者") {
    const permissions = OPERATION_PAGE_KEYS.map((key) => ({ pageKey: key, canAccess: true }));
    return res.status(200).json({ data: permissions });
  }

  const { data, error } = await supabase
    .from("operation_page_permissions")
    .select("page_key, can_access")
    .eq("profile_id", profile.id);
  if (error) return res.status(500).json({ error: error.message });

  const overrides = new Map((data ?? []).map((row) => [row.page_key, row.can_access]));
  const permissions = OPERATION_PAGE_KEYS.map((key) => ({
    pageKey: key,
    canAccess: overrides.has(key) ? overrides.get(key)! : true,
  }));

  return res.status(200).json({ data: permissions });
}
