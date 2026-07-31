import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

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
    .select("id, name, profile_id")
    .eq("id", id)
    .single();
  if (driverError || !driver) return res.status(404).json({ error: "ドライバーが見つかりません。" });

  if (!driver.profile_id) {
    return res.status(400).json({ error: "先にアカウントを発行してください。" });
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(driver.profile_id, {
    password: body.password,
  });
  if (updateError) return res.status(500).json({ error: updateError.message });

  await logOperation(supabase, {
    action: "パスワード再設定",
    screenName: "マスタ管理(ドライバー)",
    params: { name: driver.name },
    targetTable: "drivers",
    targetId: id,
  });

  return res.status(200).json({ data: { ok: true } });
}
