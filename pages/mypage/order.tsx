import Head from "next/head";
import DriverLayout from "@/components/DriverLayout";

const PAST_ORDERS: { month: string; issued: string; tone: string; label: string }[] = [];

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
            <h3>今月分</h3>
          </div>
          <div className="panel__body">
            <p className="empty-note">発行済みの発注書はまだありません。</p>
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
                {PAST_ORDERS.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <p className="empty-note">過去の発注書はありません。</p>
                    </td>
                  </tr>
                )}
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
