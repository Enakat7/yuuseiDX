import Head from "next/head";
import DriverLayout from "@/components/DriverLayout";

const CURRENT_WEEK_ITEMS = [
  { label: "配達完了１", value: "142件" },
  { label: "配達完了２", value: "38件" },
  { label: "集荷１", value: "18件" },
  { label: "ゆうパケット", value: "54件" },
  { label: "不在個数", value: "9件" },
];

const PAST_PAYMENTS = [
  { period: "2026年7月 第1週", type: "週払い", tone: "confirmed", label: "確定" },
  { period: "2026年6月分", type: "月払い", tone: "confirmed", label: "確定" },
] as const;

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
            <h3>2026年7月 第3週（週払い）</h3>
            <span className="pill pill--provisional">仮確定</span>
          </div>
          <div className="panel__body">
            <p className="text-sm text-muted">発行日：2026-07-18　/　局・NC突合予定：木・金曜日</p>

            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="calc-table">
                <tbody>
                  {CURRENT_WEEK_ITEMS.map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td className="num">{item.value}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>お支払い予定額（仮）</td>
                    <td className="num">184,200円</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="empty-note" style={{ textAlign: "left", marginTop: 16, borderStyle: "dashed" }}>
              この金額は仮確定です。局・NCとの件数突合後に確定版が発行されます。修正があった場合は確定版の備考欄に記載されます。
            </div>

            <div className="flex" style={{ marginTop: 18 }}>
              <button className="btn btn--ghost">PDFダウンロード</button>
              <button className="btn btn--ghost">CSVダウンロード</button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>2026年7月 第2週（週払い）</h3>
            <span className="pill pill--confirmed">確定</span>
          </div>
          <div className="panel__body">
            <p className="text-sm text-muted">発行日：2026-07-11　/　確定日：2026-07-14</p>
            <table className="calc-table" style={{ marginTop: 14 }}>
              <tbody>
                <tr>
                  <td>お支払い確定額</td>
                  <td className="num">176,400円</td>
                </tr>
              </tbody>
            </table>
            <div className="tag" style={{ marginTop: 12 }}>
              備考：局突合により配達完了２を2件修正済み
            </div>
            <div className="flex" style={{ marginTop: 18 }}>
              <button className="btn btn--ghost">PDFダウンロード</button>
              <button className="btn btn--ghost">CSVダウンロード</button>
            </div>
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
