import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (req.method === "GET") {
    const { data, error } = await supabase.from("districts").select("*").order("sort_order");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    const { area_id, name } = (req.body ?? {}) as { area_id?: string; name?: string };
    if (!area_id || !name) {
      return res.status(400).json({ error: "area_id・nameは必須です。" });
    }

    const { data, error } = await supabase
      .from("districts")
      .insert({ area_id, name })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logOperation(supabase, {
      action: "新規登録",
      screenName: "マスタ管理(ドライバー)",
      params: { name, actor: profile.name },
      targetTable: "districts",
      targetId: data.id,
    });

    return res.status(201).json({ data });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
