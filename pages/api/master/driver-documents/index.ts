import type { NextApiRequest, NextApiResponse } from "next";
import { logOperation, requireStaffOrAdmin } from "@/lib/apiAuth";

// Base64でファイル本体をJSONに含めて送るため、APIルートの既定ボディサイズ上限を引き上げる。
// 大容量ファイル（数十MB超）はこの方式では非効率なため、その場合は将来的に
// マルチパートアップロード／Storageへの直接アップロードへの切り替えを検討する。
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

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
    document_type_id?: string;
    filename?: string;
    content_base64?: string;
    expires_on?: string | null;
  };

  if (!body.driver_id || !body.document_type_id || !body.filename || !body.content_base64) {
    return res.status(400).json({ error: "driver_id・document_type_id・filename・content_base64は必須です。" });
  }

  const buffer = Buffer.from(body.content_base64, "base64");
  const path = `${body.driver_id}/${body.document_type_id}-${Date.now()}-${body.filename}`;

  const { error: uploadError } = await supabase.storage
    .from("driver-documents")
    .upload(path, buffer, { upsert: true });
  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { data, error: upsertError } = await supabase
    .from("driver_documents")
    .upsert(
      {
        driver_id: body.driver_id,
        document_type_id: body.document_type_id,
        storage_path: path,
        original_filename: body.filename,
        expires_on: body.expires_on || null,
        uploaded_by: profile.id,
      },
      { onConflict: "driver_id,document_type_id" }
    )
    .select()
    .single();
  if (upsertError) return res.status(500).json({ error: upsertError.message });

  await logOperation(supabase, {
    action: "書類アップロード",
    screenName: "マスタ管理(ドライバー)",
    params: { document_type_id: body.document_type_id },
    targetTable: "driver_documents",
    targetId: body.driver_id,
  });

  return res.status(201).json({ data });
}
