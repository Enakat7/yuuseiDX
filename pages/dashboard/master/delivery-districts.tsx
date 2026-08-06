import Head from "next/head";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";
import ImportModeToggle, { type ImportMode } from "@/components/ImportModeToggle";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import type { Area, DeliveryDistrictWithArea } from "@/types/domain/master";

const COMMON_LABEL = "共通";

// 稼働カレンダー等で日別の担当地区を識別しやすい色を優先しつつ、自由選択できる余地も残す。
const COLOR_PALETTE = [
  "#ffffff",
  "#d1d5db",
  "#808080",
  "#fca5a5",
  "#f5aa5f",
  "#fcd34d",
  "#86efac",
  "#67e8f9",
  "#93c5fd",
  "#c4b5fd",
  "#e493f5",
  "#f9a8d4",
];

type DraftForm = { areaId: string; code: string; name: string; backgroundColor: string };

const EMPTY_FORM: DraftForm = { areaId: COMMON_LABEL, code: "", name: "", backgroundColor: "#ffffff" };

function ColorPaletteInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="color-palette">
      {COLOR_PALETTE.map((hex) => (
        <button
          type="button"
          key={hex}
          className={`color-palette__swatch${value.toLowerCase() === hex ? " is-selected" : ""}`}
          style={{ background: hex }}
          aria-label={hex}
          onClick={() => onChange(hex)}
        />
      ))}
      <input
        type="color"
        className="color-palette__custom"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="その他の色を選択"
      />
    </div>
  );
}

export default function MasterDeliveryDistrictPage() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>("append");

  const [areas, setAreas] = useState<Area[]>([]);
  const [districts, setDistricts] = useState<DeliveryDistrictWithArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [areaFilter, setAreaFilter] = useState<string>("すべて");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftForm>(EMPTY_FORM);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: areaData }, { data: districtData }] = await Promise.all([
        apiRequest<{ data: Area[] }>("/api/master/areas"),
        apiRequest<{ data: DeliveryDistrictWithArea[] }>("/api/master/delivery-districts"),
      ]);
      setAreas(areaData);
      setDistricts(districtData);
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

  const filterTabs = useMemo(() => ["すべて", ...areas.map((a) => a.name), COMMON_LABEL], [areas]);
  const visibleDistricts = useMemo(() => {
    if (areaFilter === "すべて") return districts;
    return districts.filter((d) => (d.area?.name ?? COMMON_LABEL) === areaFilter);
  }, [districts, areaFilter]);

  function startEdit(district: DeliveryDistrictWithArea) {
    setEditingId(district.id);
    setEditDraft({
      areaId: district.area?.id ?? COMMON_LABEL,
      code: district.code,
      name: district.name,
      backgroundColor: district.background_color,
    });
  }

  async function handleSaveEdit(district: DeliveryDistrictWithArea) {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/master/delivery-districts/${district.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          area_id: editDraft.areaId === COMMON_LABEL ? null : editDraft.areaId,
          code: editDraft.code,
          name: editDraft.name,
          background_color: editDraft.backgroundColor,
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

  async function handleDelete(district: DeliveryDistrictWithArea) {
    if (!window.confirm(`${district.code}（${district.name}）を削除します。よろしいですか？`)) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/master/delivery-districts/${district.id}`, { method: "DELETE" });
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
      setError("コード・配達地区名は必須です。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/master/delivery-districts", {
        method: "POST",
        body: JSON.stringify({
          area_id: form.areaId === COMMON_LABEL ? null : form.areaId,
          code: form.code,
          name: form.name,
          background_color: form.backgroundColor,
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
      visibleDistricts.map((d) => ({
        area: d.area?.name ?? COMMON_LABEL,
        code: d.code,
        color: d.background_color,
        name: d.name,
      })),
      [
        { key: "area", header: "エリア" },
        { key: "code", header: "コード" },
        { key: "color", header: "背景色" },
        { key: "name", header: "配達地区" },
      ]
    );
    downloadCsv("配達地区マスタ.csv", csv);
  }

  async function handleImportFile(file: File) {
    setSaving(true);
    setError(null);
    try {
      const rows = await parseCsv<{ area: string; code: string; color: string; name: string }>(file, [
        { key: "area", header: "エリア" },
        { key: "code", header: "コード" },
        { key: "color", header: "背景色" },
        { key: "name", header: "配達地区" },
      ]);

      const res = await apiRequest<{ imported: number; updated: number; skipped: number }>(
        "/api/master/delivery-districts/import",
        {
          method: "POST",
          body: JSON.stringify({ rows, mode: importMode }),
        }
      );

      if (res.skipped > 0) {
        setError(
          `${res.imported}件を新規登録、${res.updated}件を更新しました（${res.skipped}件はコード重複またはエリア不正のためスキップ）。`
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
        <title>配達地区マスタ | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>マスタ管理</h2>
            <p className="content__lead">
              配達地区マスタを管理します。背景色は稼働カレンダー等で日別の担当地区を色分け表示する際に使用します。
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
              <h3>配達地区 新規登録</h3>
            </div>
            <div className="panel__body">
              <form onSubmit={handleCreate}>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="district-area">エリア</label>
                    <select
                      id="district-area"
                      value={form.areaId}
                      onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value }))}
                    >
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                      <option value={COMMON_LABEL}>{COMMON_LABEL}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="district-code">コード</label>
                    <input
                      id="district-code"
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="district-name">配達地区</label>
                    <input
                      id="district-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <label>背景色</label>
                  <ColorPaletteInput
                    value={form.backgroundColor}
                    onChange={(hex) => setForm((f) => ({ ...f, backgroundColor: hex }))}
                  />
                </div>
                <button type="submit" className="btn btn--ghost" disabled={saving}>
                  {saving ? "登録中..." : "登録する"}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="tabbar" style={{ marginBottom: 22 }}>
          {filterTabs.map((tab) => (
            <a
              key={tab}
              href="#"
              className={tab === areaFilter ? "is-active" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setAreaFilter(tab);
              }}
            >
              {tab}
            </a>
          ))}
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>配達地区マスタ</h3>
            <span className="text-sm text-muted">{loading ? "読み込み中..." : `${visibleDistricts.length}件`}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>エリア</th>
                  <th>コード</th>
                  <th>背景色</th>
                  <th>配達地区</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && visibleDistricts.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <p className="empty-note">配達地区が登録されていません。</p>
                    </td>
                  </tr>
                )}
                {visibleDistricts.map((district) => {
                  const isEditing = editingId === district.id;
                  return (
                    <tr key={district.id}>
                      {isEditing ? (
                        <>
                          <td style={{ padding: "6px 8px" }}>
                            <select
                              value={editDraft.areaId}
                              onChange={(e) => setEditDraft((d) => ({ ...d, areaId: e.target.value }))}
                            >
                              {areas.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                              <option value={COMMON_LABEL}>{COMMON_LABEL}</option>
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={editDraft.code}
                              onChange={(e) => setEditDraft((d) => ({ ...d, code: e.target.value }))}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <ColorPaletteInput
                              value={editDraft.backgroundColor}
                              onChange={(hex) => setEditDraft((d) => ({ ...d, backgroundColor: hex }))}
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
                            <div className="flex" style={{ gap: 8 }}>
                              <button
                                className="btn btn--sm"
                                onClick={() => handleSaveEdit(district)}
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
                          <td>{district.area?.name ?? COMMON_LABEL}</td>
                          <td>{district.code}</td>
                          <td>
                            <span className="color-swatch" style={{ background: district.background_color }} />
                            <span className="text-sm text-muted" style={{ marginLeft: 8 }}>
                              {district.background_color}
                            </span>
                          </td>
                          <td>{district.name}</td>
                          <td>
                            <div className="flex" style={{ gap: 8 }}>
                              <button className="btn btn--sm" onClick={() => startEdit(district)}>
                                編集
                              </button>
                              <button
                                type="button"
                                className="btn btn--sm btn--ghost"
                                onClick={() => handleDelete(district)}
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
