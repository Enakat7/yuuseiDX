import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";
import { getMonthRange, getWeekRange } from "@/lib/date";
import type { CountSummaryRow } from "@/types/domain/count";

type DriverRow = { id: string; name: string; area: { id: string; name: string } | null };
type EntryRow = { driver_id: string; category_id: string; count: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const period = req.query.period;
  const date = req.query.date;
  const area = req.query.area;
  if (typeof date !== "string" || (period !== "weekly" && period !== "monthly")) {
    return res.status(400).json({ error: "date・period(weekly|monthly)は必須です。" });
  }

  const range = period === "weekly" ? getWeekRange(new Date(date)) : getMonthRange(new Date(date));

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
  const { data: entries, error: entryError } = await supabase
    .from("count_entries")
    .select("driver_id, category_id, count")
    .gte("work_date", range.start)
    .lte("work_date", range.end)
    .in("driver_id", driverIds.length > 0 ? driverIds : ["00000000-0000-0000-0000-000000000000"]);
  if (entryError) return res.status(500).json({ error: entryError.message });

  const totalsByDriver = new Map<string, Record<string, number>>();
  for (const entry of (entries as EntryRow[] | null) ?? []) {
    const totals = totalsByDriver.get(entry.driver_id) ?? {};
    totals[entry.category_id] = (totals[entry.category_id] ?? 0) + entry.count;
    totalsByDriver.set(entry.driver_id, totals);
  }

  const rows: CountSummaryRow[] = ((drivers as unknown as DriverRow[] | null) ?? []).map((driver) => ({
    driverId: driver.id,
    driverName: driver.name,
    areaName: driver.area?.name ?? null,
    totals: totalsByDriver.get(driver.id) ?? {},
  }));

  return res.status(200).json({ data: rows, range });
}
