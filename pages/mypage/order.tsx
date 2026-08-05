import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import DriverLayout from "@/components/DriverLayout";
import Modal from "@/components/Modal";
import { apiRequest } from "@/lib/apiClient";
import { buildMonthGridFromDistrictMap, DOW_LABELS, type MonthDistrictEntry } from "@/lib/calendar";
import { toCsv, downloadCsv } from "@/lib/csv";
import type { MyOrderMonthDay, MyOrderRow } from "@/types/domain/mypage";

const APPROVAL_TONE: Record<string, string> = {
  承認済: "confirmed",
  未承認: "pending",
};

function approvalLabel(order: MyOrderRow): "承認済" | "未承認" {
  return order.driver_approved_at ? "承認済" : "未承認";
}

export default function DriverOrderPage() {
  const [orders, setOrders] = useState<MyOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [monthDays, setMonthDays] = useState<MyOrderMonthDay[]>([]);
  const [monthYear, setMonthYear] = useState<number | null>(null);
  const [monthMonth, setMonthMonth] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [requestingCorrection, setRequestingCorrection] = useState(false);

  useEffect(() => {
    // 初回マウント時にAPI経由で発注書一覧を取得する意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiRequest<{ data: MyOrderRow[] }>("/api/me/orders")
      .then((res) => setOrders(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  async function openDetail(orderId: string) {
    setOpenOrderId(orderId);
    try {
      const res = await apiRequest<{ days: MyOrderMonthDay[]; year: number; month: number }>(
        `/api/me/orders/${orderId}/month`
      );
      setMonthDays(res.days);
      setMonthYear(res.year);
      setMonthMonth(res.month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    }
  }

  async function handleApprove() {
    if (!openOrderId) return;
    setApproving(true);
    try {
      const res = await apiRequest<{ data: MyOrderRow }>(`/api/me/orders/${openOrderId}/approve`, {
        method: "POST",
      });
      setOrders((prev) => prev.map((o) => (o.id === res.data.id ? res.data : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました。");
    } finally {
      setApproving(false);
    }
  }

  async function handleRequestCorrection() {
    if (!openOrderId) return;
    setRequestingCorrection(true);
    try {
      await apiRequest(`/api/me/orders/${openOrderId}/request-correction`, { method: "POST" });
      setOrders((prev) => prev.filter((o) => o.id !== openOrderId));
      setOpenOrderId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "修正依頼に失敗しました。");
    } finally {
      setRequestingCorrection(false);
    }
  }

  function handleExport() {
    const csv = toCsv(
      orders.map((o) => ({
        period: `${o.period_start}〜${o.period_end}`,
        status: approvalLabel(o),
        issued: o.issued_at ? new Date(o.issued_at).toLocaleDateString("ja-JP") : "",
      })),
      [
        { key: "period", header: "対象期間" },
        { key: "status", header: "ステータス" },
        { key: "issued", header: "発行日" },
      ]
    );
    downloadCsv("発注書.csv", csv);
  }

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;
  const monthGrid = useMemo(() => {
    if (!openOrder || monthYear === null || monthMonth === null) return null;
    const entries = new Map<string, MonthDistrictEntry>(
      monthDays.map((d) => [
        d.workDate,
        { deliveryDistrictId: null, code: d.code, backgroundColor: d.backgroundColor, worked: d.worked },
      ])
    );
    return buildMonthGridFromDistrictMap(monthYear, monthMonth, entries);
  }, [openOrder, monthYear, monthMonth, monthDays]);

  return (
    <>
      <Head>
        <title>発注書 | YOU SAY!!</title>
      </Head>
      <DriverLayout>
        <div className="content__header" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>発注書</h2>
            <p className="content__lead">月末に翌月分の発注書（稼働表）が発行されます。</p>
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div className="panel">
          <div className="panel__head">
            <h3>発注書一覧</h3>
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleExport}>
              CSVダウンロード
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>対象期間</th>
                  <th>発行日</th>
                  <th>ステータス</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <p className="empty-note">発注書はまだありません。</p>
                    </td>
                  </tr>
                )}
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      {order.period_start}〜{order.period_end}
                    </td>
                    <td>{order.issued_at ? new Date(order.issued_at).toLocaleDateString("ja-JP") : "-"}</td>
                    <td>
                      <span className={`pill pill--${APPROVAL_TONE[approvalLabel(order)]}`}>
                        {approvalLabel(order)}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn btn--sm" onClick={() => openDetail(order.id)}>
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DriverLayout>

      {openOrder && monthGrid && (
        <Modal
          title="稼働カレンダー"
          subtitle={`${monthYear}年${monthMonth}月 対象期間：${openOrder.period_start}〜${openOrder.period_end}`}
          onClose={() => setOpenOrderId(null)}
          headerAction={
            openOrder.driver_approved_at ? (
              <span className={`pill pill--${APPROVAL_TONE.承認済}`}>承認済</span>
            ) : (
              <div className="flex" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleRequestCorrection}
                  disabled={approving || requestingCorrection}
                >
                  {requestingCorrection ? "送信中..." : "修正依頼"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleApprove}
                  disabled={approving || requestingCorrection}
                >
                  {approving ? "承認中..." : "承認する"}
                </button>
              </div>
            )
          }
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
                <div
                  className={`month-cal__day ${cell.worked ? "is-work" : "is-off"}`}
                  key={index}
                  style={{ backgroundColor: cell.backgroundColor ?? undefined }}
                >
                  <span>{cell.day}</span>
                  <span style={{ fontSize: 10, fontWeight: 700 }}>{cell.code ?? "-"}</span>
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
        </Modal>
      )}
    </>
  );
}
