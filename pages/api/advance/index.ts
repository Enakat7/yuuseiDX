import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

type DriverRow = { id: string; name: string };

function monthStartIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("advance_requests")
      .select("*, driver:drivers(name)")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const rows = ((data as unknown as (Record<string, unknown> & { driver: DriverRow | null })[]) ?? []).map(
      (row) => ({ ...row, driverName: row.driver?.name ?? "" })
    );
    return res.status(200).json({ data: rows });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as { driver_id?: string; payout_date?: string; amount?: number; note?: string };
    if (!body.driver_id || !body.payout_date || body.amount === undefined) {
      return res.status(400).json({ error: "driver_id・payout_date・amountは必須です。" });
    }

    const periodMonth = monthStartIso();
    const { data: earnings, error: earningsError } = await supabase.rpc("driver_earnings", {
      p_driver_id: body.driver_id,
      p_date_from: periodMonth,
      p_date_to: todayIso(),
    });
    if (earningsError) return res.status(500).json({ error: earningsError.message });

    const { data: items } = await supabase
      .from("deduction_items")
      .select("id")
      .eq("driver_id", body.driver_id)
      .eq("active", true);
    const itemIds = (items ?? []).map((i) => i.id);
    const { data: amounts } = await supabase
      .from("deduction_amounts")
      .select("amount")
      .eq("period_month", periodMonth)
      .in("deduction_item_id", itemIds.length > 0 ? itemIds : ["00000000-0000-0000-0000-000000000000"]);
    const deductionTotal = (amounts ?? []).reduce((sum, a) => sum + a.amount, 0);
    const available = (Number(earnings) || 0) - deductionTotal;

    const { count } = await supabase.from("advance_requests").select("*", { count: "exact", head: true });
    const requestNo = `ADV-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: created, error: insertError } = await supabase
      .from("advance_requests")
      .insert({
        request_no: requestNo,
        driver_id: body.driver_id,
        payout_date: body.payout_date,
        amount: body.amount,
        available_amount_snapshot: available,
        status: body.amount > available ? "超過（要確認）" : "申請中",
        note: body.note || null,
        created_by: profile.id,
      })
      .select()
      .single();
    if (insertError) return res.status(500).json({ error: insertError.message });

    await logOperation(supabase, {
      action: "新規作成",
      screenName: "前払依頼書",
      params: { request_no: requestNo, amount: body.amount },
      targetTable: "advance_requests",
      targetId: created.id,
    });

    return res.status(201).json({ data: created });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
