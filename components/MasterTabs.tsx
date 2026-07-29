import Link from "next/link";
import { useRouter } from "next/router";

const TABS = [
  { label: "ドライバー", href: "/dashboard/master" },
  { label: "単価", href: "/dashboard/master/price" },
  { label: "配送種別", href: "/dashboard/master/type" },
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
