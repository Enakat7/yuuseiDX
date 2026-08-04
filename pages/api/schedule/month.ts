import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const driverId = req.query.driver_id;
  const year = Number(req.query.year);
  const month = Number(req.query.month); // 1-12
  if (typeof driverId !== "string" || !year || !month) {
    return res.status(400).json({ error: "driver_id・year・monthは必須です。" });
  }

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("work_schedule_days")
    .select("work_date, delivery_district_id")
    .eq("driver_id", driverId)
    .gte("work_date", start)
    .lte("work_date", end);
  if (error) return res.status(500).json({ error: error.message });

  const days = (data ?? []).map((d) => ({
    workDate: d.work_date,
    deliveryDistrictId: d.delivery_district_id,
  }));
  return res.status(200).json({ days });
}
