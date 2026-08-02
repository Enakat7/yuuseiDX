import Head from "next/head";
import { useEffect, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import CsvImportModal from "@/components/CsvImportModal";
import Modal from "@/components/Modal";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import { useCsvImportShortcut } from "@/lib/useCsvImportShortcut";
import type { AdvanceRequestRow, AdvanceStatus } from "@/types/domain/advance";
import type { Driver } from "@/types/domain/master";

const STATUS_TONE: Record<AdvanceStatus, string> = {
  申請中: "pending",
  "超過（要確認）": "alert",
  実行済: "confirmed",
};

function formatYen(value: number) {
  return value.toLocaleString("ja-JP");
}

export default function AdvancePage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [requests, setRequests] = useState<AdvanceRequestRow[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const [payoutDate, setPayoutDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  async function loadInitial() {
    setLoading(true);
    setError(null);
    try {
      const [driverRes, requestRes] = await Promise.all([
        apiRequest<{ data: { id: string; name: string; active: boolean }[] }>("/api/master/drivers"),
        apiRequest<{ data: AdvanceRequestRow[] }>("/api/advance"),
      ]);
      setDrivers(driverRes.data as Driver[]);
      setRequests(requestRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 初回マウント時にAPI経由で一覧取得する意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitial();
  }, []);

  function openCreateModal() {
    setSelectedDriverId("");
    setPayoutDate("");
    setAmount("");
    setNote("");
    setShowCreateModal(true);
  }

  async function handleCreate() {
    if (!selectedDriverId || !payoutDate || !amount) {
      setError("ドライバー・入金日・前払金額は必須です。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/advance", {
        method: "POST",
        body: JSON.stringify({
          driver_id: selectedDriverId,
          payout_date: payoutDate,
          amount: Number(amount),
          note,
        }),
      });
      setPayoutDate("");
      setAmount("");
      setNote("");
      setShowCreateModal(false);
      await loadInitial();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleExecute(id: string) {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/advance/${id}/execute`, { method: "POST" });
      await loadInitial();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const csv = toCsv(
      requests.map((r) => ({
        request_no: r.request_no,
        driver: r.driverName,
        payout_date: r.payout_date,
        amount: r.amount,
        available: r.available_amount_snapshot,
        status: r.status,
        note: r.note ?? "",
      })),
      [
        { key: "request_no", header: "依頼No" },
        { key: "driver", header: "ドライバー" },
        { key: "payout_date", header: "入金日" },
        { key: "amount", header: "前払金額" },
        { key: "available", header: "前払可能額" },
        { key: "status", header: "ステータス" },
        { key: "note", header: "備考" },
      ]
    );
    downloadCsv("前払依頼書.csv", csv);
  }

  async function handleImportFile(file: File) {
    const parsedRows = await parseCsv<{ driver: string; payout_date: string; amount: string; note: string }>(file, [
      { key: "driver", header: "ドライバー" },
      { key: "payout_date", header: "入金日" },
      { key: "amount", header: "前払金額" },
      { key: "note", header: "備考" },
    ]);

    let count = 0;
    for (const row of parsedRows) {
      const driver = drivers.find((d) => d.name === row.driver);
      if (!driver || !row.payout_date || !row.amount) continue;
      await apiRequest("/api/advance", {
        method: "POST",
        body: JSON.stringify({
          driver_id: driver.id,
          payout_date: row.payout_date,
          amount: Number(row.amount) || 0,
          note: row.note || "",
        }),
      });
      count += 1;
    }
    await loadInitial();
    return count;
  }

  useCsvImportShortcut(() => setShowImportModal(true));

  return (
    <>
      <Head>
        <title>前払依頼書 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>前払依頼書 作成・一覧</h2>
            <p className="content__lead">
              控除予定額を差し引いた前払可能額をもとに、入金日ベースで前払依頼書を作成します。
            </p>
          </div>
          <div className="flex">
            <button type="button" className="btn btn--ghost" onClick={openCreateModal}>
              + 作成
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div className="panel">
          <div className="panel__head">
            <h3>前払依頼 一覧</h3>
            <button className="btn btn--ghost btn--sm" onClick={handleExport}>
              CSVエクスポート
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>依頼No</th>
                  <th>ドライバー</th>
                  <th>入金日</th>
                  <th className="num">前払金額</th>
                  <th className="num">前払可能額</th>
                  <th>ステータス</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && requests.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <p className="empty-note">前払依頼はまだありません。</p>
                    </td>
                  </tr>
                )}
                {requests.map((row) => (
                  <tr key={row.id}>
                    <td>{row.request_no}</td>
                    <td>{row.driverName}</td>
                    <td>{row.payout_date}</td>
                    <td className="num">{formatYen(row.amount)}</td>
                    <td className="num">{formatYen(row.available_amount_snapshot)}</td>
                    <td>
                      <span className={`pill pill--${STATUS_TONE[row.status]}`}>{row.status}</span>
                    </td>
                    <td>
                      {row.status !== "実行済" && (
                        <button className="btn btn--sm" onClick={() => handleExecute(row.id)} disabled={saving}>
                          実行済にする
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </OperationLayout>

      {showCreateModal && (
        <Modal title="前払依頼書 新規作成" onClose={() => setShowCreateModal(false)}>
          <div className="field">
            <label htmlFor="pay-driver">ドライバー</label>
            <select id="pay-driver" value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}>
              <option value="">{drivers.length === 0 ? "登録済みドライバーがいません" : "選択してください"}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="pay-date">入金日</label>
              <input type="date" id="pay-date" value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pay-amount">前払金額</label>
              <input type="number" id="pay-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pay-note">備考</label>
            <textarea
              id="pay-note"
              rows={3}
              placeholder="必要に応じて記入"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button className="btn btn--primary btn--block" onClick={handleCreate} disabled={saving}>
            {saving ? "作成中..." : "前払依頼書を作成"}
          </button>
        </Modal>
      )}

      {showImportModal && (
        <CsvImportModal
          title="前払依頼書 CSVインポート"
          description="列: ドライバー・入金日・前払金額・備考（依頼No・前払可能額・ステータスは自動算出されます）"
          onImport={handleImportFile}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </>
  );
}
