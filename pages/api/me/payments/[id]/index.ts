import type { NextApiRequest, NextApiResponse } from "next";
import { requireDriver } from "@/lib/apiAuth";

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

  const { data: notice, error: noticeError } = await supabase
    .from("payment_notices")
    .select("*")
    .eq("id", id)
    .eq("driver_id", driver.id)
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

  return res.status(200).json({
    data: {
      ...notice,
      items: ((items as unknown as { count_categories: { label: string } | null; [key: string]: unknown }[] | null) ?? []).map(
        (item) => ({ ...item, categoryLabel: item.count_categories?.label ?? "" })
      ),
      revisions: revisions ?? [],
    },
  });
}
