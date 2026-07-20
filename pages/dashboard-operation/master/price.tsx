import Head from "next/head";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";

const AREAS = ["広島西", "安佐南", "中央(中区)", "中央(東区)", "府中", "伴", "宇品"];

const ITEMS = ["配達完了１", "転居大口１", "夜間配送", "大配送", "集荷１", "集荷２"];

const RECEIVING_PRICES: number[][] = [
  [180, 175, 190, 195, 185, 170, 200],
  [420, 410, 430, 440, 425, 400, 450],
  [350, 340, 360, 365, 355, 330, 370],
  [600, 580, 620, 630, 610, 570, 650],
  [150, 145, 155, 160, 150, 140, 165],
  [130, 125, 135, 140, 130, 120, 145],
];

const PAYOUT_PRICES: number[][] = [
  [140, 135, 148, 152, 144, 132, 155],
  [330, 320, 335, 345, 332, 312, 352],
  [270, 262, 278, 282, 274, 255, 286],
  [470, 455, 485, 492, 478, 447, 508],
  [115, 111, 119, 123, 115, 107, 127],
  [100, 96, 104, 108, 100, 92, 112],
];

function PriceGrid({ title, note, prices }: { title: string; note: string; prices: number[][] }) {
  return (
    <div className="panel">
      <div className="panel__head">
        <h3>{title}</h3>
        <span className="text-sm text-muted">{note}</span>
      </div>
      <div className="table-wrap">
        <table className="price-table">
          <thead>
            <tr>
              <th>配送種別</th>
              {AREAS.map((area) => (
                <th className="area" key={area}>
                  {area}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((item, rowIndex) => (
              <tr key={item}>
                <td className="item">{item}</td>
                {prices[rowIndex].map((value, colIndex) => (
                  <td className="cell" key={colIndex}>
                    <input className="price-input" type="number" defaultValue={value} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MasterPricePage() {
  return (
    <>
      <Head>
        <title>単価マスタ | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>マスタ管理</h2>
            <p className="content__lead">エリア × 配送種別ごとの受単価・卸単価を管理します。</p>
          </div>
          <div className="flex">
            <select style={{ width: "auto" }} defaultValue="適用開始日：2026-07-01〜">
              <option>適用開始日：2026-07-01〜</option>
              <option>適用開始日：2026-04-01〜2026-06-30</option>
            </select>
            <button className="btn btn--ghost">CSVインポート</button>
            <button className="btn btn--ghost">CSVエクスポート</button>
          </div>
        </div>

        <MasterTabs />

        <PriceGrid title="受単価マスタ" note="局・NCからの受注単価（円 / 件）" prices={RECEIVING_PRICES} />
        <PriceGrid title="卸単価マスタ" note="ドライバーへの支払単価（円 / 件）" prices={PAYOUT_PRICES} />

        <div className="flex" style={{ justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn--ghost">変更を破棄</button>
          <button className="btn btn--primary">単価マスタを保存</button>
        </div>
      </OperationLayout>
    </>
  );
}
