import type { NextApiRequest, NextApiResponse } from "next";
import { requireDriver } from "@/lib/apiAuth";
import { getMonthRange } from "@/lib/date";
import type { MySummary } from "@/types/domain/mypage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireDriver(req, res);
  if (!auth) return;
  const { supabase, driver } = auth;

  const { start, end } = getMonthRange(new Date());

  const [{ data: days, error: daysError }, { data: advance, error: advanceError }, { data: notices, error: noticesError }] =
    await Promise.all([
      supabase
        .from("work_schedule_days")
        .select("work_date")
        .eq("driver_id", driver.id)
        .eq("worked", true)
        .gte("work_date", start)
        .lte("work_date", end),
      supabase.rpc("driver_available_advance", { p_period_month: start }),
      supabase
        .from("payment_notices")
        .select("id, status, period_start, period_end, amount")
        .eq("driver_id", driver.id)
        .order("period_end", { ascending: false })
        .limit(1),
    ]);
  if (daysError) return res.status(500).json({ error: daysError.message });
  if (advanceError) return res.status(500).json({ error: advanceError.message });
  if (noticesError) return res.status(500).json({ error: noticesError.message });

  const latest = (notices ?? [])[0] ?? null;

  const result: MySummary = {
    workedDaysThisMonth: (days ?? []).length,
    availableAdvance: Number(advance) || 0,
    latestPayment: latest,
  };

  return res.status(200).json({ data: result });
}
