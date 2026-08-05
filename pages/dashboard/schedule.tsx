import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import Modal from "@/components/Modal";
import CsvImportModal from "@/components/CsvImportModal";
import Toast from "@/components/Toast";
import { buildMonthGridFromDistrictMap, DOW_LABELS, type MonthDistrictEntry } from "@/lib/calendar";
import { AREA_TABS } from "@/lib/constants";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import { addDays, getWeekDates, getWeekStartSunday, toIsoDate } from "@/lib/date";
import { useCsvImportShortcut } from "@/lib/useCsvImportShortcut";
import { useToast } from "@/lib/useToast";
import type { ScheduleRow } from "@/types/domain/schedule";
import type { DeliveryDistrictWithArea } from "@/types/domain/master";

const STATUS_LABEL: Record<string, string> = {
  未作成: "未作成",
  作成中: "作成中",
  作成済: "作成済",
};
const STATUS_TONE: Record<string, string> = {
  未作成: "pending",
  作成中: "alert",
  作成済: "confirmed",
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
  const { toast, showToast, hideToast } = useToast();

  const { start: periodStart, end: periodEnd } = useMemo(() => nextMonthRange(), []);

  const [openDriverId, setOpenDriverId] = useState<string | null>(null);
  const [monthDays, setMonthDays] = useState<Map<string, { deliveryDistrictId: string | null; worked: boolean }>>(
    new Map()
  );
  const [showImportModal, setShowImportModal] = useState(false);
  const [deliveryDistricts, setDeliveryDistricts] = useState<DeliveryDistrictWithArea[]>([]);

  useEffect(() => {
    // マスタ一覧は稼働表の日別セル選択肢として使うだけなので初回のみ取得する
    apiRequest<{ data: DeliveryDistrictWithArea[] }>("/api/master/delivery-districts")
      .then((res) => setDeliveryDistricts(res.data))
      .catch((err) => showToast(err instanceof Error ? err.message : "配達地区の取得に失敗しました。", "error"));
  }, [showToast]);

  const districtOptions = useMemo(
    () => deliveryDistricts.filter((d) => d.area === null || d.area.name === area),
    [deliveryDistricts, area]
  );
  const districtCodeToId = useMemo(() => new Map(deliveryDistricts.map((d) => [d.code, d.id])), [deliveryDistricts]);
  const districtById = useMemo(() => new Map(deliveryDistricts.map((d) => [d.id, d])), [deliveryDistricts]);

  async function loadAll() {
    setLoading(true);
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
      showToast(err instanceof Error ? err.message : "取得に失敗しました。", "error");
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

  async function setDay(driverId: string, dayIndex: number, deliveryDistrictId: string | null) {
    setSaving(true);
    try {
      await apiRequest("/api/schedule/days", {
        method: "POST",
        body: JSON.stringify({
          driver_id: driverId,
          work_date: weekDates[dayIndex].iso,
          delivery_district_id: deliveryDistrictId,
        }),
      });
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "更新に失敗しました。", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkSend() {
    const driverIds = rows.filter((r) => r.orderStatus === "作成済").map((r) => r.driverId);
    if (driverIds.length === 0) {
      showToast("作成済の発注書がありません。", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest<{ sent: number }>("/api/schedule/orders/send", {
        method: "POST",
        body: JSON.stringify({ driver_ids: driverIds, period_start: periodStart, period_end: periodEnd }),
      });
      await loadAll();
      showToast(`${res.sent}件の発注書を送信しました。`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "送信に失敗しました。", "error");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(driverId: string) {
    setOpenDriverId(driverId);
    const d = weekStart;
    try {
      const res = await apiRequest<{
        days: { workDate: string; worked: boolean; deliveryDistrictId: string | null }[];
      }>(`/api/schedule/month?driver_id=${driverId}&year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
      setMonthDays(
        new Map(res.days.map((day) => [day.workDate, { deliveryDistrictId: day.deliveryDistrictId, worked: day.worked }]))
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "取得に失敗しました。", "error");
    }
  }

  async function setOrderStatus(driverId: string, status: "作成中" | "作成済") {
    await apiRequest("/api/schedule/orders/status", {
      method: "POST",
      body: JSON.stringify({ driver_id: driverId, period_start: periodStart, period_end: periodEnd, status }),
    });
  }

  async function handleConfirmOrder() {
    if (!openDriverId) return;
    setSaving(true);
    try {
      await setOrderStatus(openDriverId, "作成済");
      setOpenDriverId(null);
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "確定に失敗しました。", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCloseCalendar() {
    const driverId = openDriverId;
    setOpenDriverId(null);
    if (!driverId) return;
    try {
      await setOrderStatus(driverId, "作成中");
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "更新に失敗しました。", "error");
    }
  }

  async function setMonthDay(day: number, deliveryDistrictId: string | null) {
    if (!openDriverId) return;
    const year = weekStart.getFullYear();
    const month = weekStart.getMonth() + 1;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSaving(true);
    try {
      await apiRequest("/api/schedule/days", {
        method: "POST",
        body: JSON.stringify({ driver_id: openDriverId, work_date: iso, delivery_district_id: deliveryDistrictId }),
      });
      const worked = deliveryDistrictId ? (districtById.get(deliveryDistrictId)?.area ?? null) !== null : false;
      setMonthDays((prev) => {
        const next = new Map(prev);
        next.set(iso, { deliveryDistrictId, worked });
        return next;
      });
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "更新に失敗しました。", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const csvRows = rows.map((row) => {
      const base: Record<string, string> = { driver: row.driverName };
      weekDates.forEach((d, index) => {
        base[d.label] = row.week[index].code ?? "-";
      });
      base["発注書状況"] = STATUS_LABEL[row.orderStatus ?? "未作成"];
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
        const code = raw.trim();
        const deliveryDistrictId = code === "-" ? null : (districtCodeToId.get(code) ?? null);
        if (code !== "-" && deliveryDistrictId === null) continue;
        await apiRequest("/api/schedule/days", {
          method: "POST",
          body: JSON.stringify({ driver_id: row.driverId, work_date: d.iso, delivery_district_id: deliveryDistrictId }),
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
    const entries = new Map<string, MonthDistrictEntry>();
    for (const [iso, day] of monthDays) {
      const district = day.deliveryDistrictId ? districtById.get(day.deliveryDistrictId) : undefined;
      entries.set(iso, {
        deliveryDistrictId: day.deliveryDistrictId,
        code: district?.code ?? null,
        backgroundColor: district?.background_color ?? null,
        worked: day.worked,
      });
    }
    return buildMonthGridFromDistrictMap(weekStart.getFullYear(), weekStart.getMonth() + 1, entries);
  }, [openDriver, monthDays, districtById, weekStart]);

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
          <div className="flex" style={{ gap: 12, alignItems: "center" }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleExport}>
              CSVエクスポート
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={handleBulkSend} disabled={saving}>
              一括送信
            </button>
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
                  const status = driver.orderStatus ?? "未作成";
                  return (
                    <tr key={driver.driverId}>
                      <td>{driver.driverName}</td>
                      {driver.week.map((cell, index) => (
                        <td key={index}>
                          <select
                            value={cell.deliveryDistrictId ?? ""}
                            onChange={(e) => setDay(driver.driverId, index, e.target.value || null)}
                            disabled={saving}
                            style={{ backgroundColor: cell.backgroundColor ?? undefined }}
                          >
                            <option value="">-</option>
                            {districtOptions.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.code}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                      <td>
                        <span className={`pill pill--${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td>
                        <button type="button" className="btn btn--sm" onClick={() => openDetail(driver.driverId)}>
                          詳細
                        </button>
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
          onClose={handleCloseCalendar}
          wide
          headerAction={
            <button type="button" className="btn btn--primary btn--sm" onClick={handleConfirmOrder} disabled={saving}>
              確定
            </button>
          }
        >
          <div className="flex" style={{ gap: 24, alignItems: "flex-start" }}>
            <div
              style={{
                width: 240,
                flexShrink: 0,
                maxHeight: 560,
                overflowY: "auto",
                borderRight: "var(--border-w-sm) solid var(--gray-150)",
                paddingRight: 16,
              }}
            >
              <p className="month-cal__stat-label" style={{ marginBottom: 8 }}>
                配達地区コード一覧
              </p>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {districtOptions.map((d) => (
                  <li key={d.id} className="flex" style={{ gap: 8, alignItems: "center", fontSize: 12 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        flexShrink: 0,
                        background: d.background_color,
                        border: "1px solid var(--gray-300)",
                      }}
                    />
                    <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{d.code}</span>
                    <span style={{ color: "var(--gray-600)" }}>{d.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
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
                    <div
                      className={`month-cal__day month-cal__day--select ${cell.worked ? "is-work" : "is-off"}`}
                      key={index}
                      style={{ cursor: "default" }}
                    >
                      <span>{cell.day}</span>
                      <select
                        value={cell.deliveryDistrictId ?? ""}
                        onChange={(e) => setMonthDay(cell.day as number, e.target.value || null)}
                        disabled={saving}
                        style={{ backgroundColor: cell.backgroundColor ?? undefined }}
                      >
                        <option value="">-</option>
                        {districtOptions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code}
                          </option>
                        ))}
                      </select>
                    </div>
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
            </div>
          </div>
        </Modal>
      )}

      {showImportModal && (
        <CsvImportModal
          title="発注書(稼働表) CSVインポート"
          description="表示中の週に取り込みます。列: ドライバー・（曜日ラベルを列見出しとした配達地区コード/-）"
          onImport={handleImportFile}
          onClose={() => setShowImportModal(false)}
        />
      )}

      <Toast toast={toast} onClose={hideToast} />
    </>
  );
}
