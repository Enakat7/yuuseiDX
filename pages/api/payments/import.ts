import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

type ImportRow = {
  driver: string;
  pay_type: string;
  period_start: string;
  period_end: string;
  amount: string;
  status: string;
  remarks: string;
};

// テストデータ投入用。通常の生成→承認→確定フロー（要件6.2の再承認ルールを含む）を経由せず、
// CSVの内容で支払通知書を直接upsertする（動作確認・デモ用途、ユーザー確認済み）。
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  const { rows } = (req.body ?? {}) as { rows?: ImportRow[] };
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: "rowsが不正です。" });
  }

  const { data: drivers } = await supabase.from("drivers").select("id, name, area_id");

  let imported = 0;
  for (const row of rows) {
    const driver = (drivers ?? []).find((d) => d.name === row.driver);
    if (!driver || !row.period_start || !row.period_end || !row.pay_type) continue;

    const status = (["未承認", "仮確定", "確定"] as const).includes(row.status as "未承認" | "仮確定" | "確定")
      ? row.status
      : "未承認";
    const noticeNo = `IMP-${row.period_start.replace(/-/g, "")}-${driver.id.slice(0, 8)}`;

    const { error } = await supabase.from("payment_notices").upsert(
      {
        notice_no: noticeNo,
        driver_id: driver.id,
        area_id: driver.area_id,
        pay_type: row.pay_type,
        period_start: row.period_start,
        period_end: row.period_end,
        amount: Number(row.amount) || 0,
        status,
        remarks: row.remarks || null,
        confirmed_at: status === "確定" ? new Date().toISOString() : null,
        confirmed_by: status === "確定" ? profile.id : null,
      },
      { onConflict: "driver_id,period_start,period_end,pay_type" }
    );
    if (error) continue;
    imported += 1;
  }

  await logOperation(supabase, {
    action: "CSVインポート",
    screenName: "支払通知書",
    params: { count: imported },
    targetTable: "payment_notices",
  });

  return res.status(200).json({ imported });
}
