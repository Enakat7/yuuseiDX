import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

const TABS = [
  { label: "ホーム", href: "/dashboard-driver" },
  { label: "発注書", href: "/dashboard-driver/order" },
  { label: "支払通知書", href: "/dashboard-driver/payment" },
];

export default function DriverLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <div className="driver-shell">
      <header className="driver-topbar">
        <div className="logo">
          YOU SAY<span>!!</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            color: "#fff",
            background: "transparent",
            border: "none",
            padding: 0,
            font: "inherit",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ログアウト
        </button>
      </header>

      <nav className="driver-tabs">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={router.pathname === tab.href ? "is-active" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <main className="driver-content">{children}</main>
    </div>
  );
}
