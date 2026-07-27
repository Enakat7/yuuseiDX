import Head from "next/head";
import OperationLayout from "@/components/OperationLayout";

const ACCOUNTS: { name: string; role: string }[] = [];

const NOTIFICATIONS = [
  { label: "支払通知書 確定時のメール通知", on: true },
  { label: "免許証等 期限切れ前アラート", on: true },
  { label: "前払依頼の申請通知", on: false },
];

export default function SettingsPage() {
  return (
    <>
      <Head>
        <title>設定 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>システム設定</h2>
            <p className="content__lead">設定項目は現時点で未確定です。想定される項目のイメージを掲載しています。</p>
          </div>
        </div>

        <div className="grid grid--2">
          <div className="panel">
            <div className="panel__head">
              <h3>アカウント・権限管理</h3>
            </div>
            <div className="panel__body">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>氏名</th>
                      <th>権限</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACCOUNTS.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          <p className="empty-note">登録済みのアカウントはありません。</p>
                        </td>
                      </tr>
                    )}
                    {ACCOUNTS.map((account) => (
                      <tr key={account.name}>
                        <td>{account.name}</td>
                        <td>
                          <span className="tag">{account.role}</span>
                        </td>
                        <td>
                          <button className="btn btn--sm">編集</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn btn--ghost btn--sm" style={{ marginTop: 14 }}>
                + アカウントを追加
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h3>通知設定</h3>
            </div>
            <div className="panel__body">
              <ul style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {NOTIFICATIONS.map((item) => (
                  <li className="flex--between" key={item.label}>
                    <span>{item.label}</span>
                    <span className={`pill pill--${item.on ? "confirmed" : "pending"}`}>
                      {item.on ? "ON" : "OFF"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h3>帳票・発行タイミング</h3>
            </div>
            <div className="panel__body">
              <div className="field">
                <label>発注書 発行タイミング</label>
                <select defaultValue="月末（翌月分を自動発行）">
                  <option>月末（翌月分を自動発行）</option>
                </select>
              </div>
              <div className="field">
                <label>支払通知書 発行タイミング（週払い）</label>
                <select defaultValue="毎週金曜日">
                  <option>毎週金曜日</option>
                </select>
              </div>
              <div className="field mb-0">
                <label>支払通知書 発行タイミング（月払い）</label>
                <select defaultValue="月末締め後">
                  <option>月末締め後</option>
                </select>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h3>CSV / PDF 出力設定</h3>
            </div>
            <div className="panel__body">
              <div className="field">
                <label>CSV 文字コード</label>
                <select defaultValue="UTF-8">
                  <option>UTF-8</option>
                  <option>Shift-JIS</option>
                </select>
              </div>
              <div className="field mb-0">
                <label>PDFデザインテンプレート</label>
                <select defaultValue="標準テンプレート">
                  <option>標準テンプレート</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </OperationLayout>
    </>
  );
}
