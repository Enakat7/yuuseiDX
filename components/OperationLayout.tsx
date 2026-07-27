import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/lib/currentUser";
import Link from "next/link";

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

const NAV_ITEMS = [
  { label: "ダッシュボード", href: "/dashboard-operation" },
  { label: "件数集計", href: "/dashboard-operation/aggregation" },
  { label: "管理費集計", href: "/dashboard-operation/cost" },
  { label: "発注書(稼働表)", href: "/dashboard-operation/schedule" },
  { label: "支払通知書", href: "/dashboard-operation/payment" },
  { label: "前払依頼書", href: "/dashboard-operation/advance" },
  { label: "マスタ管理", href: "/dashboard-operation/master" },
  { label: "設定", href: "/dashboard-operation/settings" },
];

const ADMIN_ONLY_ITEM = { label: "ログ", href: "/dashboard-operation/log" };

function isActive(pathname: string, href: string) {
  if (href === "/dashboard-operation") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function OperationLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const navItems = user.role === "管理者" ? [...NAV_ITEMS, ADMIN_ONLY_ITEM] : NAV_ITEMS;

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
