import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";
import type { PaymentNoticeRow } from "@/types/domain/payment";

type RawNotice = PaymentNoticeRow & {
  driver: { name: string } | null;
  area: { name: string } | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const status = req.query.status;
  const payType = req.query.pay_type;

  let query = supabase
    .from("payment_notices")
    .select("*, driver:drivers(name), area:areas(name)")
    .order("period_start", { ascending: false });
  if (typeof status === "string" && status && status !== "すべて") {
    query = query.eq("status", status);
  }
  if (typeof payType === "string" && payType) {
    query = query.eq("pay_type", payType);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const rows = ((data as unknown as RawNotice[] | null) ?? []).map((row) => ({
    ...row,
    driverName: row.driver?.name ?? "",
    areaName: row.area?.name ?? null,
  }));

  return res.status(200).json({ data: rows });
}
