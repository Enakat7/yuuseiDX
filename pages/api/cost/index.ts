import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";
import type { CostRow } from "@/types/domain/cost";

type DriverRow = { id: string; name: string; area: { id: string; name: string } | null };
type ItemRow = { id: string; driver_id: string; label: string; sort_order: number };
type AmountRow = { deduction_item_id: string; amount: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const month = req.query.month;
  const area = req.query.area;
  if (typeof month !== "string") {
    return res.status(400).json({ error: "monthは必須です（YYYY-MM-01形式）。" });
  }

  let driverQuery = supabase
    .from("drivers")
    .select("id, name, area:areas(id, name)")
    .eq("active", true)
    .order("name");
  if (typeof area === "string" && area) {
    const { data: areaRow } = await supabase.from("areas").select("id").eq("name", area).single();
    if (areaRow) driverQuery = driverQuery.eq("area_id", areaRow.id);
  }

  const { data: drivers, error: driverError } = await driverQuery;
  if (driverError) return res.status(500).json({ error: driverError.message });

  const driverIds = ((drivers as unknown as DriverRow[] | null) ?? []).map((d) => d.id);

  const { data: items, error: itemError } = await supabase
    .from("deduction_items")
    .select("id, driver_id, label, sort_order")
    .eq("active", true)
    .in("driver_id", driverIds.length > 0 ? driverIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order");
  if (itemError) return res.status(500).json({ error: itemError.message });

  const itemIds = ((items as ItemRow[] | null) ?? []).map((i) => i.id);
  const { data: amounts, error: amountError } = await supabase
    .from("deduction_amounts")
    .select("deduction_item_id, amount")
    .eq("period_month", month)
    .in("deduction_item_id", itemIds.length > 0 ? itemIds : ["00000000-0000-0000-0000-000000000000"]);
  if (amountError) return res.status(500).json({ error: amountError.message });

  const amountByItem = new Map<string, number>();
  for (const a of (amounts as AmountRow[] | null) ?? []) {
    amountByItem.set(a.deduction_item_id, a.amount);
  }

  const itemsByDriver = new Map<string, ItemRow[]>();
  for (const item of (items as ItemRow[] | null) ?? []) {
    const list = itemsByDriver.get(item.driver_id) ?? [];
    list.push(item);
    itemsByDriver.set(item.driver_id, list);
  }

  const rows: CostRow[] = ((drivers as unknown as DriverRow[] | null) ?? []).map((driver) => {
    const driverItems = itemsByDriver.get(driver.id) ?? [];
    const rowItems = driverItems.map((item) => ({
      itemId: item.id,
      label: item.label,
      amount: amountByItem.get(item.id) ?? 0,
    }));
    return {
      driverId: driver.id,
      driverName: driver.name,
      areaName: driver.area?.name ?? null,
      items: rowItems,
      total: rowItems.reduce((sum, i) => sum + i.amount, 0),
    };
  });

  // 列見出し用: 全ドライバーの項目ラベルをsort_order順にユニーク化
  const columns: string[] = [];
  for (const item of ((items as ItemRow[] | null) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)) {
    if (!columns.includes(item.label)) columns.push(item.label);
  }

  return res.status(200).json({ data: rows, columns });
}
