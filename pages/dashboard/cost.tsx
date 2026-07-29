import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import { AREA_FILTER_TABS } from "@/lib/constants";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import type { CostRow } from "@/types/domain/cost";

function formatYen(value: number) {
  return value.toLocaleString("ja-JP");
}

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function CostPage() {
  const importInputRef = useRef<HTMLInputElement>(null);

  const [area, setArea] = useState<(typeof AREA_FILTER_TABS)[number]>("全エリア");
  const [month, setMonth] = useState(currentMonthIso());
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<CostRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({}); // itemId -> value
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newItemDriverId, setNewItemDriverId] = useState("");
  const [newItemLabel, setNewItemLabel] = useState("");

  const areaParam = area === "全エリア" ? "" : area;

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month });
      if (areaParam) params.set("area", areaParam);
      const res = await apiRequest<{ data: CostRow[]; columns: string[] }>(`/api/cost?${params.toString()}`);
      setRows(res.data);
      setColumns(res.columns);
      const nextDraft: Record<string, string> = {};
      for (const row of res.data) {
        for (const item of row.items) {
          nextDraft[item.itemId] = String(item.amount);
        }
      }
      setDraft(nextDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 月/エリア切替時に編集状態をリセットする意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditMode(false);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, areaParam]);

  const rowTotal = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) {
      let sum = 0;
      for (const item of row.items) {
        sum += Number(draft[item.itemId] ?? item.amount) || 0;
      }
      totals.set(row.driverId, sum);
    }
    return totals;
  }, [rows, draft]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const entries = rows.flatMap((row) =>
        row.items.map((item) => ({ item_id: item.itemId, amount: Number(draft[item.itemId]) || 0 }))
      );
      await apiRequest("/api/cost/amounts", {
        method: "POST",
        body: JSON.stringify({ period_month: month, entries }),
      });
      setEditMode(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem() {
    if (!newItemDriverId || !newItemLabel.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/cost/items", {
        method: "POST",
        body: JSON.stringify({ driver_id: newItemDriverId, label: newItemLabel.trim() }),
      });
      setNewItemLabel("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "項目の追加に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const csvRows = rows.map((row) => {
      const base: Record<string, string | number> = { driver: row.driverName, area: row.areaName ?? "" };
      for (const col of columns) {
        const item = row.items.find((i) => i.label === col);
        base[col] = item ? item.amount : "";
      }
      base["合計"] = rowTotal.get(row.driverId) ?? row.total;
      return base;
    });
    const csv = toCsv(csvRows, [
      { key: "driver", header: "ドライバー" },
      { key: "area", header: "エリア" },
      ...columns.map((c) => ({ key: c as keyof (typeof csvRows)[number], header: c })),
      { key: "合計", header: "合計" },
    ]);
    downloadCsv(`管理費集計_${month}.csv`, csv);
  }

  async function handleImportFile(file: File) {
    setSaving(true);
    setError(null);
    try {
      const parsedRows = await parseCsv<Record<string, string>>(
        file,
        [
          { key: "driver", header: "ドライバー" },
          { key: "area", header: "エリア" },
          ...columns.map((c) => ({ key: c, header: c })),
        ]
      );

      const entries: { item_id: string; amount: number }[] = [];
      for (const parsedRow of parsedRows) {
        const row = rows.find((r) => r.driverName === parsedRow.driver);
        if (!row) continue;
        for (const item of row.items) {
          const raw = parsedRow[item.label];
          if (raw === undefined || raw === "") continue;
          entries.push({ item_id: item.itemId, amount: Number(raw) || 0 });
        }
      }
      if (entries.length > 0) {
        await apiRequest("/api/cost/amounts", {
          method: "POST",
          body: JSON.stringify({ period_month: month, entries }),
        });
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました。");
    } finally {
      setSaving(false);
    }
  }

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
            <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} />
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleImportFile(file);
                event.target.value = "";
              }}
            />
            <button className="btn btn--ghost" onClick={() => importInputRef.current?.click()} disabled={saving}>
              CSVインポート
            </button>
            <button className="btn btn--ghost" onClick={handleExport}>
              CSVエクスポート
            </button>
            {editMode ? (
              <button className="btn btn--ghost" onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </button>
            ) : (
              <button className="btn btn--ghost" onClick={() => setEditMode(true)}>
                編集
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

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
            <span className="text-sm text-muted">{month.slice(0, 7)}分</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ドライバー</th>
                  <th>エリア</th>
                  {columns.map((col) => (
                    <th className="num" key={col}>
                      {col}
                    </th>
                  ))}
                  <th className="num">合計</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 3}>
                      <p className="empty-note">このエリアの管理費データはありません。</p>
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.driverId}>
                    <td>{row.driverName}</td>
                    <td>{row.areaName ?? "-"}</td>
                    {columns.map((col) => {
                      const item = row.items.find((i) => i.label === col);
                      if (!item) return <td className="num" key={col}>-</td>;
                      return (
                        <td className="num" key={col} style={editMode ? { padding: 0 } : undefined}>
                          {editMode ? (
                            <input
                              className="price-input"
                              type="number"
                              value={draft[item.itemId] ?? "0"}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, [item.itemId]: e.target.value }))
                              }
                            />
                          ) : (
                            formatYen(item.amount)
                          )}
                        </td>
                      );
                    })}
                    <td className="num">
                      <strong>{formatYen(rowTotal.get(row.driverId) ?? row.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="panel" style={{ marginTop: 22 }}>
            <div className="panel__head">
              <h3>ドライバー個別の控除項目を追加</h3>
            </div>
            <div className="panel__body">
              <div className="field-row">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="new-item-driver">ドライバー</label>
                  <select
                    id="new-item-driver"
                    value={newItemDriverId}
                    onChange={(e) => setNewItemDriverId(e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {rows.map((row) => (
                      <option key={row.driverId} value={row.driverId}>
                        {row.driverName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="new-item-label">項目名</label>
                  <input
                    id="new-item-label"
                    type="text"
                    value={newItemLabel}
                    onChange={(e) => setNewItemLabel(e.target.value)}
                  />
                </div>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleAddItem} disabled={saving}>
                + 追加
              </button>
            </div>
          </div>
        )}
      </OperationLayout>
    </>
  );
}
