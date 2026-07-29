import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";
import { OPERATION_PAGE_KEYS } from "@/lib/pages";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  if (req.method === "GET") {
    const profileId = req.query.profile_id;
    if (typeof profileId !== "string") {
      return res.status(400).json({ error: "profile_idは必須です。" });
    }

    const { data, error } = await supabase
      .from("operation_page_permissions")
      .select("page_key, can_access")
      .eq("profile_id", profileId);
    if (error) return res.status(500).json({ error: error.message });

    const overrides = new Map((data ?? []).map((row) => [row.page_key, row.can_access]));
    // 行が存在しないページは既定でアクセス許可扱い（要件1.3・8章）
    const permissions = OPERATION_PAGE_KEYS.map((key) => ({
      pageKey: key,
      canAccess: overrides.has(key) ? overrides.get(key)! : true,
    }));

    return res.status(200).json({ data: permissions });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as { profile_id?: string; page_key?: string; can_access?: boolean };
    if (!body.profile_id || !body.page_key || typeof body.can_access !== "boolean") {
      return res.status(400).json({ error: "profile_id・page_key・can_accessは必須です。" });
    }

    const { data, error } = await supabase
      .from("operation_page_permissions")
      .upsert(
        { profile_id: body.profile_id, page_key: body.page_key, can_access: body.can_access },
        { onConflict: "profile_id,page_key" }
      )
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logOperation(supabase, {
      action: "ページ権限変更",
      screenName: "設定",
      params: { page_key: body.page_key, can_access: body.can_access },
      targetTable: "operation_page_permissions",
      targetId: body.profile_id,
    });

    return res.status(200).json({ data });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
