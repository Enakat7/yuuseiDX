import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/lib/supabase/server";

// マスタ管理系APIルート共通の認可チェック。
// ブラウザ側のSupabaseクライアントは認証CookieがhttpOnlyのためセッションを取得できず、
// データアクセスは必ずこのサーバー側クライアント経由のAPI Routeで行う（RLSはこの
// クライアントの実行時にも適用されるため、ここでの権限チェックは多層防御の一環）。
export async function requireStaffOrAdmin(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    res.status(401).json({ error: "認証が必要です。" });
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "管理者" && profile.role !== "スタッフ")) {
    res.status(403).json({ error: "権限がありません。" });
    return null;
  }

  return { supabase, profile };
}

export async function logOperation(
  supabase: ReturnType<typeof createClient>,
  params: {
    action: string;
    screenName: string;
    params?: Record<string, unknown>;
    targetTable?: string;
    targetId?: string;
  }
) {
  const { error } = await supabase.rpc("log_operation", {
    p_action: params.action,
    p_screen_name: params.screenName,
    p_params: params.params ?? {},
    p_target_table: params.targetTable ?? null,
    p_target_id: params.targetId ?? null,
  });
  if (error) {
    console.error("log_operation failed", error);
  }
}
