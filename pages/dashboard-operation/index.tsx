import Head from "next/head";
import Link from "next/link";
import OperationLayout from "@/components/OperationLayout";

const AREA_STATS = [
  { area: "西", drivers: 21, count: "2,980" },
  { area: "安佐南", drivers: 18, count: "2,410" },
  { area: "中央(中区)", drivers: 16, count: "2,105" },
  { area: "中央(東区)", drivers: 14, count: "1,890" },
  { area: "府中", drivers: 15, count: "2,020" },
  { area: "伴", drivers: 12, count: "1,560" },
  { area: "宇品", drivers: 17, count: "2,340" },
  { area: "その他", drivers: 15, count: "3,115" },
];

const TASKS = [
  { label: "支払通知書の一括承認（週払い）", pill: "未承認 32件", tone: "pending" },
  { label: "局・NC 件数突合（木・金）", pill: "仮確定", tone: "provisional" },
  { label: "前払依頼書の確認", pill: "申請中 7件", tone: "pending" },
  { label: "免許証 期限切れ間近（3名）", pill: "要確認", tone: "alert" },
] as const;

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
          <Link href="/dashboard-operation/aggregation" className="btn btn--primary">
            集計を確認する →
          </Link>
        </div>

        <div className="grid grid--stats">
          <div className="stat-card">
            <div className="stat-card__label">稼働ドライバー数</div>
            <div className="stat-card__value">
              128<small>名</small>
            </div>
            <div className="stat-card__delta up">前月比 +4名</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">今月の稼働件数</div>
            <div className="stat-card__value">
              18,420<small>件</small>
            </div>
            <div className="stat-card__delta up">前月比 +6.2%</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">支払通知書 未承認</div>
            <div className="stat-card__value">
              32<small>件</small>
            </div>
            <div className="stat-card__delta flat">要対応</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">前払依頼</div>
            <div className="stat-card__value">
              7<small>件</small>
            </div>
            <div className="stat-card__delta flat">申請中</div>
          </div>
        </div>

        <div className="grid grid--2" style={{ marginTop: 24 }}>
          <div className="panel">
            <div className="panel__head">
              <h3>エリア別 稼働状況</h3>
              <Link href="/dashboard-operation/schedule" className="btn btn--ghost btn--sm">
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
              <ul style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {TASKS.map((task) => (
                  <li className="flex--between" key={task.label}>
                    <span>{task.label}</span>
                    <span className={`pill pill--${task.tone}`}>{task.pill}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </OperationLayout>
    </>
  );
}
