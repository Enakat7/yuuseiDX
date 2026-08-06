import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";
import ImportModeToggle, { type ImportMode } from "@/components/ImportModeToggle";
import { apiRequest } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import type { Area, DeliveryType, PriceKind, UnitPrice } from "@/types/domain/master";

const PRICE_KINDS: { kind: PriceKind; title: string; note: string }[] = [
  { kind: "受注単価", title: "受単価マスタ", note: "局・NCからの受注単価（円 / 件）" },
  { kind: "卸単価", title: "卸単価マスタ", note: "ドライバーへの支払単価（円 / 件）" },
];

function cellKey(kind: PriceKind, areaId: string, deliveryTypeId: string) {
  return `${kind}:${areaId}:${deliveryTypeId}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MasterPricePage() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>("append");

  const [areas, setAreas] = useState<Area[]>([]);
  const [deliveryTypes, setDeliveryTypes] = useState<DeliveryType[]>([]);
  const [allPrices, setAllPrices] = useState<UnitPrice[]>([]);
  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Record<string, string>>({});

  const priceTargetTypes = deliveryTypes.filter((dt) => dt.price_master_target);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [areaRes, typeRes, priceRes] = await Promise.all([
        apiRequest<{ data: Area[] }>("/api/master/areas"),
        apiRequest<{ data: DeliveryType[] }>("/api/master/delivery-types"),
        apiRequest<{ data: UnitPrice[] }>("/api/master/unit-prices"),
      ]);
      setAreas(areaRes.data);
      setDeliveryTypes(typeRes.data);
      setAllPrices(priceRes.data);
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

  useEffect(() => {
    // 現在有効な単価（本日以前で最新のeffective_from）を編集用ドラフトの初期値にする
    // 導出状態のため無効化する
    const today = todayIso();
    const latestByCell = new Map<string, UnitPrice>();
    for (const p of allPrices) {
      if (p.effective_from > today) continue;
      const key = cellKey(p.price_kind, p.area_id, p.delivery_type_id);
      const current = latestByCell.get(key);
      if (!current || p.effective_from > current.effective_from) {
        latestByCell.set(key, p);
      }
    }
    const next: Record<string, string> = {};
    for (const [key, p] of latestByCell) {
      next[key] = String(p.price_yen);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(next);
  }, [allPrices]);

  function updateCell(kind: PriceKind, areaId: string, deliveryTypeId: string, value: string) {
    setDraft((prev) => ({ ...prev, [cellKey(kind, areaId, deliveryTypeId)]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const effectiveFrom = todayIso();
      const rows: {
        price_kind: PriceKind;
        area_id: string;
        delivery_type_id: string;
        effective_from: string;
        price_yen: number;
      }[] = [];
      for (const { kind } of PRICE_KINDS) {
        for (const area of areas) {
          for (const dt of priceTargetTypes) {
            const raw = draft[cellKey(kind, area.id, dt.id)];
            if (raw === undefined || raw === "") continue;
            const value = Number(raw);
            if (Number.isNaN(value)) continue;
            rows.push({
              price_kind: kind,
              area_id: area.id,
              delivery_type_id: dt.id,
              effective_from: effectiveFrom,
              price_yen: value,
            });
          }
        }
      }
      if (rows.length === 0) {
        setSaving(false);
        return;
      }
      await apiRequest("/api/master/unit-prices", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const rows: { delivery_type: string; area: string; 受注単価: string; 卸単価: string }[] = [];
    for (const dt of priceTargetTypes) {
      for (const area of areas) {
        rows.push({
          delivery_type: dt.name,
          area: area.name,
          受注単価: draft[cellKey("受注単価", area.id, dt.id)] ?? "",
          卸単価: draft[cellKey("卸単価", area.id, dt.id)] ?? "",
        });
      }
    }
    const csv = toCsv(rows, [
      { key: "delivery_type", header: "配送種別" },
      { key: "area", header: "エリア" },
      { key: "受注単価", header: "受注単価" },
      { key: "卸単価", header: "卸単価" },
    ]);
    downloadCsv(`単価マスタ_${todayIso()}.csv`, csv);
  }

  async function handleImportFile(file: File) {
    setError(null);
    try {
      const rows = await parseCsv<{
        delivery_type: string;
        area: string;
        受注単価: string;
        卸単価: string;
      }>(file, [
        { key: "delivery_type", header: "配送種別" },
        { key: "area", header: "エリア" },
        { key: "受注単価", header: "受注単価" },
        { key: "卸単価", header: "卸単価" },
      ]);

      setDraft((prev) => {
        const next = { ...prev };
        const setCell = (key: string, value: string) => {
          // 追加モードでは既に値が入っているセルを上書きせず、空欄のみ埋める
          if (importMode === "append" && next[key]) return;
          next[key] = value;
        };
        for (const row of rows) {
          const dt = priceTargetTypes.find((d) => d.name === row.delivery_type);
          const area = areas.find((a) => a.name === row.area);
          if (!dt || !area) continue;
          if (row.受注単価) setCell(cellKey("受注単価", area.id, dt.id), row.受注単価);
          if (row.卸単価) setCell(cellKey("卸単価", area.id, dt.id), row.卸単価);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました。");
    }
  }

  return (
    <>
      <Head>
        <title>単価マスタ | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>マスタ管理</h2>
            <p className="content__lead">エリア × 配送種別ごとの受単価・卸単価を管理します。</p>
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
            <button className="btn btn--ghost" onClick={() => importInputRef.current?.click()}>
              CSVインポート
            </button>
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

        <MasterTabs />

        {PRICE_KINDS.map(({ kind, title, note }) => (
          <div className="panel" key={kind}>
            <div className="panel__head">
              <h3>{title}</h3>
              <span className="text-sm text-muted">{note}</span>
            </div>
            <div className="table-wrap">
              <table className="price-table">
                <thead>
                  <tr>
                    <th>配送種別</th>
                    {areas.map((area) => (
                      <th className="area" key={area.id}>
                        {area.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {priceTargetTypes.map((dt) => (
                    <tr key={dt.id}>
                      <td className="item">{dt.name}</td>
                      {areas.map((area) => (
                        <td className="cell" key={area.id}>
                          <input
                            className="price-input"
                            type="number"
                            step="0.01"
                            value={draft[cellKey(kind, area.id, dt.id)] ?? ""}
                            placeholder="未設定"
                            onChange={(e) => updateCell(kind, area.id, dt.id, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="flex" style={{ justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn--ghost" onClick={loadAll}>
            変更を破棄
          </button>
          <button className="btn btn--ghost" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "単価マスタを保存"}
          </button>
        </div>
      </OperationLayout>
    </>
  );
}
