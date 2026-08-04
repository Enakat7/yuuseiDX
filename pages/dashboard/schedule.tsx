import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import Modal from "@/components/Modal";
import CsvImportModal from "@/components/CsvImportModal";
import { buildMonthGridFromDates, DOW_LABELS } from "@/lib/calendar";
import { AREA_TABS } from "@/lib/constants";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import { addDays, getWeekDates, getWeekStartSunday, toIsoDate } from "@/lib/date";
import { useCsvImportShortcut } from "@/lib/useCsvImportShortcut";
import type { ScheduleRow } from "@/types/domain/schedule";

const STATUS_LABEL: Record<string, string> = {
  未送信: "未送信",
  送信済: "送信済",
  要再送信: "要再送信",
};
const STATUS_TONE: Record<string, string> = {
  未送信: "pending",
  送信済: "confirmed",
  要再送信: "alert",
};

function nextMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export default function SchedulePage() {
  const [area, setArea] = useState<(typeof AREA_TABS)[number]>("西");
  const [weekStart, setWeekStart] = useState(() => new Date(getWeekStartSunday(new Date())));
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [weekDates, setWeekDates] = useState(() => getWeekDates(weekStart));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultPeriod = useMemo(() => nextMonthRange(), []);
  const [periodStart, setPeriodStart] = useState(defaultPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod.end);

  const [openDriverId, setOpenDriverId] = useState<string | null>(null);
  const [monthWorkedDates, setMonthWorkedDates] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        area,
        week_start: toIsoDate(weekStart),
        period_start: periodStart,
        period_end: periodEnd,
      });
      const res = await apiRequest<{ data: ScheduleRow[]; weekDates: { iso: string; label: string }[] }>(
        `/api/schedule?${params.toString()}`
      );
      setRows(res.data);
      setWeekDates(res.weekDates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // エリア/週/対象期間切替時にAPI経由で再取得する意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, weekStart, periodStart, periodEnd]);

  async function toggleDay(driverId: string, dayIndex: number) {
    const row = rows.find((r) => r.driverId === driverId);
    if (!row) return;
    const nextWorked = !row.week[dayIndex];
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/schedule/days", {
        method: "POST",
        body: JSON.stringify({ driver_id: driverId, work_date: weekDates[dayIndex].iso, worked: nextWorked }),
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleIssueAll() {
    const driverIds = rows.filter((r) => !r.orderStatus).map((r) => r.driverId);
    if (driverIds.length === 0) {
      setError("対象期間の発注書が未発行のドライバーはいません。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/schedule/issue", {
        method: "POST",
        body: JSON.stringify({ driver_ids: driverIds, period_start: periodStart, period_end: periodEnd }),
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "発行に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleReissue(orderId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/schedule/reissue", { method: "POST", body: JSON.stringify({ order_id: orderId }) });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "再発行に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(driverId: string) {
    setOpenDriverId(driverId);
    const d = weekStart;
    try {
      const res = await apiRequest<{ workedDates: string[] }>(
        `/api/schedule/month?driver_id=${driverId}&year=${d.getFullYear()}&month=${d.getMonth() + 1}`
      );
      setMonthWorkedDates(new Set(res.workedDates));
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    }
  }

  async function toggleMonthDay(day: number) {
    if (!openDriverId) return;
    const year = weekStart.getFullYear();
    const month = weekStart.getMonth() + 1;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const nextWorked = !monthWorkedDates.has(iso);
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/schedule/days", {
        method: "POST",
        body: JSON.stringify({ driver_id: openDriverId, work_date: iso, worked: nextWorked }),
      });
      setMonthWorkedDates((prev) => {
        const next = new Set(prev);
        if (nextWorked) next.add(iso);
        else next.delete(iso);
        return next;
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const csvRows = rows.map((row) => {
      const base: Record<string, string> = { driver: row.driverName };
      weekDates.forEach((d, index) => {
        base[d.label] = row.week[index] ? "◯" : "-";
      });
      base["発注書状況"] = STATUS_LABEL[row.orderStatus ?? "未送信"];
      return base;
    });
    const csv = toCsv(csvRows, [
      { key: "driver", header: "ドライバー" },
      ...weekDates.map((d) => ({ key: d.label as keyof (typeof csvRows)[number], header: d.label })),
      { key: "発注書状況", header: "発注書状況" },
    ]);
    downloadCsv(`稼働表_${area}_${toIsoDate(weekStart)}.csv`, csv);
  }

  async function handleImportFile(file: File) {
    const parsedRows = await parseCsv<Record<string, string>>(file, [
      { key: "driver", header: "ドライバー" },
      ...weekDates.map((d) => ({ key: d.label, header: d.label })),
    ]);

    let count = 0;
    for (const parsedRow of parsedRows) {
      const row = rows.find((r) => r.driverName === parsedRow.driver);
      if (!row) continue;
      for (const d of weekDates) {
        const raw = parsedRow[d.label];
        if (raw === undefined || raw === "") continue;
        await apiRequest("/api/schedule/days", {
          method: "POST",
          body: JSON.stringify({ driver_id: row.driverId, work_date: d.iso, worked: raw.trim() === "◯" }),
        });
      }
      count += 1;
    }
    await loadAll();
    return count;
  }

  useCsvImportShortcut(() => setShowImportModal(true));

  const openDriver = rows.find((r) => r.driverId === openDriverId) ?? null;
  const monthGrid = useMemo(() => {
    if (!openDriver) return null;
    return buildMonthGridFromDates(weekStart.getFullYear(), weekStart.getMonth() + 1, monthWorkedDates);
  }, [openDriver, monthWorkedDates, weekStart]);

  return (
    <>
      <Head>
        <title>発注書(稼働表) | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>エリア別 稼働表</h2>
            <p className="content__lead">エリアタブを切り替えて、ドライバーごとの稼働状況を確認します。</p>
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div className="panel" style={{ marginBottom: 22 }}>
          <div className="panel__head">
            <h3>発注書の対象期間・発行</h3>
          </div>
          <div className="panel__body">
            <div className="field-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="period-start">対象期間開始</label>
                <input id="period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="period-end">対象期間終了</label>
                <input id="period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0, alignSelf: "end" }}>
                <button type="button" className="btn btn--ghost" onClick={handleIssueAll} disabled={saving}>
                  未発行分を一括発行
                </button>
              </div>
            </div>
            <p className="text-sm text-muted" style={{ marginTop: 8 }}>
              発注書は自動発行ではなく手動で発行します（デフォルトは翌月分）。稼働内容の変更後は自動的に「要再送信」になります。
            </p>
          </div>
        </div>

        <div className="tabbar" style={{ marginBottom: 22 }}>
          {AREA_TABS.map((a) => (
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
            <h3>{area}エリア — 稼働表</h3>
            <div className="flex" style={{ gap: 12, alignItems: "center" }}>
              <span className="text-sm text-muted">{rows.length}名 稼働中</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleExport}>
                CSVエクスポート
              </button>
              <div className="date-nav">
                <button
                  type="button"
                  className="date-nav__btn"
                  aria-label="前週"
                  onClick={() => setWeekStart((d) => addDays(d, -7))}
                >
                  ‹
                </button>
                <span className="date-nav__value">
                  {weekDates[0]?.label}〜{weekDates[6]?.label}
                </span>
                <button
                  type="button"
                  className="date-nav__btn"
                  aria-label="翌週"
                  onClick={() => setWeekStart((d) => addDays(d, 7))}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ドライバー</th>
                  {weekDates.map((d) => (
                    <th key={d.iso}>{d.label}</th>
                  ))}
                  <th>発注書状況</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={10}>
                      <p className="empty-note">このエリアの稼働表データはまだありません。</p>
                    </td>
                  </tr>
                )}
                {rows.map((driver) => {
                  const status = driver.orderStatus ?? "未送信";
                  return (
                    <tr key={driver.driverId}>
                      <td>{driver.driverName}</td>
                      {driver.week.map((worked, index) => (
                        <td key={index}>
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            style={{ padding: "4px 10px" }}
                            onClick={() => toggleDay(driver.driverId, index)}
                            disabled={saving}
                          >
                            {worked ? "◯" : "-"}
                          </button>
                        </td>
                      ))}
                      <td>
                        <span className={`pill pill--${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td>
                        <div className="flex" style={{ gap: 8 }}>
                          <button type="button" className="btn btn--sm" onClick={() => openDetail(driver.driverId)}>
                            詳細
                          </button>
                          {driver.orderStatus === "要再送信" && driver.orderId && (
                            <button
                              type="button"
                              className="btn btn--sm"
                              onClick={() => handleReissue(driver.orderId as string)}
                              disabled={saving}
                            >
                              再発行
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </OperationLayout>

      {openDriver && monthGrid && (
        <Modal
          title={`${openDriver.driverName} — 稼働カレンダー`}
          subtitle={`${area}エリア${
            openDriver.districtNames.length > 0 ? ` / ${openDriver.districtNames.join("・")}` : ""
          } ／ ${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月`}
          onClose={() => setOpenDriverId(null)}
        >
          <div className="month-cal__stats">
            <div>
              <div className="month-cal__stat-label">稼働日数</div>
              <div className="month-cal__stat-value">
                {monthGrid.workCount}
                <small style={{ fontSize: 12, fontWeight: 700, marginLeft: 2 }}>日</small>
              </div>
            </div>
            <div>
              <div className="month-cal__stat-label">休み</div>
              <div className="month-cal__stat-value">
                {monthGrid.daysInMonth - monthGrid.workCount}
                <small style={{ fontSize: 12, fontWeight: 700, marginLeft: 2 }}>日</small>
              </div>
            </div>
          </div>

          <div className="month-cal">
            {DOW_LABELS.map((d) => (
              <div className="month-cal__dow" key={d}>
                {d}
              </div>
            ))}
            {monthGrid.cells.map((cell, index) =>
              cell.day === null ? (
                <div className="month-cal__day is-empty" key={index} />
              ) : (
                <button
                  type="button"
                  className={`month-cal__day ${cell.isWork ? "is-work" : "is-off"}`}
                  key={index}
                  onClick={() => toggleMonthDay(cell.day as number)}
                  disabled={saving}
                >
                  <span>{cell.day}</span>
                  <span className="month-cal__mark" />
                </button>
              )
            )}
          </div>

          <div className="month-cal__legend">
            <span className="flex">
              <span className="month-cal__mark" />
              稼働
            </span>
            <span className="flex">
              <span className="month-cal__mark" style={{ background: "var(--gray-300)" }} />
              休み
            </span>
          </div>
        </Modal>
      )}

      {showImportModal && (
        <CsvImportModal
          title="発注書(稼働表) CSVインポート"
          description="表示中の週に取り込みます。列: ドライバー・（曜日ラベルを列見出しとした◯/-）"
          onImport={handleImportFile}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </>
  );
}
