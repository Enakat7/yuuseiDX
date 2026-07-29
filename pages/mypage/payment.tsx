import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import DriverLayout from "@/components/DriverLayout";
import Modal from "@/components/Modal";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv } from "@/lib/csv";
import type { MyPaymentDetail, MyPaymentRow } from "@/types/domain/mypage";

const STATUS_TABS = ["すべて", "仮確定", "確定"] as const;

const STATUS_TONE: Record<string, string> = {
  仮確定: "provisional",
  確定: "confirmed",
};

export default function DriverPaymentPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("すべて");
  const [rows, setRows] = useState<MyPaymentRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MyPaymentDetail | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "すべて") params.set("status", statusFilter);
      const res = await apiRequest<{ data: MyPaymentRow[] }>(`/api/me/payments?${params.toString()}`);
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

  const unacknowledgedRows = useMemo(() => rows.filter((r) => !r.driver_acknowledged_at), [rows]);
  const allChecked = unacknowledgedRows.length > 0 && unacknowledgedRows.every((row) => checked[row.id]);

  const toggleAll = () => {
    const next = { ...checked };
    unacknowledgedRows.forEach((row) => {
      next[row.id] = !allChecked;
    });
    setChecked(next);
  };

  const selectedIds = useMemo(() => rows.filter((r) => checked[r.id]).map((r) => r.id), [rows, checked]);

  async function handleAcknowledge(ids: string[]) {
    if (ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/me/payments/acknowledge", { method: "POST", body: JSON.stringify({ ids }) });
      setChecked({});
      await loadAll();
      if (detailId && ids.includes(detailId)) {
        const res = await apiRequest<{ data: MyPaymentDetail }>(`/api/me/payments/${detailId}`);
        setDetail(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "確認処理に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id: string) {
    setDetailId(id);
    setDetail(null);
    try {
      const res = await apiRequest<{ data: MyPaymentDetail }>(`/api/me/payments/${id}`);
      setDetail(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    }
  }

  function handleExport() {
    const csv = toCsv(
      rows.map((row) => ({
        pay_type: row.pay_type,
        period: `${row.period_start}〜${row.period_end}`,
        amount: row.amount,
        status: row.status,
        acknowledged: row.driver_acknowledged_at ? new Date(row.driver_acknowledged_at).toLocaleString("ja-JP") : "未確認",
      })),
      [
        { key: "pay_type", header: "支払種別" },
        { key: "period", header: "対象期間" },
        { key: "amount", header: "金額" },
        { key: "status", header: "ステータス" },
        { key: "acknowledged", header: "確認状況" },
      ]
    );
    downloadCsv("支払通知書.csv", csv);
  }

  return (
    <>
      <Head>
        <title>支払通知書 | YOU SAY!!</title>
      </Head>
      <DriverLayout>
        <div className="content__header" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>支払通知書</h2>
            <p className="content__lead">週払い：毎週金曜日発行　/　月払い：月末締め後発行</p>
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

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
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => handleAcknowledge(selectedIds)}
                  disabled={saving}
                >
                  選択した{selectedIds.length}件を確認しました
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleExport}>
                CSVダウンロード
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={unacknowledgedRows.length === 0} />
                  </th>
                  <th>対象期間</th>
                  <th>種別</th>
                  <th className="num">金額</th>
                  <th>ステータス</th>
                  <th>確認状況</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <p className="empty-note">該当する支払通知書はありません。</p>
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {!row.driver_acknowledged_at && (
                        <input
                          type="checkbox"
                          checked={!!checked[row.id]}
                          onChange={(event) => setChecked((prev) => ({ ...prev, [row.id]: event.target.checked }))}
                        />
                      )}
                    </td>
                    <td>
                      {row.period_start}〜{row.period_end}
                    </td>
                    <td>{row.pay_type}</td>
                    <td className="num">{row.amount.toLocaleString("ja-JP")}</td>
                    <td>
                      <span className={`pill pill--${STATUS_TONE[row.status] ?? "pending"}`}>{row.status}</span>
                    </td>
                    <td className="text-sm text-muted">
                      {row.driver_acknowledged_at ? new Date(row.driver_acknowledged_at).toLocaleDateString("ja-JP") + " 確認済み" : "未確認"}
                    </td>
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
      </DriverLayout>

      {detailId && (
        <Modal
          title="支払通知書詳細"
          subtitle={detail ? `${detail.pay_type} / ${detail.period_start}〜${detail.period_end}` : undefined}
          onClose={() => setDetailId(null)}
        >
          {!detail ? (
            <p className="text-sm text-muted">読み込み中...</p>
          ) : (
            <>
              <p className="text-sm">
                <strong>ステータス：</strong>
                <span className={`pill pill--${STATUS_TONE[detail.status] ?? "pending"}`}>{detail.status}</span>
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
                件数内訳
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
                        <td className="num">{item.count}</td>
                        <td className="num">{item.unit_price_snapshot.toLocaleString("ja-JP")}</td>
                        <td className="num">{item.amount.toLocaleString("ja-JP")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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

              <div style={{ marginTop: 18 }}>
                {detail.driver_acknowledged_at ? (
                  <p className="text-sm text-muted">
                    {new Date(detail.driver_acknowledged_at).toLocaleString("ja-JP")}に確認済みです。
                  </p>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={() => handleAcknowledge([detail.id])}
                    disabled={saving}
                  >
                    {saving ? "処理中..." : "確認しました"}
                  </button>
                )}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
