import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/server";
import { type DriverBody, validateDriverEnums } from "@/lib/driverFields";

// Supabase Authのban_durationは有限期間しか指定できないため、実質恒久的な無効化として
// 十分長い期間（約100年）を指定する。
const PERMANENT_BAN_DURATION = "876000h";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "idが不正です。" });
  }

  if (req.method === "DELETE") {
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, name, profile_id, active")
      .eq("id", id)
      .single();
    if (driverError || !driver) return res.status(404).json({ error: "ドライバーが見つかりません。" });

    if (!driver.active) {
      return res.status(400).json({ error: "既に削除されています。" });
    }

    // ログインアカウントが発行済みの場合は、削除と同時にログインできないようにする
    // （行そのものは外部キー制約（支払通知書・発注書・前払依頼書がRESTRICT）のため
    // 物理削除できず、activeフラグによる論理削除とする）。
    if (driver.profile_id) {
      const admin = createAdminClient();
      const { error: banError } = await admin.auth.admin.updateUserById(driver.profile_id, {
        ban_duration: PERMANENT_BAN_DURATION,
      });
      if (banError) return res.status(500).json({ error: banError.message });
    }

    const { error: updateError } = await supabase.from("drivers").update({ active: false }).eq("id", id);
    if (updateError) return res.status(500).json({ error: updateError.message });

    await logOperation(supabase, {
      action: "削除",
      screenName: "マスタ管理(ドライバー)",
      params: { name: driver.name },
      targetTable: "drivers",
      targetId: id,
    });

    return res.status(200).json({ data: { ok: true } });
  }

  const body = (req.body ?? {}) as DriverBody;

  const enumError = validateDriverEnums(body);
  if (enumError) return res.status(400).json({ error: enumError });

  // profile_id・idはこのエンドポイントでは更新不可（profile_idは専用のアカウント
  // 発行エンドポイント経由のみ）。
  const update: Record<string, unknown> = {};
  const assignIfPresent = (key: keyof DriverBody, column = key as string) => {
    if (body[key] !== undefined) update[column] = body[key];
  };

  assignIfPresent("name");
  assignIfPresent("contract_type");
  assignIfPresent("area_id");
  assignIfPresent("contract_start_date");
  assignIfPresent("phone");
  assignIfPresent("email");
  assignIfPresent("pay_type");
  assignIfPresent("company_name");
  assignIfPresent("driver_role");
  assignIfPresent("contract_end_date");
  assignIfPresent("contract_indefinite");
  assignIfPresent("fixed_cost");
  assignIfPresent("other_conditions");
  assignIfPresent("emergency_contact_name");
  assignIfPresent("emergency_contact_relation");
  assignIfPresent("emergency_contact_phone");
  assignIfPresent("address");
  assignIfPresent("bank_name");
  assignIfPresent("bank_branch");
  assignIfPresent("bank_account_type");
  assignIfPresent("bank_account_number");
  assignIfPresent("bank_account_holder");
  assignIfPresent("advance_eligible");
  assignIfPresent("vehicle_number");
  assignIfPresent("vehicle_ownership");
  assignIfPresent("vehicle_lease_cost");
  assignIfPresent("vehicle_lease_start_date");
  assignIfPresent("vehicle_inspection_deadline");
  assignIfPresent("vehicle_insurance_deadline");
  assignIfPresent("gas_card_provided");
  assignIfPresent("gas_card_issued_date");
  assignIfPresent("gas_card_type");

  // 無期雇用フラグがtrueの場合は契約期限を強制的にnullにする
  if (body.contract_indefinite === true) {
    update.contract_deadline_date = null;
  } else if (body.contract_deadline_date !== undefined) {
    update.contract_deadline_date = body.contract_deadline_date;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "更新項目がありません。" });
  }

  const { data, error } = await supabase.from("drivers").update(update).eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  await logOperation(supabase, {
    action: "更新",
    screenName: "マスタ管理(ドライバー)",
    params: { name: data.name },
    targetTable: "drivers",
    targetId: id,
  });

  return res.status(200).json({ data });
}
