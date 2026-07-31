import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const auth = await requireStaffOrAdmin(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const fileId = req.query.fileId;
  if (typeof fileId !== "string") {
    return res.status(400).json({ error: "fileIdが不正です。" });
  }

  const { data: file, error: fileError } = await supabase
    .from("driver_document_files")
    .select("id, storage_path, driver_document_id")
    .eq("id", fileId)
    .single();
  if (fileError || !file) return res.status(404).json({ error: "ファイルが見つかりません。" });

  const { error: removeError } = await supabase.storage.from("driver-documents").remove([file.storage_path]);
  if (removeError) return res.status(500).json({ error: removeError.message });

  const { error: deleteError } = await supabase.from("driver_document_files").delete().eq("id", fileId);
  if (deleteError) return res.status(500).json({ error: deleteError.message });

  await logOperation(supabase, {
    action: "書類ファイル削除",
    screenName: "マスタ管理(ドライバー)",
    targetTable: "driver_document_files",
    targetId: fileId,
  });

  return res.status(200).json({ data: { ok: true } });
}
