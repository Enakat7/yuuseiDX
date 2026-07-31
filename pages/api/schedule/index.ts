import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";
import { getWeekDates } from "@/lib/date";
import type { ScheduleRow } from "@/types/domain/schedule";

type DriverRow = {
  id: string;
  name: string;
  driver_districts: { district: { name: string } | null }[];
};
type DayRow = { driver_id: string; work_date: string; worked: boolean };
type OrderRow = { id: string; driver_id: string; status: ScheduleRow["orderStatus"] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const area = req.query.area;
  const weekStart = req.query.week_start;
  const periodStart = req.query.period_start;
  const periodEnd = req.query.period_end;
  if (typeof area !== "string" || typeof weekStart !== "string" || typeof periodStart !== "string" || typeof periodEnd !== "string") {
    return res.status(400).json({ error: "area・week_start・period_start・period_endは必須です。" });
  }

  const { data: areaRow, error: areaError } = await supabase.from("areas").select("id").eq("name", area).single();
  if (areaError || !areaRow) {
    return res.status(200).json({ data: [], weekDates: getWeekDates(new Date(weekStart)) });
  }

  const { data: drivers, error: driverError } = await supabase
    .from("drivers")
    .select("id, name, driver_districts(district:districts(name))")
    .eq("active", true)
    .eq("area_id", areaRow.id)
    .order("name");
  if (driverError) return res.status(500).json({ error: driverError.message });

  const driverIds = ((drivers as unknown as DriverRow[] | null) ?? []).map((d) => d.id);
  const weekDates = getWeekDates(new Date(weekStart));

  const [{ data: days, error: dayError }, { data: orders, error: orderError }] = await Promise.all([
    supabase
      .from("work_schedule_days")
      .select("driver_id, work_date, worked")
      .in("driver_id", driverIds.length > 0 ? driverIds : ["00000000-0000-0000-0000-000000000000"])
      .gte("work_date", weekDates[0].iso)
      .lte("work_date", weekDates[6].iso),
    supabase
      .from("purchase_orders")
      .select("id, driver_id, status")
      .in("driver_id", driverIds.length > 0 ? driverIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd),
  ]);
  if (dayError) return res.status(500).json({ error: dayError.message });
  if (orderError) return res.status(500).json({ error: orderError.message });

  const daysByDriver = new Map<string, Map<string, boolean>>();
  for (const day of (days as DayRow[] | null) ?? []) {
    const map = daysByDriver.get(day.driver_id) ?? new Map();
    map.set(day.work_date, day.worked);
    daysByDriver.set(day.driver_id, map);
  }
  const orderByDriver = new Map<string, OrderRow>();
  for (const order of (orders as unknown as OrderRow[] | null) ?? []) {
    orderByDriver.set(order.driver_id, order);
  }

  const rows: ScheduleRow[] = ((drivers as unknown as DriverRow[] | null) ?? []).map((driver) => {
    const dayMap = daysByDriver.get(driver.id) ?? new Map();
    const order = orderByDriver.get(driver.id);
    return {
      driverId: driver.id,
      driverName: driver.name,
      districtNames: driver.driver_districts.map((dd) => dd.district?.name).filter((n): n is string => !!n),
      week: weekDates.map((d) => dayMap.get(d.iso) ?? false),
      orderStatus: order?.status ?? null,
      orderId: order?.id ?? null,
    };
  });

  return res.status(200).json({ data: rows, weekDates });
}
