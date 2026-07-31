import type { NextApiRequest, NextApiResponse } from "next";
import { requireDriver } from "@/lib/apiAuth";
import type { MyOrderMonth } from "@/types/domain/mypage";

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
    .select("work_date, worked")
    .eq("driver_id", driver.id)
    .gte("work_date", start)
    .lte("work_date", end);
  if (error) return res.status(500).json({ error: error.message });

  const workedDates = (data ?? []).filter((d) => d.worked).map((d) => d.work_date);
  const result: MyOrderMonth = { workedDates, year, month };
  return res.status(200).json(result);
}
