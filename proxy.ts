import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession()はCookieの中身を検証なしに信頼するため使わない。
  // getUser()はAuthサーバーに問い合わせて検証するので、改ざんされたCookieでの
  // なりすましを防げる。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isOperationRoute = pathname.startsWith("/dashboard-operation");
  const isDriverRoute = pathname.startsWith("/dashboard-driver");

  if (!user) {
    if (isOperationRoute || isDriverRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (isOperationRoute || isDriverRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    // ロールに応じたダッシュボードへのアクセス制御(認可の徹底。要件9.2)
    if (isOperationRoute && role === "ドライバー") {
      return NextResponse.redirect(new URL("/dashboard-driver", request.url));
    }
    if (isDriverRoute && role !== "ドライバー") {
      return NextResponse.redirect(new URL("/dashboard-operation", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard-operation/:path*", "/dashboard-driver/:path*"],
};
