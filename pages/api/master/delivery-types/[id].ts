import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  if (req.method === "DELETE") {
    const { data: type, error: findError } = await supabase
      .from("delivery_types")
      .select("id, name, active")
      .eq("id", id)
      .single();
    if (findError || !type) return res.status(404).json({ error: "配送種別が見つかりません。" });
    if (!type.active) return res.status(400).json({ error: "既に削除されています。" });

    const { error: updateError } = await supabase.from("delivery_types").update({ active: false }).eq("id", id);
    if (updateError) return res.status(500).json({ error: updateError.message });

    await logOperation(supabase, {
      action: "削除",
      screenName: "マスタ管理(配送種別)",
      params: { name: type.name },
      targetTable: "delivery_types",
      targetId: id,
    });

    return res.status(200).json({ data: { ok: true } });
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
