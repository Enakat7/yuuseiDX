import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import OperationLayout from "@/components/OperationLayout";

const AREAS = [
  "全エリア",
  "西",
  "安佐南",
  "中央(中区)",
  "中央(東区)",
  "府中",
  "伴",
  "宇品",
  "その他",
] as const;

type Row = {
  driver: string;
  area: string;
  items: [number, number, number, number, number, number, number];
};

const ROWS: Row[] = [
  { driver: "佐藤 一郎", area: "西", items: [28000, 12000, 10000, 15000, 0, 0, 0] },
  { driver: "鈴木 花子", area: "安佐南", items: [0, 18500, 0, 12000, 8000, 0, 0] },
  { driver: "高橋 健太", area: "中央(中区)", items: [22000, 0, 15500, 0, 0, 14500, 0] },
  { driver: "田中 誠", area: "宇品", items: [19000, 0, 0, 10000, 0, 0, 6000] },
  { driver: "渡辺 陽子", area: "府中", items: [24000, 9000, 0, 0, 13000, 0, 0] },
];

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
  const [area, setArea] = useState<(typeof AREAS)[number]>("全エリア");

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
          {AREAS.map((a) => (
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
