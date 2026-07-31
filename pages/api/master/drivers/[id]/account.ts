import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  // profiles.roleの変更はDBトリガー（prevent_role_escalation）がauth.uid()に基づく
  // is_admin()判定で管理者のみに制限しているため、ここも管理者限定とする
  // （settings/accounts/index.tsの管理者アカウント作成と同じ制約）。
  if (profile.role !== "管理者") {
    return res.status(403).json({ error: "アカウント発行は管理者のみ行えます。" });
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  const body = (req.body ?? {}) as { password?: string };
  if (!body.password) {
    return res.status(400).json({ error: "passwordは必須です。" });
  }

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id, name, email, profile_id")
    .eq("id", id)
    .single();
  if (driverError || !driver) return res.status(404).json({ error: "ドライバーが見つかりません。" });

  if (driver.profile_id) {
    return res.status(409).json({ error: "既にアカウントが発行されています。" });
  }
  if (!driver.email) {
    return res.status(400).json({ error: "メールアドレスが未設定です。" });
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: driver.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { name: driver.name },
  });
  if (createError || !created.user) {
    return res.status(500).json({ error: createError?.message ?? "アカウント作成に失敗しました。" });
  }

  // handle_new_user()トリガーは新規作成者を一律「スタッフ」にするため、
  // ドライバーとして作成したい場合はここで明示的に更新する。
  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: "ドライバー" })
    .eq("id", created.user.id);
  if (roleError) return res.status(500).json({ error: roleError.message });

  const { error: linkError } = await supabase
    .from("drivers")
    .update({ profile_id: created.user.id })
    .eq("id", id);
  if (linkError) return res.status(500).json({ error: linkError.message });

  await logOperation(supabase, {
    action: "アカウント発行",
    screenName: "マスタ管理(ドライバー)",
    params: { name: driver.name },
    targetTable: "drivers",
    targetId: id,
  });

  return res.status(201).json({ data: { profile_id: created.user.id } });
}
