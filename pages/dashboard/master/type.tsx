import Head from "next/head";
import { useEffect, useRef, useState, type FormEvent } from "react";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";
import ImportModeToggle, { type ImportMode } from "@/components/ImportModeToggle";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import type { DeliveryType } from "@/types/domain/master";

const EMPTY_FORM = { code: "", name: "", priceMasterTarget: false };

export default function MasterDeliveryTypePage() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>("append");

  const [types, setTypes] = useState<DeliveryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ code: "", name: "", priceMasterTarget: false });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiRequest<{ data: DeliveryType[] }>("/api/master/delivery-types");
      setTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 初回マウント時にAPI経由で一覧取得する意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  function startEdit(type: DeliveryType) {
    setEditingId(type.id);
    setEditDraft({ code: type.code, name: type.name, priceMasterTarget: type.price_master_target });
  }

  async function handleSaveEdit(type: DeliveryType) {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/master/delivery-types/${type.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: editDraft.code,
          name: editDraft.name,
          price_master_target: editDraft.priceMasterTarget,
        }),
      });

      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type: DeliveryType) {
    if (!window.confirm(`${type.code}（${type.name}）を削除します。よろしいですか？`)) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/master/delivery-types/${type.id}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.code || !form.name) {
      setError("コード・種別名は必須です。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/master/delivery-types", {
        method: "POST",
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          price_master_target: form.priceMasterTarget,
        }),
      });

      setShowCreate(false);
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const csv = toCsv(
      types.map((t) => ({
        code: t.code,
        name: t.name,
        target: t.price_master_target ? "対象" : "対象外",
      })),
      [
        { key: "code", header: "コード" },
        { key: "name", header: "種別名" },
        { key: "target", header: "単価マスタ対象" },
      ]
    );
    downloadCsv("配送種別マスタ.csv", csv);
  }

  async function handleImportFile(file: File) {
    setSaving(true);
    setError(null);
    try {
      const rows = await parseCsv<{ code: string; name: string; target: string }>(file, [
        { key: "code", header: "コード" },
        { key: "name", header: "種別名" },
        { key: "target", header: "単価マスタ対象" },
      ]);

      const res = await apiRequest<{ imported: number; updated: number; skipped: number }>(
        "/api/master/delivery-types/import",
        {
          method: "POST",
          body: JSON.stringify({ rows, mode: importMode }),
        }
      );

      if (res.skipped > 0) {
        setError(
          `${res.imported}件を新規登録、${res.updated}件を更新しました（${res.skipped}件はコード重複または不正値のためスキップ）。`
        );
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
        <title>配送種別マスタ | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>マスタ管理</h2>
            <p className="content__lead">
              配送種別マスタを管理します。単価マスタ対象フラグにより、単価マスタで単価設定が必要な種別かを識別します。
            </p>
          </div>
          <div className="flex" style={{ gap: 12, alignItems: "center" }}>
            <ImportModeToggle mode={importMode} onChange={setImportMode} />
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
            <button className="btn btn--ghost" onClick={() => setShowCreate((v) => !v)}>
              + 新規登録
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--black)", marginBottom: 12 }}>
            {error}
          </p>
        )}

        <MasterTabs />

        {showCreate && (
          <div className="panel" style={{ marginBottom: 22 }}>
            <div className="panel__head">
              <h3>配送種別 新規登録</h3>
            </div>
            <div className="panel__body">
              <form onSubmit={handleCreate}>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="type-code">コード</label>
                    <input
                      id="type-code"
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="type-name">種別名</label>
                    <input
                      id="type-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="text-sm flex" style={{ gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={form.priceMasterTarget}
                      onChange={(e) => setForm((f) => ({ ...f, priceMasterTarget: e.target.checked }))}
                    />
                    単価マスタ対象にする
                  </label>
                </div>
                <button type="submit" className="btn btn--ghost" disabled={saving}>
                  {saving ? "登録中..." : "登録する"}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel__head">
            <h3>配送種別マスタ</h3>
            <span className="text-sm text-muted">{loading ? "読み込み中..." : `${types.length}件`}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>コード</th>
                  <th>種別名</th>
                  <th>単価マスタ対象</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && types.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <p className="empty-note">配送種別が登録されていません。</p>
                    </td>
                  </tr>
                )}
                {types.map((type) => {
                  const isEditing = editingId === type.id;
                  return (
                    <tr key={type.id}>
                      {isEditing ? (
                        <>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={editDraft.code}
                              onChange={(e) => setEditDraft((d) => ({ ...d, code: e.target.value }))}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={editDraft.name}
                              onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                            />
                          </td>
                          <td>
                            <label className="text-sm flex" style={{ gap: 6, alignItems: "center" }}>
                              <input
                                type="checkbox"
                                checked={editDraft.priceMasterTarget}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, priceMasterTarget: e.target.checked }))
                                }
                              />
                              対象
                            </label>
                          </td>
                          <td>
                            <div className="flex" style={{ gap: 8 }}>
                              <button
                                className="btn btn--sm"
                                onClick={() => handleSaveEdit(type)}
                                disabled={saving}
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                className="btn btn--sm btn--ghost"
                                onClick={() => setEditingId(null)}
                              >
                                取消
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{type.code}</td>
                          <td>{type.name}</td>
                          <td>
                            <span className={`pill pill--${type.price_master_target ? "confirmed" : "pending"}`}>
                              {type.price_master_target ? "対象" : "対象外"}
                            </span>
                          </td>
                          <td>
                            <div className="flex" style={{ gap: 8 }}>
                              <button className="btn btn--sm" onClick={() => startEdit(type)}>
                                編集
                              </button>
                              <button
                                type="button"
                                className="btn btn--sm btn--ghost"
                                onClick={() => handleDelete(type)}
                                disabled={saving}
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </OperationLayout>
    </>
  );
}
