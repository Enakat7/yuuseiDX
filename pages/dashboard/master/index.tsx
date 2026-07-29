import Head from "next/head";
import { useEffect, useRef, useState, type FormEvent } from "react";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";
import Modal from "@/components/Modal";
import { apiRequest, fileToBase64 } from "@/lib/apiClient";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import type {
  Area,
  ContractType,
  District,
  DocumentType,
  DriverDocument,
  DriverWithRelations,
  PayType,
} from "@/types/domain/master";

const DOC_EXPIRY_ALERT_DAYS = 30;

type RawDriverRow = {
  id: string;
  name: string;
  contract_type: ContractType;
  area_id: string;
  contract_start_date: string;
  phone: string | null;
  email: string | null;
  pay_type: PayType;
  active: boolean;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
  area: { id: string; name: string } | null;
  driver_districts: { district: { id: string; name: string } | null }[];
  driver_documents: DriverDocument[];
};

function toDriverWithRelations(row: RawDriverRow): DriverWithRelations {
  return {
    id: row.id,
    name: row.name,
    contract_type: row.contract_type,
    area_id: row.area_id,
    contract_start_date: row.contract_start_date,
    phone: row.phone,
    email: row.email,
    pay_type: row.pay_type,
    active: row.active,
    profile_id: row.profile_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    area: row.area,
    districts: row.driver_districts.map((dd) => dd.district).filter((d): d is { id: string; name: string } => !!d),
    documents: row.driver_documents,
  };
}

function documentStatus(driver: DriverWithRelations, totalTypes: number) {
  if (driver.documents.length === 0) {
    return { tone: "pending", label: "未提出" };
  }
  const alertBy = Date.now() + DOC_EXPIRY_ALERT_DAYS * 24 * 60 * 60 * 1000;
  const hasExpiringSoon = driver.documents.some(
    (doc) => doc.expires_on && new Date(doc.expires_on).getTime() <= alertBy
  );
  if (hasExpiringSoon) return { tone: "alert", label: "期限間近" };
  if (driver.documents.length >= totalTypes) return { tone: "confirmed", label: "完備" };
  return { tone: "pending", label: "一部未提出" };
}

const EMPTY_FORM = {
  name: "",
  contractType: "個人事業主" as ContractType,
  areaId: "",
  contractStartDate: "",
  phone: "",
  email: "",
  payType: "週払い" as PayType,
};

export default function MasterDriverPage() {
  const importInputRef = useRef<HTMLInputElement>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [drivers, setDrivers] = useState<DriverWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([]);
  const [newDistrictName, setNewDistrictName] = useState("");

  const [detailDriverId, setDetailDriverId] = useState<string | null>(null);
  const detailDriver = drivers.find((d) => d.id === detailDriverId) ?? null;

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [areaRes, districtRes, docTypeRes, driverRes] = await Promise.all([
        apiRequest<{ data: Area[] }>("/api/master/areas"),
        apiRequest<{ data: District[] }>("/api/master/districts"),
        apiRequest<{ data: DocumentType[] }>("/api/master/document-types"),
        apiRequest<{ data: RawDriverRow[] }>("/api/master/drivers"),
      ]);
      setAreas(areaRes.data);
      setDistricts(districtRes.data);
      setDocumentTypes(docTypeRes.data);
      setDrivers(driverRes.data.map(toDriverWithRelations));
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

  const districtsForForm = districts.filter((d) => d.area_id === form.areaId);

  function resetForm() {
    setForm(EMPTY_FORM);
    setSelectedDistrictIds([]);
    setNewDistrictName("");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.name || !form.areaId || !form.contractStartDate) {
      setError("氏名・エリア・契約開始日は必須です。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/master/drivers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          contract_type: form.contractType,
          area_id: form.areaId,
          contract_start_date: form.contractStartDate,
          phone: form.phone || null,
          email: form.email || null,
          pay_type: form.payType,
          district_ids: selectedDistrictIds,
          new_district_name: newDistrictName,
        }),
      });

      setShowCreate(false);
      resetForm();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(
    driver: DriverWithRelations,
    docType: DocumentType,
    file: File,
    expiresOn: string
  ) {
    setSaving(true);
    setError(null);
    try {
      const contentBase64 = await fileToBase64(file);
      await apiRequest("/api/master/driver-documents", {
        method: "POST",
        body: JSON.stringify({
          driver_id: driver.id,
          document_type_id: docType.id,
          filename: file.name,
          content_base64: contentBase64,
          expires_on: expiresOn || null,
        }),
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleViewDocument(doc: DriverDocument) {
    try {
      const { url } = await apiRequest<{ url: string }>(`/api/master/driver-documents/${doc.id}/signed-url`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "表示用URLの発行に失敗しました。");
    }
  }

  function handleExport() {
    const rows = drivers.map((d) => ({
      name: d.name,
      contract_type: d.contract_type,
      area: d.area?.name ?? "",
      districts: d.districts.map((dist) => dist.name).join("/"),
      contract_start_date: d.contract_start_date,
      phone: d.phone ?? "",
      email: d.email ?? "",
      pay_type: d.pay_type,
    }));
    const csv = toCsv(rows, [
      { key: "name", header: "氏名" },
      { key: "contract_type", header: "契約形態" },
      { key: "area", header: "エリア" },
      { key: "districts", header: "地区" },
      { key: "contract_start_date", header: "契約開始日" },
      { key: "phone", header: "電話番号" },
      { key: "email", header: "メールアドレス" },
      { key: "pay_type", header: "支払種別" },
    ]);
    downloadCsv("ドライバーマスタ.csv", csv);
  }

  async function handleImportFile(file: File) {
    setSaving(true);
    setError(null);
    try {
      const rows = await parseCsv<{
        name: string;
        contract_type: string;
        area: string;
        districts: string;
        contract_start_date: string;
        phone: string;
        email: string;
        pay_type: string;
      }>(file, [
        { key: "name", header: "氏名" },
        { key: "contract_type", header: "契約形態" },
        { key: "area", header: "エリア" },
        { key: "districts", header: "地区" },
        { key: "contract_start_date", header: "契約開始日" },
        { key: "phone", header: "電話番号" },
        { key: "email", header: "メールアドレス" },
        { key: "pay_type", header: "支払種別" },
      ]);

      await apiRequest("/api/master/drivers/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });

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
        <title>マスタ管理 | YOU SAY!!</title>
      </Head>
      <OperationLayout>
        <div className="content__header">
          <div>
            <h2>マスタ管理</h2>
            <p className="content__lead">ドライバー・単価・配送種別の各種マスタデータを管理します。</p>
          </div>
          <div className="flex">
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
            <button className="btn btn--ghost" onClick={() => setShowCreate(true)}>
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

        <div className="panel">
          <div className="panel__head">
            <h3>ドライバーマスタ</h3>
            <span className="text-sm text-muted">{loading ? "読み込み中..." : `${drivers.length}件`}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>契約形態</th>
                  <th>エリア / 地区</th>
                  <th>契約開始日</th>
                  <th>連絡先</th>
                  <th>書類</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && drivers.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <p className="empty-note">登録済みのドライバーはいません。</p>
                    </td>
                  </tr>
                )}
                {drivers.map((driver) => {
                  const status = documentStatus(driver, documentTypes.length);
                  return (
                    <tr key={driver.id}>
                      <td>{driver.name}</td>
                      <td>{driver.contract_type}</td>
                      <td>
                        {driver.area?.name ?? "-"}
                        {driver.districts.length > 0 && ` / ${driver.districts.map((d) => d.name).join("・")}`}
                      </td>
                      <td>{driver.contract_start_date}</td>
                      <td>{driver.phone || driver.email || "-"}</td>
                      <td>
                        <span className={`pill pill--${status.tone}`}>{status.label}</span>
                      </td>
                      <td>
                        <button className="btn btn--sm" onClick={() => setDetailDriverId(driver.id)}>
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

      {showCreate && (
        <Modal title="ドライバー新規登録" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="driver-name">氏名</label>
              <input
                id="driver-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="field">
              <label>契約形態</label>
              <div className="flex" style={{ gap: 16 }}>
                {(["個人事業主", "法人"] as ContractType[]).map((type) => (
                  <label key={type} className="text-sm flex" style={{ gap: 6, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="contract_type"
                      checked={form.contractType === type}
                      onChange={() => setForm((f) => ({ ...f, contractType: type }))}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="driver-area">エリア</label>
                <select
                  id="driver-area"
                  value={form.areaId}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, areaId: e.target.value }));
                    setSelectedDistrictIds([]);
                  }}
                  required
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="driver-start">契約開始日</label>
                <input
                  id="driver-start"
                  type="date"
                  value={form.contractStartDate}
                  onChange={(e) => setForm((f) => ({ ...f, contractStartDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            {form.areaId && (
              <div className="field">
                <label>地区（複数選択可。1エリア内での掛け持ち可）</label>
                <div className="flex" style={{ flexWrap: "wrap", gap: 10 }}>
                  {districtsForForm.map((district) => (
                    <label key={district.id} className="text-sm flex" style={{ gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedDistrictIds.includes(district.id)}
                        onChange={(e) =>
                          setSelectedDistrictIds((prev) =>
                            e.target.checked ? [...prev, district.id] : prev.filter((id) => id !== district.id)
                          )
                        }
                      />
                      {district.name}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="新しい地区名を追加（任意）"
                  value={newDistrictName}
                  onChange={(e) => setNewDistrictName(e.target.value)}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}

            <div className="field-row">
              <div className="field">
                <label htmlFor="driver-phone">電話番号</label>
                <input
                  id="driver-phone"
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="driver-email">メールアドレス</label>
                <input
                  id="driver-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="field">
              <label>支払種別</label>
              <div className="flex" style={{ gap: 16 }}>
                {(["週払い", "月払い"] as PayType[]).map((type) => (
                  <label key={type} className="text-sm flex" style={{ gap: 6, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="pay_type"
                      checked={form.payType === type}
                      onChange={() => setForm((f) => ({ ...f, payType: type }))}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--block" disabled={saving}>
              {saving ? "登録中..." : "登録する"}
            </button>
          </form>
        </Modal>
      )}

      {detailDriver && (
        <Modal
          title={`ドライバー詳細 — ${detailDriver.name}`}
          subtitle={`${detailDriver.area?.name ?? "-"} ${
            detailDriver.districts.length > 0 ? `/ ${detailDriver.districts.map((d) => d.name).join("・")}` : ""
          }`}
          onClose={() => setDetailDriverId(null)}
        >
          <div className="grid grid--2">
            <div>
              <p className="section-title">基本情報</p>
              <p className="text-sm">
                <strong>契約形態：</strong>
                {detailDriver.contract_type}
              </p>
              <p className="text-sm">
                <strong>契約開始日：</strong>
                {detailDriver.contract_start_date}
              </p>
              <p className="text-sm">
                <strong>電話番号：</strong>
                {detailDriver.phone || "-"}
              </p>
              <p className="text-sm">
                <strong>メールアドレス：</strong>
                {detailDriver.email || "-"}
              </p>
              <p className="text-sm">
                <strong>支払種別：</strong>
                {detailDriver.pay_type}
              </p>
            </div>
            <div>
              <p className="section-title">保管書類</p>
              {documentTypes.map((docType) => {
                const doc = detailDriver.documents.find((d) => d.document_type_id === docType.id);
                if (doc) {
                  return (
                    <div key={docType.id} style={{ marginBottom: 6 }}>
                      <button
                        type="button"
                        className="tag"
                        style={{ cursor: "pointer" }}
                        onClick={() => handleViewDocument(doc)}
                      >
                        {docType.label}
                        {doc.expires_on && `（期限：${doc.expires_on}）`}
                      </button>
                    </div>
                  );
                }
                return (
                  <DocumentUploadRow
                    key={docType.id}
                    docType={docType}
                    disabled={saving}
                    onUpload={(file, expiresOn) => handleUpload(detailDriver, docType, file, expiresOn)}
                  />
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function DocumentUploadRow({
  docType,
  disabled,
  onUpload,
}: {
  docType: DocumentType;
  disabled: boolean;
  onUpload: (file: File, expiresOn: string) => void;
}) {
  const [expiresOn, setExpiresOn] = useState("");

  return (
    <div className="flex" style={{ gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
      <span className="tag" style={{ borderStyle: "dashed", color: "var(--gray-400)" }}>
        {docType.label}
      </span>
      {docType.is_expiring && (
        <input
          type="date"
          style={{ width: 150 }}
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
          disabled={disabled}
        />
      )}
      <input
        type="file"
        disabled={disabled}
        style={{ width: 200 }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file, expiresOn);
          e.target.value = "";
        }}
      />
    </div>
  );
}
