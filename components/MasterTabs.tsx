import Link from "next/link";
import { useRouter } from "next/router";

const TABS = [
  { label: "ドライバー", href: "/dashboard-operation/master" },
  { label: "単価", href: "/dashboard-operation/master/price" },
];

export default function MasterTabs() {
  const router = useRouter();

  return (
    <div className="tabbar" style={{ marginBottom: 22 }}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={router.pathname === tab.href ? "is-active" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
