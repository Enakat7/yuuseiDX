import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

const ALLOWED_STATUSES = ["作成中", "作成済"] as const;

// 稼働カレンダーモーダルの開閉に連動して発注書の下書き状態を管理する。
// 「確定」押下で作成済、確定せず閉じた場合は作成中にする（要件: 稼働表ステータス運用）。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  const body = (req.body ?? {}) as {
    driver_id?: string;
    period_start?: string;
    period_end?: string;
    status?: string;
  };
  if (
    !body.driver_id ||
    !body.period_start ||
    !body.period_end ||
    !body.status ||
    !ALLOWED_STATUSES.includes(body.status as (typeof ALLOWED_STATUSES)[number])
  ) {
    return res.status(400).json({ error: "driver_id・period_start・period_end・statusは必須です。" });
  }

  const { data: existing, error: existingError } = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("driver_id", body.driver_id)
    .eq("period_start", body.period_start)
    .eq("period_end", body.period_end)
    .maybeSingle();
  if (existingError) return res.status(500).json({ error: existingError.message });

  if (existing) {
    const { data, error } = await supabase
      .from("purchase_orders")
      .update({ status: body.status })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id, area_id")
    .eq("id", body.driver_id)
    .single();
  if (driverError || !driver) return res.status(404).json({ error: "ドライバーが見つかりません。" });

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      order_no: `PO-${body.period_start.replace(/-/g, "")}-${body.driver_id.slice(0, 8)}`,
      driver_id: body.driver_id,
      area_id: driver.area_id,
      period_start: body.period_start,
      period_end: body.period_end,
      status: body.status,
      issued_at: new Date().toISOString(),
      issued_by: profile.id,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: body.status === "作成済" ? "確定" : "下書き保存",
    screenName: "発注書(稼働表)",
    params: { period_start: body.period_start, period_end: body.period_end },
    targetTable: "purchase_orders",
    targetId: data.id,
  });

  return res.status(200).json({ data });
}
