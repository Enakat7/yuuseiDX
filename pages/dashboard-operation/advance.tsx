import Head from "next/head";
import OperationLayout from "@/components/OperationLayout";

const DEDUCTIONS = [
  { label: "控除予定額：大野ガソリン", amount: "▲ 28,000円" },
  { label: "控除予定額：イチネンガソリン", amount: "▲ 12,000円" },
  { label: "控除予定額：車両修理費", amount: "▲ 10,000円" },
  { label: "控除予定額：リース料", amount: "▲ 15,000円" },
  { label: "控除予定額：前払済み", amount: "▲ 20,000円" },
];

const REQUESTS = [
  {
    id: "ADV-0231",
    driver: "佐藤 一郎",
    date: "2026-07-18",
    amount: "65,000円",
    available: "65,000円",
    tone: "pending",
    label: "申請中",
  },
  {
    id: "ADV-0230",
    driver: "鈴木 花子",
    date: "2026-07-11",
    amount: "40,000円",
    available: "38,500円",
    tone: "alert",
    label: "超過（要確認）",
  },
  {
    id: "ADV-0229",
    driver: "高橋 健太",
    date: "2026-07-04",
    amount: "30,000円",
    available: "52,000円",
    tone: "confirmed",
    label: "実行済",
  },
] as const;

export default function AdvancePage() {
  return (
    <>
      <Head>
        <title>前払依頼書 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>前払依頼書 作成・一覧</h2>
            <p className="content__lead">
              控除予定額を差し引いた前払可能額をもとに、入金日ベースで前払依頼書を作成します。
            </p>
          </div>
        </div>

        <div className="grid grid--2">
          <div className="panel">
            <div className="panel__head">
              <h3>前払可能額 シミュレーション</h3>
            </div>
            <div className="panel__body">
              <div className="field">
                <label>ドライバー</label>
                <select defaultValue="佐藤 一郎（西A地区）">
                  <option>佐藤 一郎（西A地区）</option>
                  <option>鈴木 花子（安佐南B地区）</option>
                </select>
              </div>

              <div className="table-wrap">
                <table className="calc-table">
                  <tbody>
                    <tr>
                      <td>ある時点までの本人の売上（自動計算）</td>
                      <td className="num">150,000円</td>
                    </tr>
                    {DEDUCTIONS.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className="num">{row.amount}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>
                        <button type="button" className="btn btn--ghost btn--sm">
                          + 控除項目を追加
                        </button>
                      </td>
                      <td></td>
                    </tr>
                    <tr className="total">
                      <td>前払可能額</td>
                      <td className="num">65,000円</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted" style={{ marginTop: 10 }}>
                前払可能額がマイナスの場合でも前払いを実行できます。
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h3>前払依頼書 新規作成</h3>
            </div>
            <div className="panel__body">
              <div className="field-row">
                <div className="field">
                  <label htmlFor="pay-date">入金日</label>
                  <input type="date" id="pay-date" defaultValue="2026-07-18" />
                </div>
                <div className="field">
                  <label htmlFor="pay-amount">前払金額</label>
                  <input type="number" id="pay-amount" defaultValue={65000} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="pay-note">備考</label>
                <textarea id="pay-note" rows={3} placeholder="必要に応じて記入" />
              </div>
              <button className="btn btn--primary btn--block">前払依頼書を自動作成</button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>前払依頼 一覧</h3>
            <button className="btn btn--ghost btn--sm">CSVエクスポート</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>依頼No</th>
                  <th>ドライバー</th>
                  <th>入金日</th>
                  <th className="num">前払金額</th>
                  <th className="num">前払可能額</th>
                  <th>ステータス</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {REQUESTS.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.driver}</td>
                    <td>{row.date}</td>
                    <td className="num">{row.amount}</td>
                    <td className="num">{row.available}</td>
                    <td>
                      <span className={`pill pill--${row.tone}`}>{row.label}</span>
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
      </OperationLayout>
    </>
  );
}
