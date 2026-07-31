import type { NextApiRequest, NextApiResponse } from "next";
import { requireStaffOrAdmin } from "@/lib/apiAuth";
import type { CountCategory } from "@/types/domain/master";

type Row = CountCategory & { delivery_types: { price_master_target: boolean } | null };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;

  const { data, error } = await auth.supabase
    .from("count_categories")
    .select("*, delivery_types(price_master_target)")
    .order("sort_order");
  if (error) return res.status(500).json({ error: error.message });

  // 単価マスタ対象外の配送種別に紐づく区分は、単価・件数集計・支払通知書・前払依頼書のいずれにも表示しない
  const visible: CountCategory[] = ((data as unknown as Row[] | null) ?? [])
    .filter((row) => row.delivery_types === null || row.delivery_types.price_master_target)
    .map(({ created_at, delivery_type_id, id, label, sort_order, updated_at }) => ({
      created_at,
      delivery_type_id,
      id,
      label,
      sort_order,
      updated_at,
    }));

  return res.status(200).json({ data: visible });
}
