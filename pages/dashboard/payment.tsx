import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import Modal from "@/components/Modal";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv } from "@/lib/csv";
import { getWeekRange } from "@/lib/date";
import type { PaymentNoticeDetail, PaymentNoticeRow, PaymentStatus } from "@/types/domain/payment";

const STATUS_TABS = ["すべて", "未承認", "仮確定", "確定"] as const;

const STATUS_TONE: Record<PaymentStatus, string> = {
  未承認: "pending",
  仮確定: "provisional",
  確定: "confirmed",
};

export default function PaymentPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("すべて");
  const [rows, setRows] = useState<PaymentNoticeRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payType, setPayType] = useState<"週払い" | "月払い">("週払い");
  const [periodStart, setPeriodStart] = useState(() => getWeekRange(new Date()).start);
  const [periodEnd, setPeriodEnd] = useState(() => getWeekRange(new Date()).end);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PaymentNoticeDetail | null>(null);
  const [reviseDraft, setReviseDraft] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "すべて") params.set("status", statusFilter);
      const res = await apiRequest<{ data: PaymentNoticeRow[] }>(`/api/payments?${params.toString()}`);
      setRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // ステータス切替時に選択状態をリセットする意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked({});
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const allChecked = rows.length > 0 && rows.every((row) => checked[row.id]);

  const toggleAll = () => {
    const next = { ...checked };
    rows.forEach((row) => {
      next[row.id] = !allChecked;
    });
    setChecked(next);
  };

  const selectedIds = useMemo(() => rows.filter((r) => checked[r.id]).map((r) => r.id), [rows, checked]);

  async function handleGenerate() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiRequest<{ generated: number }>("/api/payments/generate", {
        method: "POST",
        body: JSON.stringify({ pay_type: payType, period_start: periodStart, period_end: periodEnd }),
      });
      await loadAll();
      if (res.generated === 0) {
        setError("対象期間の承認済み件数データがある未生成のドライバーはいませんでした。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/payments/approve", { method: "POST", body: JSON.stringify({ ids: selectedIds }) });
      setChecked({});
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/payments/confirm", { method: "POST", body: JSON.stringify({ ids: selectedIds }) });
      setChecked({});
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "確定に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id: string) {
    setDetailId(id);
    setDetail(null);
    try {
      const res = await apiRequest<{ data: PaymentNoticeDetail }>(`/api/payments/${id}`);
      setDetail(res.data);
      setReviseDraft(Object.fromEntries(res.data.items.map((item) => [item.id, String(item.count)])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    }
  }

  async function handleRevise() {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/payments/${detail.id}/revise`, {
        method: "POST",
        body: JSON.stringify({
          items: detail.items.map((item) => ({ item_id: item.id, count: Number(reviseDraft[item.id]) || 0 })),
        }),
      });
      setDetailId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "修正の登録に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const csvRows = rows.map((row) => ({
      driver: row.driverName,
      area: row.areaName ?? "",
      pay_type: row.pay_type,
      period: `${row.period_start}〜${row.period_end}`,
      amount: row.amount,
      status: row.status,
      remarks: row.remarks ?? "",
    }));
    const csv = toCsv(csvRows, [
      { key: "driver", header: "ドライバー" },
      { key: "area", header: "エリア" },
      { key: "pay_type", header: "支払種別" },
      { key: "period", header: "対象期間" },
      { key: "amount", header: "金額" },
      { key: "status", header: "ステータス" },
      { key: "remarks", header: "備考" },
    ]);
    downloadCsv("支払通知書.csv", csv);
  }

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
            <button className="btn btn--ghost" onClick={handleExport}>
              CSVエクスポート
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div className="panel" style={{ marginBottom: 22 }}>
          <div className="panel__head">
            <h3>対象期間から仮確定候補を生成</h3>
          </div>
          <div className="panel__body">
            <div className="field-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="pay-type">支払種別</label>
                <select id="pay-type" value={payType} onChange={(e) => setPayType(e.target.value as typeof payType)}>
                  <option value="週払い">週払い</option>
                  <option value="月払い">月払い</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="period-start">対象期間開始</label>
                <input id="period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="period-end">対象期間終了</label>
                <input id="period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0, alignSelf: "end" }}>
                <button type="button" className="btn btn--ghost" onClick={handleGenerate} disabled={saving}>
                  {saving ? "生成中..." : "生成する"}
                </button>
              </div>
            </div>
            <p className="text-sm text-muted" style={{ marginTop: 8 }}>
              承認済みの件数集計データから未承認の支払通知書を生成します（既に生成済みのドライバーはスキップされます）。
            </p>
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
            <h3>支払通知書一覧</h3>
            <div className="flex" style={{ gap: 8 }}>
              {selectedIds.length > 0 && statusFilter !== "確定" && (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={statusFilter === "仮確定" ? handleConfirm : handleApprove}
                  disabled={saving}
                >
                  選択した{selectedIds.length}件を{statusFilter === "仮確定" ? "確定" : "承認"}
                </button>
              )}
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
                  <th>支払種別</th>
                  <th>対象期間</th>
                  <th className="num">金額</th>
                  <th>ステータス</th>
                  <th>備考</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <p className="empty-note">該当するステータスの支払通知書はありません。</p>
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!checked[row.id]}
                        onChange={(event) => setChecked((prev) => ({ ...prev, [row.id]: event.target.checked }))}
                      />
                    </td>
                    <td>{row.driverName}</td>
                    <td>{row.areaName ?? "-"}</td>
                    <td>{row.pay_type}</td>
                    <td className="text-sm">
                      {row.period_start}〜{row.period_end}
                    </td>
                    <td className="num">{row.amount.toLocaleString("ja-JP")}</td>
                    <td>
                      <span className={`pill pill--${STATUS_TONE[row.status]}`}>{row.status}</span>
                    </td>
                    <td className="text-sm text-muted">{row.remarks ?? ""}</td>
                    <td>
                      <button className="btn btn--sm" onClick={() => openDetail(row.id)}>
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </OperationLayout>

      {detailId && (
        <Modal
          title={`支払通知書詳細${detail ? ` — ${detail.driverName}` : ""}`}
          subtitle={detail ? `${detail.pay_type} / ${detail.period_start}〜${detail.period_end}` : undefined}
          onClose={() => setDetailId(null)}
        >
          {!detail ? (
            <p className="text-sm text-muted">読み込み中...</p>
          ) : (
            <>
              <p className="text-sm">
                <strong>ステータス：</strong>
                <span className={`pill pill--${STATUS_TONE[detail.status]}`}>{detail.status}</span>
              </p>
              <p className="text-sm">
                <strong>金額：</strong>
                {detail.amount.toLocaleString("ja-JP")}円
              </p>
              {detail.remarks && (
                <p className="text-sm text-muted">
                  <strong>備考：</strong>
                  {detail.remarks}
                </p>
              )}

              <p className="section-title" style={{ marginTop: 16 }}>
                件数内訳（修正可能）
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>区分</th>
                      <th className="num">件数</th>
                      <th className="num">単価</th>
                      <th className="num">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.categoryLabel}</td>
                        <td className="num" style={{ padding: 0 }}>
                          <input
                            className="price-input"
                            type="number"
                            value={reviseDraft[item.id] ?? "0"}
                            onChange={(e) => setReviseDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          />
                        </td>
                        <td className="num">{item.unit_price_snapshot.toLocaleString("ja-JP")}</td>
                        <td className="num">{item.amount.toLocaleString("ja-JP")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={handleRevise} disabled={saving}>
                {saving ? "登録中..." : "件数を修正して登録"}
              </button>
              {detail.status === "確定" && (
                <p className="text-sm text-muted" style={{ marginTop: 6 }}>
                  確定済みの通知書を修正すると未承認へ差し戻され、再承認が必要になります。
                </p>
              )}

              {detail.revisions.length > 0 && (
                <>
                  <p className="section-title" style={{ marginTop: 16 }}>
                    修正履歴
                  </p>
                  {detail.revisions.map((rev) => (
                    <p className="text-sm text-muted" key={rev.id}>
                      {new Date(rev.revised_at).toLocaleString("ja-JP")}：{rev.diff_summary}
                    </p>
                  ))}
                </>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
