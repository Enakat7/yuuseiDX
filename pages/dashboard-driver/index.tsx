import Head from "next/head";
import Link from "next/link";
import DriverLayout from "@/components/DriverLayout";

const NOTICES = [
  {
    title: "支払通知書（仮確定）が届きました",
    tone: "provisional",
    label: "仮確定",
    detail: "2026年7月分・週払い（7/18金 発行）",
  },
  {
    title: "8月分 発注書が発行されました",
    tone: "confirmed",
    label: "発行済",
    detail: "2026-07-31 発行予定",
  },
  {
    title: "免許証の有効期限が近づいています",
    tone: "alert",
    label: "要更新",
    detail: "期限：2026-08-02",
  },
] as const;

export default function DriverDashboardPage() {
  return (
    <>
      <Head>
        <title>ドライバーダッシュボード | YOU SAY!!</title>
      </Head>
      <DriverLayout>
        <div className="content__header" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>こんにちは、佐藤さん</h2>
            <p className="content__lead">西 / 西A地区</p>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-card__label">今月の稼働件数</div>
            <div className="stat-card__value">
              142<small>件</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">前払可能額</div>
            <div className="stat-card__value">
              65<small>千円</small>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>お知らせ</h3>
          </div>
          <div className="panel__body">
            <ul style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {NOTICES.map((notice) => (
                <li key={notice.title}>
                  <div className="flex--between">
                    <strong className="text-sm">{notice.title}</strong>
                    <span className={`pill pill--${notice.tone}`}>{notice.label}</span>
                  </div>
                  <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                    {notice.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 20 }}>
          <Link
            href="/dashboard-driver/order"
            className="panel"
            style={{ textDecoration: "none", color: "inherit", display: "block", padding: 22, textAlign: "center" }}
          >
            <div style={{ fontWeight: 900, fontSize: 15 }}>発注書</div>
            <div className="text-sm text-muted" style={{ marginTop: 6 }}>
              最新: 2026年8月分
            </div>
          </Link>
          <Link
            href="/dashboard-driver/payment"
            className="panel"
            style={{ textDecoration: "none", color: "inherit", display: "block", padding: 22, textAlign: "center" }}
          >
            <div style={{ fontWeight: 900, fontSize: 15 }}>支払通知書</div>
            <div className="text-sm text-muted" style={{ marginTop: 6 }}>
              最新: 仮確定 1件
            </div>
          </Link>
        </div>
      </DriverLayout>
    </>
  );
}
