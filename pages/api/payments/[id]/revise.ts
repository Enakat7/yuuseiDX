import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

// 局・NC突合等で件数の修正が入った場合の受付。仮確定中の修正はそのまま仮確定を維持するが、
// 確定後の修正は要件通り再承認フローを要求するため未承認へ差し戻す（REQUIREMENT.md 6.2参照）。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  const body = (req.body ?? {}) as { items?: { item_id: string; count: number }[] };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: "itemsは必須です。" });
  }

  const { data: notice, error: noticeError } = await supabase
    .from("payment_notices")
    .select("*")
    .eq("id", id)
    .single();
  if (noticeError || !notice) return res.status(404).json({ error: "支払通知書が見つかりません。" });

  const { data: existingItems, error: itemsError } = await supabase
    .from("payment_notice_items")
    .select("*")
    .eq("payment_notice_id", id);
  if (itemsError) return res.status(500).json({ error: itemsError.message });

  let newTotal = 0;
  for (const existing of existingItems ?? []) {
    const override = body.items.find((i) => i.item_id === existing.id);
    const count = override ? override.count : existing.count;
    const amount = count * existing.unit_price_snapshot;
    newTotal += amount;
    if (override) {
      const { error: updateItemError } = await supabase
        .from("payment_notice_items")
        .update({ count, amount })
        .eq("id", existing.id);
      if (updateItemError) return res.status(500).json({ error: updateItemError.message });
    }
  }

  const previousAmount = notice.amount;
  const requiresReapproval = notice.status === "確定";
  const nextStatus = requiresReapproval ? "未承認" : notice.status;
  const diffSummary = `件数の修正により金額が変更されました（${previousAmount.toLocaleString("ja-JP")}円 → ${newTotal.toLocaleString("ja-JP")}円）`;

  const { error: updateNoticeError } = await supabase
    .from("payment_notices")
    .update({
      amount: newTotal,
      status: nextStatus,
      remarks: diffSummary,
      // 再承認が必要になった場合は確定情報をクリアする
      ...(requiresReapproval ? { confirmed_at: null, confirmed_by: null } : {}),
    })
    .eq("id", id);
  if (updateNoticeError) return res.status(500).json({ error: updateNoticeError.message });

  const { error: revisionError } = await supabase.from("payment_notice_revisions").insert({
    payment_notice_id: id,
    revised_by: profile.id,
    diff_summary: diffSummary,
    previous_amount: previousAmount,
    new_amount: newTotal,
  });
  if (revisionError) return res.status(500).json({ error: revisionError.message });

  await logOperation(supabase, {
    action: "修正",
    screenName: "支払通知書",
    params: { previous_amount: previousAmount, new_amount: newTotal, requires_reapproval: requiresReapproval },
    targetTable: "payment_notices",
    targetId: id,
  });

  return res.status(200).json({ requiresReapproval });
}
