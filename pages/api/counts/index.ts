import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";
import type { CountRow } from "@/types/domain/count";

type DriverRow = { id: string; name: string; area: { id: string; name: string } | null };
type CategoryRow = { id: string };
type EntryRow = { driver_id: string; category_id: string; count: number; approved: boolean };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  if (req.method === "GET") {
    const date = req.query.date;
    const area = req.query.area;
    if (typeof date !== "string") {
      return res.status(400).json({ error: "dateは必須です。" });
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

    const [{ data: drivers, error: driverError }, { data: categories, error: categoryError }] = await Promise.all([
      driverQuery,
      supabase.from("count_categories").select("id").order("sort_order"),
    ]);
    if (driverError) return res.status(500).json({ error: driverError.message });
    if (categoryError) return res.status(500).json({ error: categoryError.message });

    const driverIds = (drivers as unknown as DriverRow[] | null)?.map((d) => d.id) ?? [];
    const { data: entries, error: entryError } = await supabase
      .from("count_entries")
      .select("driver_id, category_id, count, approved")
      .eq("work_date", date)
      .in("driver_id", driverIds.length > 0 ? driverIds : ["00000000-0000-0000-0000-000000000000"]);
    if (entryError) return res.status(500).json({ error: entryError.message });

    const entriesByDriver = new Map<string, EntryRow[]>();
    for (const entry of (entries as EntryRow[] | null) ?? []) {
      const list = entriesByDriver.get(entry.driver_id) ?? [];
      list.push(entry);
      entriesByDriver.set(entry.driver_id, list);
    }

    const rows: CountRow[] = ((drivers as unknown as DriverRow[] | null) ?? []).map((driver) => {
      const driverEntries = entriesByDriver.get(driver.id) ?? [];
      const counts: Record<string, number> = {};
      for (const cat of (categories as CategoryRow[] | null) ?? []) {
        counts[cat.id] = 0;
      }
      for (const entry of driverEntries) {
        counts[entry.category_id] = entry.count;
      }
      return {
        driverId: driver.id,
        driverName: driver.name,
        areaName: driver.area?.name ?? null,
        counts,
        hasEntries: driverEntries.length > 0,
        approved: driverEntries.length > 0 && driverEntries.every((e) => e.approved),
      };
    });

    return res.status(200).json({ data: rows });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as {
      work_date?: string;
      rows?: { driver_id: string; counts: Record<string, number> }[];
    };
    if (!body.work_date || !Array.isArray(body.rows)) {
      return res.status(400).json({ error: "work_date・rowsは必須です。" });
    }

    const upsertRows = body.rows.flatMap((row) =>
      Object.entries(row.counts).map(([category_id, count]) => ({
        driver_id: row.driver_id,
        category_id,
        work_date: body.work_date as string,
        count: Number(count) || 0,
        entered_by: profile.id,
        approved: false,
        approved_by: null,
        approved_at: null,
      }))
    );

    if (upsertRows.length === 0) {
      return res.status(200).json({ data: [] });
    }

    const { data, error } = await supabase
      .from("count_entries")
      .upsert(upsertRows, { onConflict: "driver_id,category_id,work_date" })
      .select();
    if (error) return res.status(500).json({ error: error.message });

    await logOperation(supabase, {
      action: "保存",
      screenName: "件数集計",
      params: { work_date: body.work_date, drivers: body.rows.length },
      targetTable: "count_entries",
    });

    return res.status(200).json({ data });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
