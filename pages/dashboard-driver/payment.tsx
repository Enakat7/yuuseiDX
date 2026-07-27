import Head from "next/head";
import DriverLayout from "@/components/DriverLayout";

const PAST_PAYMENTS: { period: string; type: string; tone: string; label: string }[] = [];

export default function DriverPaymentPage() {
  return (
    <>
      <Head>
        <title>支払通知書 | YOU SAY!!</title>
      </Head>
      <DriverLayout>
        <div className="content__header" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>支払通知書</h2>
            <p className="content__lead">週払い：毎週金曜日発行　/　月払い：月末締め後発行</p>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>直近の支払通知書</h3>
          </div>
          <div className="panel__body">
            <p className="empty-note">支払通知書はまだ発行されていません。</p>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>過去の支払通知書</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>対象期間</th>
                  <th>種別</th>
                  <th>ステータス</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {PAST_PAYMENTS.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <p className="empty-note">過去の支払通知書はありません。</p>
                    </td>
                  </tr>
                )}
                {PAST_PAYMENTS.map((payment) => (
                  <tr key={payment.period}>
                    <td>{payment.period}</td>
                    <td>{payment.type}</td>
                    <td>
                      <span className={`pill pill--${payment.tone}`}>{payment.label}</span>
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
