import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";
import type { AdvanceSimulation } from "@/types/domain/advance";

function monthStartIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const driverId = req.query.driver_id;
  if (typeof driverId !== "string") {
    return res.status(400).json({ error: "driver_idは必須です。" });
  }

  const periodMonth = monthStartIso();

  const { data: earnings, error: earningsError } = await supabase.rpc("driver_earnings", {
    p_driver_id: driverId,
    p_date_from: periodMonth,
    p_date_to: todayIso(),
  });
  if (earningsError) return res.status(500).json({ error: earningsError.message });

  const { data: items, error: itemsError } = await supabase
    .from("deduction_items")
    .select("id, label")
    .eq("driver_id", driverId)
    .eq("active", true)
    .order("sort_order");
  if (itemsError) return res.status(500).json({ error: itemsError.message });

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: amounts, error: amountError } = await supabase
    .from("deduction_amounts")
    .select("deduction_item_id, amount")
    .eq("period_month", periodMonth)
    .in("deduction_item_id", itemIds.length > 0 ? itemIds : ["00000000-0000-0000-0000-000000000000"]);
  if (amountError) return res.status(500).json({ error: amountError.message });

  const amountByItem = new Map<string, number>();
  for (const a of amounts ?? []) amountByItem.set(a.deduction_item_id, a.amount);

  const deductions = (items ?? []).map((item) => ({
    label: item.label,
    amount: amountByItem.get(item.id) ?? 0,
  }));
  const deductionTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
  const earningsNumber = Number(earnings) || 0;

  const result: AdvanceSimulation = {
    driverId,
    earnings: earningsNumber,
    deductions,
    deductionTotal,
    available: earningsNumber - deductionTotal,
  };

  return res.status(200).json({ data: result });
}
