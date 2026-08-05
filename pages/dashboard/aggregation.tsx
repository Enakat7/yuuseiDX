import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import CsvImportModal from "@/components/CsvImportModal";
import Modal from "@/components/Modal";
import { addDays, formatDate } from "@/lib/date";
import { AREA_FILTER_TABS } from "@/lib/constants";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import { useCsvImportShortcut } from "@/lib/useCsvImportShortcut";
import type { CountCategory } from "@/types/domain/master";
import type { CountRow, CountSummaryRow } from "@/types/domain/count";

const PERIODS = ["日次", "週次", "月次"] as const;
type Period = (typeof PERIODS)[number];

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AggregationPage() {
  const [area, setArea] = useState<(typeof AREA_FILTER_TABS)[number]>("全エリア");
  const [date, setDate] = useState(() => new Date());
  const [period, setPeriod] = useState<Period>("日次");
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<CountCategory[]>([]);
  const [rows, setRows] = useState<CountRow[]>([]);
  const [summaryRows, setSummaryRows] = useState<CountSummaryRow[]>([]);
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newRows, setNewRows] = useState<{ driverId: string; counts: Record<string, string> }[]>([]);

  useEffect(() => {
    // 件数区分（10区分）は初回のみ取得すればよい
    apiRequest<{ data: CountCategory[] }>("/api/counts/categories")
      .then((res) => setCategories(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました。"));
  }, []);

  const isoDate = useMemo(() => toIsoDate(date), [date]);
  const areaParam = area === "全エリア" ? "" : area;

  async function loadDaily() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date: isoDate });
      if (areaParam) params.set("area", areaParam);
      const res = await apiRequest<{ data: CountRow[] }>(`/api/counts?${params.toString()}`);
      setRows(res.data);
      const nextDraft: Record<string, Record<string, string>> = {};
      for (const row of res.data) {
        nextDraft[row.driverId] = Object.fromEntries(
          Object.entries(row.counts).map(([catId, value]) => [catId, String(value)])
        );
      }
      setDraft(nextDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary(p: "weekly" | "monthly") {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date: isoDate, period: p });
      if (areaParam) params.set("area", areaParam);
      const res = await apiRequest<{ data: CountSummaryRow[] }>(`/api/counts/summary?${params.toString()}`);
      setSummaryRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 日付/エリア/期間切替時に編集・選択状態をリセットする意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditMode(false);
    setChecked({});
    if (period === "日次") {
      loadDaily();
    } else {
      loadSummary(period === "週次" ? "weekly" : "monthly");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isoDate, areaParam, period]);

  const allChecked = rows.length > 0 && rows.every((row) => checked[row.driverId]);

  const toggleAll = () => {
    const next = { ...checked };
    rows.forEach((row) => {
      next[row.driverId] = !allChecked;
    });
    setChecked(next);
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // 他の利用者が同時に編集している場合に触っていないセルまで上書きしてしまわないよう、
      // 読み込み時点の値（rows）から実際に変更されたセルのみを送信する。
      const changedRows = rows
        .map((row) => {
          const counts: Record<string, number> = {};
          for (const [catId, rawValue] of Object.entries(draft[row.driverId] ?? {})) {
            const newValue = Number(rawValue) || 0;
            if (newValue !== (row.counts[catId] ?? 0)) {
              counts[catId] = newValue;
            }
          }
          return { driver_id: row.driverId, counts };
        })
        .filter((row) => Object.keys(row.counts).length > 0);

      if (changedRows.length > 0) {
        await apiRequest("/api/counts", {
          method: "POST",
          body: JSON.stringify({ work_date: isoDate, rows: changedRows }),
        });
      }
      setEditMode(false);
      await loadDaily();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function openNewModal() {
    setNewRows([{ driverId: "", counts: {} }]);
    setShowNewModal(true);
  }

  function addNewRow() {
    setNewRows((prev) => [...prev, { driverId: "", counts: {} }]);
  }

  function removeNewRow(index: number) {
    setNewRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleBulkAdd() {
    const bodyRows = newRows
      .filter((row) => row.driverId)
      .map((row) => {
        const counts: Record<string, number> = {};
        for (const cat of categories) {
          const raw = row.counts[cat.id];
          if (raw === undefined || raw === "") continue;
          counts[cat.id] = Number(raw) || 0;
        }
        return { driver_id: row.driverId, counts };
      })
      .filter((row) => Object.keys(row.counts).length > 0);
    if (bodyRows.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/counts", {
        method: "POST",
        body: JSON.stringify({ work_date: isoDate, rows: bodyRows }),
      });
      setShowNewModal(false);
      await loadDaily();
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    const driverIds = rows.filter((row) => checked[row.driverId]).map((row) => row.driverId);
    if (driverIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/counts/approve", {
        method: "POST",
        body: JSON.stringify({ work_date: isoDate, driver_ids: driverIds }),
      });
      setChecked({});
      await loadDaily();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    if (period === "日次") {
      const csvRows = rows.map((row) => ({
        driver: row.driverName,
        area: row.areaName ?? "",
        ...Object.fromEntries(categories.map((c) => [c.id, row.counts[c.id] ?? 0])),
      }));
      const csv = toCsv(csvRows, [
        { key: "driver", header: "ドライバー" },
        { key: "area", header: "エリア" },
        ...categories.map((c) => ({ key: c.id as keyof (typeof csvRows)[number], header: c.label })),
      ]);
      downloadCsv(`件数集計_${isoDate}.csv`, csv);
    } else {
      const csvRows = summaryRows.map((row) => ({
        driver: row.driverName,
        area: row.areaName ?? "",
        ...Object.fromEntries(categories.map((c) => [c.id, row.totals[c.id] ?? 0])),
      }));
      const csv = toCsv(csvRows, [
        { key: "driver", header: "ドライバー" },
        { key: "area", header: "エリア" },
        ...categories.map((c) => ({ key: c.id as keyof (typeof csvRows)[number], header: c.label })),
      ]);
      downloadCsv(`件数集計_${period}_${isoDate}.csv`, csv);
    }
  }

  async function handleImportFile(file: File) {
    const parsedRows = await parseCsv<Record<string, string>>(file, [
      { key: "driver", header: "ドライバー" },
      { key: "area", header: "エリア" },
      ...categories.map((c) => ({ key: c.id, header: c.label })),
    ]);

    const importRows: { driver_id: string; counts: Record<string, number> }[] = [];
    for (const parsedRow of parsedRows) {
      const row = rows.find((r) => r.driverName === parsedRow.driver);
      if (!row) continue;
      const counts: Record<string, number> = {};
      for (const cat of categories) {
        const raw = parsedRow[cat.id];
        if (raw === undefined || raw === "") continue;
        counts[cat.id] = Number(raw) || 0;
      }
      importRows.push({ driver_id: row.driverId, counts });
    }
    if (importRows.length > 0) {
      await apiRequest("/api/counts", {
        method: "POST",
        body: JSON.stringify({ work_date: isoDate, rows: importRows }),
      });
    }
    await loadDaily();
    return importRows.length;
  }

  useCsvImportShortcut(() => setShowImportModal(true), period === "日次");

  return (
    <>
      <Head>
        <title>件数集計 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>件数集計</h2>
            <p className="content__lead">
              専用画面から管理者/スタッフが直接入力した件数を集計・承認します（日報機能はありません）。
            </p>
          </div>
          <div className="flex" style={{ alignItems: "center" }}>
            <div className="date-nav">
              <button
                type="button"
                className="date-nav__btn"
                aria-label="前日"
                onClick={() => setDate((d) => addDays(d, -1))}
              >
                ‹
              </button>
              <span
                className="date-nav__value"
                style={{ position: "relative", cursor: "pointer" }}
                onClick={() => dateInputRef.current?.showPicker?.()}
              >
                {formatDate(date)}
                <input
                  ref={dateInputRef}
                  type="date"
                  value={toIsoDate(date)}
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split("-").map(Number);
                    if (y && m && d) setDate(new Date(y, m - 1, d));
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                />
              </span>
              <button
                type="button"
                className="date-nav__btn"
                aria-label="翌日"
                onClick={() => setDate((d) => addDays(d, 1))}
              >
                ›
              </button>
            </div>
            <button className="btn btn--ghost" onClick={handleExport}>
              CSVエクスポート
            </button>
            {period === "日次" && (
              <button type="button" className="btn btn--ghost" onClick={openNewModal}>
                + 新規
              </button>
            )}
            {period === "日次" &&
              (editMode ? (
                <button type="button" className="btn btn--ghost" onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </button>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setEditMode(true)}>
                  編集
                </button>
              ))}
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
            <h3>件数内訳（種類別）</h3>
            <div className="tabbar" style={{ marginBottom: 0 }}>
              {PERIODS.map((p) => (
                <a
                  key={p}
                  href="#"
                  className={p === period ? "is-active" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    setPeriod(p);
                  }}
                >
                  {p}
                </a>
              ))}
            </div>
          </div>

          {period === "日次" ? (
            <>
              {rows.some((r) => checked[r.driverId]) && (
                <div style={{ padding: "10px 22px" }}>
                  <button type="button" className="btn btn--sm" onClick={handleApprove} disabled={saving}>
                    選択した{Object.values(checked).filter(Boolean).length}件を承認
                  </button>
                </div>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                      </th>
                      <th>ドライバー</th>
                      <th>エリア</th>
                      <th>承認</th>
                      {categories.map((col) => (
                        <th className="num" key={col.id}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && rows.length === 0 && (
                      <tr>
                        <td colSpan={categories.length + 4}>
                          <p className="empty-note">このエリアの件数データはありません。</p>
                        </td>
                      </tr>
                    )}
                    {rows.map((row) => (
                      <tr key={row.driverId}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!checked[row.driverId]}
                            onChange={(event) =>
                              setChecked((prev) => ({ ...prev, [row.driverId]: event.target.checked }))
                            }
                          />
                        </td>
                        <td>{row.driverName}</td>
                        <td>{row.areaName ?? "-"}</td>
                        <td>
                          <span className={`pill pill--${row.approved ? "confirmed" : "pending"}`}>
                            {row.approved ? "承認済" : "未承認"}
                          </span>
                        </td>
                        {categories.map((col) =>
                          editMode ? (
                            <td className="num" key={col.id} style={{ padding: 0 }}>
                              <input
                                className="price-input"
                                type="number"
                                value={draft[row.driverId]?.[col.id] ?? "0"}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    [row.driverId]: { ...prev[row.driverId], [col.id]: event.target.value },
                                  }))
                                }
                              />
                            </td>
                          ) : (
                            <td className="num" key={col.id}>
                              {row.counts[col.id] ?? 0}
                            </td>
                          )
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ドライバー</th>
                    <th>エリア</th>
                    {categories.map((col) => (
                      <th className="num" key={col.id}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && summaryRows.length === 0 && (
                    <tr>
                      <td colSpan={categories.length + 2}>
                        <p className="empty-note">このエリアの件数データはありません。</p>
                      </td>
                    </tr>
                  )}
                  {summaryRows.map((row) => (
                    <tr key={row.driverId}>
                      <td>{row.driverName}</td>
                      <td>{row.areaName ?? "-"}</td>
                      {categories.map((col) => (
                        <td className="num" key={col.id}>
                          {row.totals[col.id] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </OperationLayout>

      {showImportModal && (
        <CsvImportModal
          title="件数集計 CSVインポート"
          description="日次表示中の対象日に取り込みます。列: ドライバー・エリア・（件数区分名を列見出しとした件数）"
          onImport={handleImportFile}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showNewModal && (
        <Modal
          title="件数 新規追加"
          subtitle={`対象日: ${isoDate}`}
          onClose={() => setShowNewModal(false)}
          wide
          headerAction={
            <button
              type="button"
              className="btn btn--ghost btn--sm"
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
                  {categories.map((col) => (
                    <th className="num" key={col.id}>
                      {col.label}
                    </th>
                  ))}
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
                      {categories.map((col) => (
                        <td className="num" key={col.id} style={{ padding: 0 }}>
                          <input
                            className="price-input"
                            type="number"
                            value={newRow.counts[col.id] ?? ""}
                            disabled={!newRow.driverId}
                            onChange={(e) =>
                              setNewRows((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? { ...r, counts: { ...r.counts, [col.id]: e.target.value } }
                                    : r
                                )
                              )
                            }
                          />
                        </td>
                      ))}
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
