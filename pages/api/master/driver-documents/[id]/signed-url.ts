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

  const { data: doc, error: docError } = await supabase
    .from("driver_documents")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (docError || !doc) return res.status(404).json({ error: "書類が見つかりません。" });

  const { data, error } = await supabase.storage
    .from("driver-documents")
    .createSignedUrl(doc.storage_path, 60);
  if (error || !data) return res.status(500).json({ error: error?.message ?? "URLの発行に失敗しました。" });

  return res.status(200).json({ url: data.signedUrl });
}
