import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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
    const { data: district, error: findError } = await supabase
      .from("delivery_districts")
      .select("id, name, active")
      .eq("id", id)
      .single();
    if (findError || !district) return res.status(404).json({ error: "配達地区が見つかりません。" });
    if (!district.active) return res.status(400).json({ error: "既に削除されています。" });

    const { error: updateError } = await supabase.from("delivery_districts").update({ active: false }).eq("id", id);
    if (updateError) return res.status(500).json({ error: updateError.message });

    await logOperation(supabase, {
      action: "削除",
      screenName: "マスタ管理(配達地区)",
      params: { name: district.name },
      targetTable: "delivery_districts",
      targetId: id,
    });

    return res.status(200).json({ data: { ok: true } });
  }

  const body = (req.body ?? {}) as {
    area_id?: string | null;
    code?: string;
    name?: string;
    background_color?: string;
  };

  if (body.background_color && !HEX_COLOR_PATTERN.test(body.background_color)) {
    return res.status(400).json({ error: "背景色はカラーコード（#rrggbb）で指定してください。" });
  }

  const { data, error } = await supabase
    .from("delivery_districts")
    .update({
      ...(body.area_id !== undefined ? { area_id: body.area_id } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.background_color !== undefined ? { background_color: body.background_color } : {}),
    })
    .eq("id", id)
    .select("*, area:areas(id, name)")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "更新",
    screenName: "マスタ管理(配達地区)",
    params: { code: body.code, name: body.name },
    targetTable: "delivery_districts",
    targetId: id,
  });

  return res.status(200).json({ data });
}
