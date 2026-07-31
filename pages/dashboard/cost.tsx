import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import CsvImportModal from "@/components/CsvImportModal";
import Modal from "@/components/Modal";
import { AREA_FILTER_TABS } from "@/lib/constants";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import { useCsvImportShortcut } from "@/lib/useCsvImportShortcut";
import type { CostRow } from "@/types/domain/cost";

function formatYen(value: number) {
  return value.toLocaleString("ja-JP");
}

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function CostPage() {
  const [showImportModal, setShowImportModal] = useState(false);

  const [area, setArea] = useState<(typeof AREA_FILTER_TABS)[number]>("全エリア");
  const [month, setMonth] = useState(currentMonthIso());
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<CostRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({}); // itemId -> value
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newRows, setNewRows] = useState<{ driverId: string; amounts: Record<string, string> }[]>([]);

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
      // 他の利用者が同時に編集している場合に触っていないセルまで上書きしてしまわないよう、
      // 読み込み時点の値（rows）から実際に変更されたセルのみを送信する。
      const entries = rows.flatMap((row) =>
        row.items
          .map((item) => ({ item_id: item.itemId, amount: Number(draft[item.itemId]) || 0, original: item.amount }))
          .filter((entry) => entry.amount !== entry.original)
          .map(({ item_id, amount }) => ({ item_id, amount }))
      );
      if (entries.length > 0) {
        await apiRequest("/api/cost/amounts", {
          method: "POST",
          body: JSON.stringify({ period_month: month, entries }),
        });
      }
      setEditMode(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function openNewModal() {
    setNewRows([{ driverId: "", amounts: {} }]);
    setShowNewModal(true);
  }

  function addNewRow() {
    setNewRows((prev) => [...prev, { driverId: "", amounts: {} }]);
  }

  function removeNewRow(index: number) {
    setNewRows((prev) => prev.filter((_, i) => i !== index));
  }

  function newRowTotal(row: { amounts: Record<string, string> }): number {
    return columns.reduce((sum, col) => sum + (Number(row.amounts[col]) || 0), 0);
  }

  async function handleBulkAdd() {
    const targets = newRows.filter((row) => row.driverId);
    if (targets.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const entries: { item_id: string; amount: number }[] = [];
      for (const target of targets) {
        const driverRow = rows.find((row) => row.driverId === target.driverId);
        for (const col of columns) {
          const raw = target.amounts[col];
          if (raw === undefined || raw === "") continue;
          let itemId = driverRow?.items.find((item) => item.label === col)?.itemId;
          if (!itemId) {
            const res = await apiRequest<{ data: { id: string } }>("/api/cost/items", {
              method: "POST",
              body: JSON.stringify({ driver_id: target.driverId, label: col }),
            });
            itemId = res.data.id;
          }
          entries.push({ item_id: itemId, amount: Number(raw) || 0 });
        }
      }
      if (entries.length > 0) {
        await apiRequest("/api/cost/amounts", {
          method: "POST",
          body: JSON.stringify({ period_month: month, entries }),
        });
      }
      setShowNewModal(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました。");
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
    const parsedRows = await parseCsv<Record<string, string>>(file, [
      { key: "driver", header: "ドライバー" },
      { key: "area", header: "エリア" },
      ...columns.map((c) => ({ key: c, header: c })),
    ]);

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
    return entries.length;
  }

  useCsvImportShortcut(() => setShowImportModal(true));

  return (
    <>
      <Head>
        <title>管理費集計 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>管理費集計</h2>
          </div>
          <div className="flex">
            <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} />
            <button className="btn btn--ghost" onClick={handleExport}>
              CSVエクスポート
            </button>
            <button className="btn btn--ghost" onClick={openNewModal}>
              + 新規
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

      </OperationLayout>

      {showImportModal && (
        <CsvImportModal
          title="管理費集計 CSVインポート"
          description="列: ドライバー・エリア・（表示中の項目名を列見出しとした金額）"
          onImport={handleImportFile}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showNewModal && (
        <Modal
          title="管理費 新規追加"
          subtitle={`対象月: ${month.slice(0, 7)}`}
          onClose={() => setShowNewModal(false)}
          wide
          headerAction={
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleBulkAdd}
              disabled={saving || !newRows.some((row) => row.driverId)}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          }
        >
          <div className="table-wrap" style={{ maxHeight: "68vh", overflowY: "auto" }}>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {newRows.map((newRow, index) => {
                  const driverRow = rows.find((row) => row.driverId === newRow.driverId);
                  return (
                    <tr key={index}>
                      <td style={{ padding: 0 }}>
                        <select
                          value={newRow.driverId}
                          onChange={(e) =>
                            setNewRows((prev) =>
                              prev.map((r, i) => (i === index ? { ...r, driverId: e.target.value } : r))
                            )
                          }
                        >
                          <option value="">選択してください</option>
                          {rows
                            .filter(
                              (row) =>
                                row.driverId === newRow.driverId ||
                                !newRows.some((r) => r.driverId === row.driverId)
                            )
                            .map((row) => (
                              <option key={row.driverId} value={row.driverId}>
                                {row.driverName}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>{driverRow?.areaName ?? "-"}</td>
                      {columns.map((col) => (
                        <td className="num" key={col} style={{ padding: 0 }}>
                          <input
                            className="price-input"
                            type="number"
                            value={newRow.amounts[col] ?? ""}
                            disabled={!newRow.driverId}
                            onChange={(e) =>
                              setNewRows((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? { ...r, amounts: { ...r.amounts, [col]: e.target.value } }
                                    : r
                                )
                              )
                            }
                          />
                        </td>
                      ))}
                      <td className="num">
                        <strong>{formatYen(newRowTotal(newRow))}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => removeNewRow(index)}
                          aria-label="この行を削除"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 12 }} onClick={addNewRow}>
            + 行を追加
          </button>
        </Modal>
      )}
    </>
  );
}
