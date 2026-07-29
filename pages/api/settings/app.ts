import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (req.method === "GET") {
    const { data, error } = await supabase.from("app_settings").select("key, value");
    if (error) return res.status(500).json({ error: error.message });
    const map = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    return res.status(200).json({ data: map });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as { key?: string; value?: unknown };
    if (!body.key || body.value === undefined) {
      return res.status(400).json({ error: "key・valueは必須です。" });
    }

    const { data, error } = await supabase
      .from("app_settings")
      .upsert({ key: body.key, value: body.value, updated_by: profile.id }, { onConflict: "key" })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logOperation(supabase, {
      action: "設定保存",
      screenName: "設定",
      params: { key: body.key },
      targetTable: "app_settings",
      targetId: body.key,
    });

    return res.status(200).json({ data });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
