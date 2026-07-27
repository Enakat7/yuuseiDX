import Head from "next/head";
import Link from "next/link";
import DriverLayout from "@/components/DriverLayout";
import { useCurrentUser } from "@/lib/currentUser";

const NOTICES: { title: string; tone: string; label: string; detail: string }[] = [];

export default function DriverDashboardPage() {
  const { user } = useCurrentUser();

  return (
    <>
      <Head>
        <title>ドライバーダッシュボード | YOU SAY!!</title>
      </Head>
      <DriverLayout>
        <div className="content__header" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>こんにちは、{user.name}さん</h2>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-card__label">今月の稼働件数</div>
            <div className="stat-card__value">
              —<small>件</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">前払可能額</div>
            <div className="stat-card__value">
              —<small>千円</small>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>お知らせ</h3>
          </div>
          <div className="panel__body">
            {NOTICES.length === 0 ? (
              <p className="empty-note">お知らせはありません。</p>
            ) : (
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
            )}
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 20 }}>
          <Link
            href="/dashboard-driver/order"
            className="panel"
            style={{ textDecoration: "none", color: "inherit", display: "block", padding: 22, textAlign: "center" }}
          >
            <div style={{ fontWeight: 900, fontSize: 15 }}>発注書</div>
          </Link>
          <Link
            href="/dashboard-driver/payment"
            className="panel"
            style={{ textDecoration: "none", color: "inherit", display: "block", padding: 22, textAlign: "center" }}
          >
            <div style={{ fontWeight: 900, fontSize: 15 }}>支払通知書</div>
          </Link>
        </div>
      </DriverLayout>
    </>
  );
}
