import { useRouter } from "next/router";
import { useEffect, useState, type ReactNode } from "react";
import { useCurrentUser } from "@/lib/currentUser";
import { apiRequest } from "@/lib/apiClient";
import type { OperationPageKey } from "@/lib/pages";
import Link from "next/link";

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

const NAV_ITEMS: { label: string; href: string; pageKey: OperationPageKey }[] = [
  { label: "ダッシュボード", href: "/dashboard", pageKey: "dashboard" },
  { label: "件数集計", href: "/dashboard/aggregation", pageKey: "aggregation" },
  { label: "管理費集計", href: "/dashboard/cost", pageKey: "cost" },
  { label: "発注書(稼働表)", href: "/dashboard/schedule", pageKey: "schedule" },
  { label: "支払通知書", href: "/dashboard/payment", pageKey: "payment" },
  { label: "前払依頼書", href: "/dashboard/advance", pageKey: "advance" },
  { label: "マスタ管理", href: "/dashboard/master", pageKey: "master" },
  { label: "設定", href: "/dashboard/settings", pageKey: "settings" },
];

const ADMIN_ONLY_ITEMS: { label: string; href: string; pageKey: OperationPageKey }[] = [
  { label: "ログ", href: "/dashboard/log", pageKey: "log" },
  { label: "ログインロック管理", href: "/dashboard/login-locks", pageKey: "loginLocks" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// pathnameから該当するページキーを求める（/dashboard/master/price のようなサブページも
// masterに丸める）。
function resolvePageKey(pathname: string): OperationPageKey {
  const all = [...NAV_ITEMS, ...ADMIN_ONLY_ITEMS];
  const matched = all.find((item) => isActive(pathname, item.href));
  return matched?.pageKey ?? "dashboard";
}

export default function OperationLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, ready } = useCurrentUser();
  const [blockedKeys, setBlockedKeys] = useState<Set<OperationPageKey> | null>(null);

  useEffect(() => {
    if (!ready || user.role === "管理者") return;
    apiRequest<{ data: { pageKey: OperationPageKey; canAccess: boolean }[] }>("/api/me/permissions")
      .then((res) => {
        setBlockedKeys(new Set(res.data.filter((p) => !p.canAccess).map((p) => p.pageKey)));
      })
      .catch(() => {
        // 取得失敗時は制限なし（既定はアクセス許可）として扱う
        setBlockedKeys(new Set());
      });
  }, [ready, user.role]);

  useEffect(() => {
    if (!ready || user.role === "管理者" || blockedKeys === null) return;
    const currentKey = resolvePageKey(router.pathname);
    if (blockedKeys.has(currentKey)) {
      // 全ページ制限されている場合はリダイレクトループを避けるため何もしない
      const fallback = NAV_ITEMS.find((item) => !blockedKeys.has(item.pageKey));
      if (fallback) router.replace(fallback.href);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user.role, blockedKeys, router.pathname]);

  const visibleNavItems = NAV_ITEMS.filter((item) => user.role === "管理者" || !blockedKeys?.has(item.pageKey));
  const navItems = user.role === "管理者" ? [...visibleNavItems, ...ADMIN_ONLY_ITEMS] : visibleNavItems;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="logo">
            YOU SAY<span>!!</span>
          </div>
          <div className="tagline">Operation Console</div>
        </div>

        <nav className="sidebar__nav">
          <div className="sidebar__group-label">メニュー</div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                "sidebar__link" + (isActive(router.pathname, item.href) ? " is-active" : "")
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="user-chip">
            <div className="user-chip__avatar">{user.role === "管理者" ? "管" : "ス"}</div>
            <div className="user-chip__meta">
              <div className="user-chip__name">{user.name}</div>
              <div className="user-chip__role">{user.role}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="user-chip__logout"
              title="ログアウト"
              aria-label="ログアウト"
            >
              <svg
                viewBox="0 0 24 24"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
