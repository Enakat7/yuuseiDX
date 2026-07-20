import Head from "next/head";
import DriverLayout from "@/components/DriverLayout";

const WEEKS = [
  { label: "第1週（8/1-8/7）", days: "6日" },
  { label: "第2週（8/8-8/14）", days: "6日" },
  { label: "第3週（8/15-8/21）", days: "5日" },
  { label: "第4週（8/22-8/31）", days: "7日" },
];

const PAST_ORDERS = [
  { month: "2026年7月分", issued: "2026-06-30", tone: "confirmed", label: "発行済" },
  { month: "2026年6月分", issued: "2026-05-31", tone: "alert", label: "再発行" },
  { month: "2026年5月分", issued: "2026-04-30", tone: "confirmed", label: "発行済" },
] as const;

export default function DriverOrderPage() {
  return (
    <>
      <Head>
        <title>発注書 | YOU SAY!!</title>
      </Head>
      <DriverLayout>
        <div className="content__header" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>発注書</h2>
            <p className="content__lead">月末に翌月分の発注書（稼働表）が発行されます。</p>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>2026年8月分</h3>
            <span className="pill pill--confirmed">発行済</span>
          </div>
          <div className="panel__body">
            <p className="text-sm text-muted">発行日：2026-07-31　/　稼働エリア：西 / 西A地区</p>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>週</th>
                    <th>稼働予定日数</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEKS.map((week) => (
                    <tr key={week.label}>
                      <td>{week.label}</td>
                      <td>{week.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex" style={{ marginTop: 18 }}>
              <button className="btn btn--ghost">PDFダウンロード</button>
              <button className="btn btn--ghost">CSVダウンロード</button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>過去の発注書</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>対象月</th>
                  <th>発行日</th>
                  <th>ステータス</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {PAST_ORDERS.map((order) => (
                  <tr key={order.month}>
                    <td>{order.month}</td>
                    <td>{order.issued}</td>
                    <td>
                      <span className={`pill pill--${order.tone}`}>{order.label}</span>
                    </td>
                    <td>
                      <button className="btn btn--sm">PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DriverLayout>
    </>
  );
}
