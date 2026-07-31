import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role")
      .in("role", ["管理者", "スタッフ"])
      .order("name");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    // アカウント作成は管理者限定（要件1.3：2人目以降は管理者が作成する）
    if (profile.role !== "管理者") {
      return res.status(403).json({ error: "アカウント作成は管理者のみ行えます。" });
    }

    const body = (req.body ?? {}) as { email?: string; password?: string; name?: string; role?: string };
    if (!body.email || !body.password || !body.name || !body.role) {
      return res.status(400).json({ error: "email・password・name・roleは必須です。" });
    }
    if (body.role !== "管理者" && body.role !== "スタッフ") {
      return res.status(400).json({ error: "roleは管理者またはスタッフを指定してください。" });
    }

    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name },
    });
    if (createError || !created.user) {
      return res.status(500).json({ error: createError?.message ?? "アカウント作成に失敗しました。" });
    }

    // handle_new_user()トリガーは新規作成者を一律「スタッフ」にするため、
    // 管理者として作成したい場合はここで明示的に更新する（is_admin()のためRLS上も許可される）。
    if (body.role === "管理者") {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role: "管理者" })
        .eq("id", created.user.id);
      if (updateError) return res.status(500).json({ error: updateError.message });
    }

    await logOperation(supabase, {
      action: "アカウント作成",
      screenName: "設定",
      params: { name: body.name, role: body.role },
      targetTable: "profiles",
      targetId: created.user.id,
    });

    return res.status(201).json({ data: { id: created.user.id, name: body.name, role: body.role } });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
