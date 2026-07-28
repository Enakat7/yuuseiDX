import Head from "next/head";
import { useMemo, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import { AREA_FILTER_TABS } from "@/lib/constants";

type Row = {
  driver: string;
  area: string;
  items: [number, number, number, number, number, number, number];
};

const ROWS: Row[] = [];

const COLUMNS = [
  "大野ガソリン",
  "イチネンガソリン",
  "車両修理費",
  "リース料",
  "貸借料",
  "自動車税",
  "スタッフ貸出料",
];

function formatYen(value: number) {
  return value.toLocaleString("ja-JP");
}

export default function CostPage() {
  const [area, setArea] = useState<(typeof AREA_FILTER_TABS)[number]>("全エリア");

  const visibleRows = useMemo(
    () => (area === "全エリア" ? ROWS : ROWS.filter((row) => row.area === area)),
    [area]
  );

  return (
    <>
      <Head>
        <title>管理費集計 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>管理費集計</h2>
            <p className="content__lead">
              ドライバーごとの管理費（控除予定額）を集計します。前払可能額の算出に使用されます。
            </p>
          </div>
          <div className="flex">
            <select style={{ width: "auto" }} defaultValue="2026年7月">
              <option>2026年7月</option>
              <option>2026年6月</option>
            </select>
            <button className="btn btn--ghost">CSVインポート</button>
            <button className="btn btn--ghost">CSVエクスポート</button>
          </div>
        </div>

        <div className="tabbar" style={{ marginBottom: 22 }}>
          {AREA_FILTER_TABS.map((a) => (
            <a
              key={a}
              href="#"
              className={a === area ? "is-active" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setArea(a);
              }}
            >
              {a}
            </a>
          ))}
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>管理費内訳（項目別）</h3>
            <span className="text-sm text-muted">2026/07/01 〜 07/16</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ドライバー</th>
                  <th>エリア</th>
                  {COLUMNS.map((col) => (
                    <th className="num" key={col}>
                      {col}
                    </th>
                  ))}
                  <th className="num">合計</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={10}>
                      <p className="empty-note">このエリアの管理費データはありません。</p>
                    </td>
                  </tr>
                )}
                {visibleRows.map((row) => {
                  const total = row.items.reduce((sum, value) => sum + value, 0);
                  return (
                    <tr key={row.driver}>
                      <td>{row.driver}</td>
                      <td>{row.area}</td>
                      {row.items.map((value, index) => (
                        <td className="num" key={index}>
                          {formatYen(value)}
                        </td>
                      ))}
                      <td className="num">
                        <strong>{formatYen(total)}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </OperationLayout>
    </>
  );
}
