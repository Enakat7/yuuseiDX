import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("delivery_districts")
      .select("*, area:areas(id, name)")
      .eq("active", true)
      .order("sort_order");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as {
      area_id?: string | null;
      code?: string;
      name?: string;
      background_color?: string;
    };
    if (!body.code || !body.name) {
      return res.status(400).json({ error: "コード・配達地区名は必須です。" });
    }
    if (body.background_color && !HEX_COLOR_PATTERN.test(body.background_color)) {
      return res.status(400).json({ error: "背景色はカラーコード（#rrggbb）で指定してください。" });
    }

    const { count } = await supabase.from("delivery_districts").select("*", { count: "exact", head: true });

    const { data, error } = await supabase
      .from("delivery_districts")
      .insert({
        area_id: body.area_id ?? null,
        code: body.code,
        name: body.name,
        background_color: body.background_color ?? "#ffffff",
        sort_order: (count ?? 0) + 1,
      })
      .select("*, area:areas(id, name)")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logOperation(supabase, {
      action: "新規登録",
      screenName: "マスタ管理(配達地区)",
      params: { code: body.code, name: body.name },
      targetTable: "delivery_districts",
      targetId: data.id,
    });

    return res.status(201).json({ data });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
