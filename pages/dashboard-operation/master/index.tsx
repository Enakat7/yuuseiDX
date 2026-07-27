import Head from "next/head";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";

const DRIVERS: {
  name: string;
  contract: string;
  area: string;
  startDate: string;
  contact: string;
  docTone: string;
  docLabel: string;
}[] = [];

export default function MasterDriverPage() {
  return (
    <>
      <Head>
        <title>マスタ管理 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>マスタ管理</h2>
            <p className="content__lead">ドライバー・単価の各種マスタデータを管理します。</p>
          </div>
          <div className="flex">
            <button className="btn btn--ghost">CSVインポート</button>
            <button className="btn btn--ghost">CSVエクスポート</button>
            <button className="btn btn--ghost">+ 新規登録</button>
          </div>
        </div>

        <MasterTabs />

        <div className="panel">
          <div className="panel__head">
            <h3>ドライバーマスタ</h3>
            <span className="text-sm text-muted">{DRIVERS.length}件</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>契約形態</th>
                  <th>エリア / 地区</th>
                  <th>契約開始日</th>
                  <th>連絡先</th>
                  <th>書類</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {DRIVERS.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <p className="empty-note">登録済みのドライバーはいません。</p>
                    </td>
                  </tr>
                )}
                {DRIVERS.map((driver) => (
                  <tr key={driver.name}>
                    <td>{driver.name}</td>
                    <td>{driver.contract}</td>
                    <td>{driver.area}</td>
                    <td>{driver.startDate}</td>
                    <td>{driver.contact}</td>
                    <td>
                      <span className={`pill pill--${driver.docTone}`}>{driver.docLabel}</span>
                    </td>
                    <td>
                      <button className="btn btn--sm">詳細</button>
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
