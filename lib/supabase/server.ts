import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serialize } from "cookie";
import type { NextApiRequest, NextApiResponse } from "next";

const isProduction = process.env.NODE_ENV === "production";

// セッションCookieはブラウザJSから読めないhttpOnlyで発行する(XSSによるトークン窃取対策)。
// ログイン/ログアウトはこのサーバー側クライアントを経由するAPIルートでのみ行う。
export function createClient(req: NextApiRequest, res: NextApiResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({
            name,
            value: value ?? "",
          }));
        },
        setAll(cookiesToSet) {
          const existing = res.getHeader("Set-Cookie");
          const existingArray = Array.isArray(existing)
            ? existing.map(String)
            : existing
              ? [String(existing)]
              : [];

          const options: CookieOptions = {
            path: "/",
            sameSite: "lax",
            httpOnly: true,
            secure: isProduction,
          };

          const serialized = cookiesToSet.map(({ name, value, options: cookieOptions }) =>
            serialize(name, value, { ...cookieOptions, ...options })
          );

          res.setHeader("Set-Cookie", [...existingArray, ...serialized]);
        },
      },
    }
  );
}

// アカウント作成・パスワード再設定にはSupabase Admin API（service roleキー）が必要。
// このキーはクライアントへ絶対に渡さず、API Route内でのみ使用する（要件9.2）。
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
