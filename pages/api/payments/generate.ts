import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

type DriverRow = { id: string; area_id: string; pay_type: string };
type EntryRow = {
  category_id: string;
  count: number;
  count_categories: { delivery_type_id: string | null; label: string } | null;
};
type PriceRow = { delivery_type_id: string; price_yen: number; effective_from: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const body = (req.body ?? {}) as { pay_type?: string; period_start?: string; period_end?: string };
  if (!body.pay_type || !body.period_start || !body.period_end) {
    return res.status(400).json({ error: "pay_type・period_start・period_endは必須です。" });
  }

  const { data: drivers, error: driverError } = await supabase
    .from("drivers")
    .select("id, area_id, pay_type")
    .eq("active", true)
    .eq("pay_type", body.pay_type);
  if (driverError) return res.status(500).json({ error: driverError.message });

  const { data: existing, error: existingError } = await supabase
    .from("payment_notices")
    .select("driver_id")
    .eq("period_start", body.period_start)
    .eq("period_end", body.period_end)
    .eq("pay_type", body.pay_type);
  if (existingError) return res.status(500).json({ error: existingError.message });
  const existingDriverIds = new Set((existing ?? []).map((e) => e.driver_id));

  const targetDrivers = ((drivers as DriverRow[] | null) ?? []).filter((d) => !existingDriverIds.has(d.id));

  const { data: allPrices, error: priceError } = await supabase
    .from("unit_prices")
    .select("delivery_type_id, area_id, price_yen, effective_from")
    .eq("price_kind", "卸単価")
    .lte("effective_from", body.period_end);
  if (priceError) return res.status(500).json({ error: priceError.message });

  const { data: deliveryTypes, error: deliveryTypeError } = await supabase
    .from("delivery_types")
    .select("id, price_master_target");
  if (deliveryTypeError) return res.status(500).json({ error: deliveryTypeError.message });
  const nonTargetDeliveryTypeIds = new Set(
    ((deliveryTypes as { id: string; price_master_target: boolean }[] | null) ?? [])
      .filter((dt) => !dt.price_master_target)
      .map((dt) => dt.id)
  );

  let generated = 0;
  for (const driver of targetDrivers) {
    const { data: entries, error: entryError } = await supabase
      .from("count_entries")
      .select("category_id, count, count_categories(delivery_type_id, label)")
      .eq("driver_id", driver.id)
      .eq("approved", true)
      .gte("work_date", body.period_start)
      .lte("work_date", body.period_end);
    if (entryError) return res.status(500).json({ error: entryError.message });

    const totalsByCategory = new Map<string, { count: number; deliveryTypeId: string | null }>();
    for (const entry of ((entries as unknown as EntryRow[] | null) ?? [])) {
      const deliveryTypeId = entry.count_categories?.delivery_type_id ?? null;
      // 単価マスタ対象外の配送種別に紐づく区分は支払通知書の明細に含めない
      if (deliveryTypeId && nonTargetDeliveryTypeIds.has(deliveryTypeId)) continue;
      const key = entry.category_id;
      const prev = totalsByCategory.get(key) ?? { count: 0, deliveryTypeId };
      prev.count += entry.count;
      totalsByCategory.set(key, prev);
    }

    if (totalsByCategory.size === 0) continue;

    const items = Array.from(totalsByCategory.entries()).map(([categoryId, v]) => {
      let priceYen = 0;
      if (v.deliveryTypeId) {
        const candidates = ((allPrices as PriceRow[] | null) ?? []).filter(
          (p) => p.delivery_type_id === v.deliveryTypeId && (p as unknown as { area_id: string }).area_id === driver.area_id
        );
        candidates.sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
        priceYen = candidates[0]?.price_yen ?? 0;
      }
      return {
        category_id: categoryId,
        count: v.count,
        unit_price_snapshot: priceYen,
        amount: v.count * priceYen,
      };
    });

    const total = items.reduce((sum, i) => sum + i.amount, 0);
    const noticeNo = `${body.period_start.replace(/-/g, "")}-${body.pay_type === "週払い" ? "W" : "M"}-${driver.id.slice(0, 8)}`;

    const { data: notice, error: noticeError } = await supabase
      .from("payment_notices")
      .insert({
        notice_no: noticeNo,
        driver_id: driver.id,
        area_id: driver.area_id,
        pay_type: body.pay_type,
        period_start: body.period_start,
        period_end: body.period_end,
        amount: total,
        status: "未承認",
      })
      .select()
      .single();
    if (noticeError) return res.status(500).json({ error: noticeError.message });

    const { error: itemsError } = await supabase
      .from("payment_notice_items")
      .insert(items.map((i) => ({ ...i, payment_notice_id: notice.id })));
    if (itemsError) return res.status(500).json({ error: itemsError.message });

    generated += 1;
  }

  await logOperation(supabase, {
    action: "生成",
    screenName: "支払通知書",
    params: { pay_type: body.pay_type, period_start: body.period_start, period_end: body.period_end, generated },
    targetTable: "payment_notices",
  });

  return res.status(200).json({ generated });
}
