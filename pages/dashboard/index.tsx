import Head from "next/head";
import Link from "next/link";
import OperationLayout from "@/components/OperationLayout";

const AREA_STATS: { area: string; drivers: number; count: string }[] = [];

const TASKS: { label: string; pill: string; tone: string }[] = [];

export default function OperationDashboardPage() {
  return (
    <>
      <Head>
        <title>ダッシュボード | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>2026年7月 サマリー</h2>
            <p className="content__lead">全エリア・全ドライバーの集計状況です。</p>
          </div>
          <Link href="/dashboard/aggregation" className="btn btn--primary">
            集計を確認する →
          </Link>
        </div>

        <div className="grid grid--stats">
          <div className="stat-card">
            <div className="stat-card__label">稼働ドライバー数</div>
            <div className="stat-card__value">
              —<small>名</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">今月の稼働件数</div>
            <div className="stat-card__value">
              —<small>件</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">支払通知書 未承認</div>
            <div className="stat-card__value">
              —<small>件</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">前払依頼</div>
            <div className="stat-card__value">
              —<small>件</small>
            </div>
          </div>
        </div>

        <div className="grid grid--2" style={{ marginTop: 24 }}>
          <div className="panel">
            <div className="panel__head">
              <h3>エリア別 稼働状況</h3>
              <Link href="/dashboard/schedule" className="btn btn--ghost btn--sm">
                稼働表を開く
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>エリア</th>
                    <th className="num">稼働ドライバー</th>
                    <th className="num">稼働件数</th>
                  </tr>
                </thead>
                <tbody>
                  {AREA_STATS.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <p className="empty-note">稼働状況データはありません。</p>
                      </td>
                    </tr>
                  )}
                  {AREA_STATS.map((row) => (
                    <tr key={row.area}>
                      <td>{row.area}</td>
                      <td className="num">{row.drivers}</td>
                      <td className="num">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h3>要対応タスク</h3>
            </div>
            <div className="panel__body">
              {TASKS.length === 0 ? (
                <p className="empty-note">要対応のタスクはありません。</p>
              ) : (
                <ul style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {TASKS.map((task) => (
                    <li className="flex--between" key={task.label}>
                      <span>{task.label}</span>
                      <span className={`pill pill--${task.tone}`}>{task.pill}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </OperationLayout>
    </>
  );
}
