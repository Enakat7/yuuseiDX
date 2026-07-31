import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  if (req.method === "GET") {
    const { data, error } = await supabase.from("delivery_types").select("*").order("sort_order");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as { code?: string; name?: string; price_master_target?: boolean };
    if (!body.code || !body.name) {
      return res.status(400).json({ error: "コード・種別名は必須です。" });
    }

    const { count } = await supabase.from("delivery_types").select("*", { count: "exact", head: true });

    const { data, error } = await supabase
      .from("delivery_types")
      .insert({
        code: body.code,
        name: body.name,
        price_master_target: body.price_master_target ?? false,
        sort_order: (count ?? 0) + 1,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logOperation(supabase, {
      action: "新規登録",
      screenName: "マスタ管理(配送種別)",
      params: { code: body.code, name: body.name },
      targetTable: "delivery_types",
      targetId: data.id,
    });

    return res.status(201).json({ data });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
