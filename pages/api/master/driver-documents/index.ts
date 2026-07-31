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

// Supabase Storageのキーは空白・日本語等の文字を含むと"Invalid key"で失敗するため、
// 保存パスに使うファイル名は英数字・ドット・アンダースコア・ハイフンのみに置き換える。
// 画面表示用のファイル名（original_filename）は元の値のまま保持する。
function sanitizeStorageFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

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

  const { data: docType, error: docTypeError } = await supabase
    .from("document_types")
    .select("max_files")
    .eq("id", body.document_type_id)
    .single();
  if (docTypeError || !docType) return res.status(404).json({ error: "書類種別が見つかりません。" });

  // 書類種別ごとの記載事項(有効期限・免許証等の記載事項)は1セットのみのため、
  // 既存行があればそれを再利用し、なければ新規作成する。ファイル本体は
  // driver_document_filesへ複数枚追加していく。
  const { data: existingDoc, error: existingDocError } = await supabase
    .from("driver_documents")
    .select("id")
    .eq("driver_id", body.driver_id)
    .eq("document_type_id", body.document_type_id)
    .maybeSingle();
  if (existingDocError) return res.status(500).json({ error: existingDocError.message });

  let documentId = existingDoc?.id;
  if (documentId) {
    if (docType.max_files !== null) {
      const { count, error: countError } = await supabase
        .from("driver_document_files")
        .select("id", { count: "exact", head: true })
        .eq("driver_document_id", documentId);
      if (countError) return res.status(500).json({ error: countError.message });
      if ((count ?? 0) >= docType.max_files) {
        return res.status(400).json({ error: `アップロード上限（${docType.max_files}枚）に達しています。` });
      }
    }
  } else {
    const { data: createdDoc, error: createError } = await supabase
      .from("driver_documents")
      .insert({
        driver_id: body.driver_id,
        document_type_id: body.document_type_id,
        expires_on: body.expires_on || null,
      })
      .select("id")
      .single();
    if (createError) return res.status(500).json({ error: createError.message });
    documentId = createdDoc.id;
  }

  const buffer = Buffer.from(body.content_base64, "base64");
  const path = `${body.driver_id}/${body.document_type_id}-${Date.now()}-${sanitizeStorageFilename(body.filename)}`;

  const { error: uploadError } = await supabase.storage
    .from("driver-documents")
    .upload(path, buffer, { upsert: true });
  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { data, error: insertError } = await supabase
    .from("driver_document_files")
    .insert({
      driver_document_id: documentId,
      storage_path: path,
      original_filename: body.filename,
      uploaded_by: profile.id,
    })
    .select()
    .single();
  if (insertError) return res.status(500).json({ error: insertError.message });

  await logOperation(supabase, {
    action: "書類アップロード",
    screenName: "マスタ管理(ドライバー)",
    params: { document_type_id: body.document_type_id },
    targetTable: "driver_documents",
    targetId: body.driver_id,
  });

  return res.status(201).json({ data });
}
