import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

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

  const body = (req.body ?? {}) as { code?: string; name?: string; price_master_target?: boolean };

  const { data, error } = await supabase
    .from("delivery_types")
    .update({
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.price_master_target !== undefined ? { price_master_target: body.price_master_target } : {}),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "更新",
    screenName: "マスタ管理(配送種別)",
    params: { code: body.code, name: body.name },
    targetTable: "delivery_types",
    targetId: id,
  });

  return res.status(200).json({ data });
}
