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

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  const { data: notice, error: noticeError } = await supabase
    .from("payment_notices")
    .select("*, driver:drivers(name), area:areas(name)")
    .eq("id", id)
    .single();
  if (noticeError || !notice) return res.status(404).json({ error: "支払通知書が見つかりません。" });

  const { data: items, error: itemsError } = await supabase
    .from("payment_notice_items")
    .select("*, count_categories(label)")
    .eq("payment_notice_id", id);
  if (itemsError) return res.status(500).json({ error: itemsError.message });

  const { data: revisions, error: revisionsError } = await supabase
    .from("payment_notice_revisions")
    .select("*")
    .eq("payment_notice_id", id)
    .order("revised_at", { ascending: false });
  if (revisionsError) return res.status(500).json({ error: revisionsError.message });

  const noticeRow = notice as unknown as {
    driver: { name: string } | null;
    area: { name: string } | null;
    [key: string]: unknown;
  };

  return res.status(200).json({
    data: {
      ...notice,
      driverName: noticeRow.driver?.name ?? "",
      areaName: noticeRow.area?.name ?? null,
      items: ((items as unknown as { count_categories: { label: string } | null; [key: string]: unknown }[] | null) ?? []).map(
        (item) => ({ ...item, categoryLabel: item.count_categories?.label ?? "" })
      ),
      revisions: revisions ?? [],
    },
  });
}
