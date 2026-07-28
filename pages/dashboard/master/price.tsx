import Head from "next/head";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";
import { AREAS } from "@/lib/constants";

const ITEMS = ["配達完了１", "転居大口等１", "夜間配送", "大配送", "集荷１", "集荷２"];

const EMPTY_PRICES: (number | null)[][] = ITEMS.map(() => AREAS.map(() => null));

function PriceGrid({
  title,
  note,
  prices,
}: {
  title: string;
  note: string;
  prices: (number | null)[][];
}) {
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
                    <input
                      className="price-input"
                      type="number"
                      defaultValue={value ?? undefined}
                      placeholder="未設定"
                    />
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

        <PriceGrid title="受単価マスタ" note="局・NCからの受注単価（円 / 件）" prices={EMPTY_PRICES} />
        <PriceGrid title="卸単価マスタ" note="ドライバーへの支払単価（円 / 件）" prices={EMPTY_PRICES} />

        <div className="flex" style={{ justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn--ghost">変更を破棄</button>
          <button className="btn btn--primary">単価マスタを保存</button>
        </div>
      </OperationLayout>
    </>
  );
}
