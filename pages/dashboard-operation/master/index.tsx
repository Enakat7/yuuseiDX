import Head from "next/head";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";

const DRIVERS = [
  {
    name: "佐藤 一郎",
    contract: "個人事業主",
    area: "西 / 西A地区",
    startDate: "2023-04-01",
    contact: "090-1234-5678",
    docTone: "alert",
    docLabel: "期限間近",
  },
  {
    name: "鈴木 花子",
    contract: "個人事業主",
    area: "安佐南 / 安佐南B地区",
    startDate: "2022-09-15",
    contact: "090-2345-6789",
    docTone: "confirmed",
    docLabel: "完備",
  },
  {
    name: "合同会社ハコビ",
    contract: "法人",
    area: "中央(中区) / 中区A",
    startDate: "2021-11-01",
    contact: "082-123-4567",
    docTone: "confirmed",
    docLabel: "完備",
  },
  {
    name: "田中 誠",
    contract: "個人事業主",
    area: "宇品 / 宇品C地区",
    startDate: "2024-02-10",
    contact: "090-3456-7890",
    docTone: "pending",
    docLabel: "未提出",
  },
] as const;

const DOCUMENTS = [
  "免許証（期限：2026/08/02）",
  "車検証",
  "任意保険証",
  "自賠責保険証",
  "インボイス申請書",
  "業務委託契約書",
  "履歴書",
  "貨物軽自動車運送事業経営届出書",
];

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
            <span className="text-sm text-muted">128件</span>
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

        <div className="panel">
          <div className="panel__head">
            <h3>ドライバー詳細 — 佐藤 一郎</h3>
            <span className="pill pill--alert">免許証 期限間近</span>
          </div>
          <div className="panel__body">
            <div className="grid grid--2">
              <div>
                <p className="section-title">基本情報</p>
                <p className="text-sm">
                  <strong>契約形態：</strong>個人事業主（フリーランス）
                </p>
                <p className="text-sm">
                  <strong>稼働エリア：</strong>西 / 西A地区
                </p>
                <p className="text-sm">
                  <strong>契約開始日：</strong>2023-04-01
                </p>
                <p className="text-sm">
                  <strong>連絡先：</strong>090-1234-5678
                </p>
              </div>
              <div>
                <p className="section-title">保管書類</p>
                <div>
                  {DOCUMENTS.map((doc) => (
                    <span className="tag" key={doc}>
                      {doc}
                    </span>
                  ))}
                  <span className="tag" style={{ borderStyle: "dashed", color: "#8f8f8f" }}>
                    + 種類を追加
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </OperationLayout>
    </>
  );
}
