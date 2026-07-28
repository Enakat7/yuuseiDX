import Head from "next/head";
import { useMemo, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import { addDays, formatDate } from "@/lib/date";

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
  counts: [number, number, number, number, number, number, number, number];
};

const ROWS: Row[] = [];

const COLUMNS = [
  "配達完了１",
  "配達完了２",
  "転居大口等１",
  "転居大口等２",
  "夜間配送",
  "大配送",
  "集荷１",
  "集荷２",
];

export default function AggregationPage() {
  const [area, setArea] = useState<(typeof AREAS)[number]>("全エリア");
  const [date, setDate] = useState(() => new Date(2026, 6, 17));
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Row[]>(ROWS);
  const [editMode, setEditMode] = useState(false);

  const updateCount = (driver: string, index: number, value: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.driver !== driver) return row;
        const nextCounts = [...row.counts] as Row["counts"];
        nextCounts[index] = Number.isNaN(value) ? 0 : value;
        return { ...row, counts: nextCounts };
      })
    );
  };

  const visibleRows = useMemo(
    () => (area === "全エリア" ? rows : rows.filter((row) => row.area === area)),
    [area, rows]
  );

  const allChecked =
    visibleRows.length > 0 && visibleRows.every((row) => checked[row.driver]);

  const toggleAll = () => {
    const next = { ...checked };
    visibleRows.forEach((row) => {
      next[row.driver] = !allChecked;
    });
    setChecked(next);
  };

  return (
    <>
      <Head>
        <title>件数集計 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>件数集計</h2>
            <p className="content__lead">ドライバーから提出された日報の件数を集計・承認します。</p>
          </div>
          <div className="flex">
            <select style={{ width: "auto" }} defaultValue="2026年7月">
              <option>2026年7月</option>
              <option>2026年6月</option>
            </select>
            <button className="btn btn--ghost">CSVエクスポート</button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditMode(true)}>
              編集
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditMode(false)}>
              保存
            </button>
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
            <h3>件数内訳（種類別）</h3>
            <div className="date-nav">
              <button
                type="button"
                className="date-nav__btn"
                aria-label="前日"
                onClick={() => setDate((d) => addDays(d, -1))}
              >
                ‹
              </button>
              <span className="date-nav__value">{formatDate(date)}</span>
              <button
                type="button"
                className="date-nav__btn"
                aria-label="翌日"
                onClick={() => setDate((d) => addDays(d, 1))}
              >
                ›
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                  </th>
                  <th>ドライバー</th>
                  <th>エリア</th>
                  {COLUMNS.map((col) => (
                    <th className="num" key={col}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={11}>
                      <p className="empty-note">このエリアの件数データはありません。</p>
                    </td>
                  </tr>
                )}
                {visibleRows.map((row) => (
                  <tr key={row.driver}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!checked[row.driver]}
                        onChange={(event) =>
                          setChecked((prev) => ({ ...prev, [row.driver]: event.target.checked }))
                        }
                      />
                    </td>
                    <td>{row.driver}</td>
                    <td>{row.area}</td>
                    {row.counts.map((value, index) =>
                      editMode ? (
                        <td className="num" key={index} style={{ padding: 0 }}>
                          <input
                            className="price-input"
                            type="number"
                            value={value}
                            onChange={(event) =>
                              updateCount(row.driver, index, Number(event.target.value))
                            }
                          />
                        </td>
                      ) : (
                        <td className="num" key={index}>
                          {value}
                        </td>
                      )
                    )}
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
