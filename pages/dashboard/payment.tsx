import Head from "next/head";
import { useMemo, useState } from "react";
import OperationLayout from "@/components/OperationLayout";

const STATUS_TABS = ["すべて", "未承認", "仮確定", "確定"] as const;

type PillTone = "provisional" | "pending" | "confirmed" | "alert";

type Row = {
  driver: string;
  area: string;
  payType: "週払い" | "月払い";
  amount: string;
  status: (typeof STATUS_TABS)[number];
  tone: PillTone;
  statusLabel: string;
  note: string;
  noteIsTag?: boolean;
};

const ROWS: Row[] = [];

export default function PaymentPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("すべて");

  const visibleRows = useMemo(
    () => (statusFilter === "すべて" ? ROWS : ROWS.filter((row) => row.status === statusFilter)),
    [statusFilter]
  );

  const allChecked = visibleRows.length > 0 && visibleRows.every((row) => checked[row.driver]);

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
        <title>支払通知書 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>支払通知書</h2>
            <p className="content__lead">件数を承認して仮確定を発行し、局・NCとの突合後に確定します。</p>
          </div>
          <div className="flex">
            <select style={{ width: "auto" }} defaultValue="2026年7月 第3週（週払い）">
              <option>2026年7月 第3週（週払い）</option>
              <option>2026年7月分（月払い）</option>
            </select>
            <button className="btn btn--ghost">CSVエクスポート</button>
            <button className="btn btn--ghost">一括承認</button>
          </div>
        </div>

        <div className="tabbar" style={{ marginBottom: 22 }}>
          {STATUS_TABS.map((tab) => (
            <a
              key={tab}
              href="#"
              className={tab === statusFilter ? "is-active" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setStatusFilter(tab);
              }}
            >
              {tab}
            </a>
          ))}
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>2026年7月 第3週（週払い） / 金曜発行</h3>
            <span className="text-sm text-muted">突合予定：木・金曜日</span>
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
                  <th>支払種別</th>
                  <th className="num">金額</th>
                  <th>ステータス</th>
                  <th>備考</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <p className="empty-note">該当するステータスの支払通知書はありません。</p>
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
                    <td>{row.payType}</td>
                    <td className="num">{row.amount}</td>
                    <td>
                      <span className={`pill pill--${row.tone}`}>{row.statusLabel}</span>
                    </td>
                    <td className={row.noteIsTag ? "tag" : "text-sm text-muted"} style={row.noteIsTag ? { margin: 0 } : undefined}>
                      {row.note}
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
