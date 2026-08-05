import type { NextApiRequest, NextApiResponse } from "next";
import { requireDriver } from "@/lib/apiAuth";
import type { MyOrderMonth, MyOrderMonthDay } from "@/types/domain/mypage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireDriver(req, res);
  if (!auth) return;
  const { supabase, driver } = auth;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  const { data: order, error: orderError } = await supabase
    .from("purchase_orders")
    .select("id, driver_id, period_start")
    .eq("id", id)
    .eq("driver_id", driver.id)
    .single();
  if (orderError || !order) return res.status(404).json({ error: "発注書が見つかりません。" });

  const [year, month] = order.period_start.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("work_schedule_days")
    .select("work_date, worked, delivery_district_id")
    .eq("driver_id", driver.id)
    .gte("work_date", start)
    .lte("work_date", end);
  if (error) return res.status(500).json({ error: error.message });

  const districtIds = [...new Set((data ?? []).map((d) => d.delivery_district_id).filter((id): id is string => !!id))];
  const { data: districts, error: districtError } =
    districtIds.length > 0
      ? await supabase.from("delivery_districts").select("id, code, background_color").in("id", districtIds)
      : { data: [], error: null };
  if (districtError) return res.status(500).json({ error: districtError.message });

  const districtById = new Map((districts ?? []).map((d) => [d.id, d]));

  const days: MyOrderMonthDay[] = (data ?? []).map((d) => {
    const district = d.delivery_district_id ? districtById.get(d.delivery_district_id) : undefined;
    return {
      workDate: d.work_date,
      worked: d.worked,
      code: district?.code ?? null,
      backgroundColor: district?.background_color ?? null,
    };
  });

  const result: MyOrderMonth = { days, year, month };
  return res.status(200).json(result);
}
