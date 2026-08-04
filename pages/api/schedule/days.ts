import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase, profile } = auth;

  const body = (req.body ?? {}) as {
    driver_id?: string;
    work_date?: string;
    worked?: boolean;
    delivery_district_id?: string | null;
  };
  if (!body.driver_id || !body.work_date) {
    return res.status(400).json({ error: "driver_id・work_dateは必須です。" });
  }

  // 稼働カレンダー（月表示）は従来通りworked真偽値のみで◯/-を切り替える
  // （配達地区は未割り当てのままにする）。稼働表（週表示）は配達地区マスタの
  // コード選択に連動してworkedを導出する（area_idを持たない「休」「希休」等は非稼働扱い）。
  let worked: boolean;
  let deliveryDistrictId: string | null;
  if ("delivery_district_id" in body) {
    deliveryDistrictId = body.delivery_district_id ?? null;
    if (deliveryDistrictId) {
      const { data: district, error: districtError } = await supabase
        .from("delivery_districts")
        .select("area_id")
        .eq("id", deliveryDistrictId)
        .single();
      if (districtError || !district) return res.status(404).json({ error: "配達地区が見つかりません。" });
      worked = district.area_id !== null;
    } else {
      worked = false;
    }
  } else {
    if (typeof body.worked !== "boolean") {
      return res.status(400).json({ error: "workedまたはdelivery_district_idが必要です。" });
    }
    worked = body.worked;
    deliveryDistrictId = null;
  }

  const { data, error } = await supabase
    .from("work_schedule_days")
    .upsert(
      {
        driver_id: body.driver_id,
        work_date: body.work_date,
        worked,
        delivery_district_id: deliveryDistrictId,
        updated_by: profile.id,
      },
      { onConflict: "driver_id,work_date" }
    )
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "稼働日更新",
    screenName: "発注書(稼働表)",
    params: { work_date: body.work_date, worked, delivery_district_id: deliveryDistrictId },
    targetTable: "work_schedule_days",
    targetId: body.driver_id,
  });

  return res.status(200).json({ data });
}
