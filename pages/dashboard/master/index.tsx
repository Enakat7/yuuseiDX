import Head from "next/head";
import { useEffect, useRef, useState, type FormEvent } from "react";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";
import Modal from "@/components/Modal";
import { apiRequest, fileToBase64 } from "@/lib/apiClient";
import { useCurrentUser } from "@/lib/currentUser";
import { toCsv, downloadCsv, parseCsv } from "@/lib/csv";
import {
  BANK_ACCOUNT_TYPES,
  CONTRACT_TYPES,
  DRIVER_ROLES,
  GAS_CARD_TYPES,
  PAY_TYPES,
  VEHICLE_OWNERSHIPS,
  type BankAccountType,
  type ContractType,
  type DriverRole,
  type GasCardType,
  type PayType,
  type VehicleOwnership,
} from "@/lib/constants";
import type {
  Area,
  DeliveryType,
  District,
  DocumentType,
  Driver,
  DriverDocument,
  DriverWithRelations,
  UnitPrice,
} from "@/types/domain/master";

const DOC_EXPIRY_ALERT_DAYS = 30;

const DETAIL_TABS = [
  { key: "basic", label: "基本情報" },
  { key: "vehicle", label: "車両情報" },
  { key: "gascard", label: "ガソリンカード" },
  { key: "documents", label: "保管書類" },
] as const;
type DetailTabKey = (typeof DETAIL_TABS)[number]["key"];

function formatYen(value: number) {
  return value.toLocaleString("ja-JP");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function cellKey(kind: string, areaId: string, deliveryTypeId: string) {
  return `${kind}:${areaId}:${deliveryTypeId}`;
}

type RawDriverRow = Driver & {
  area: { id: string; name: string } | null;
  driver_districts: { district: { id: string; name: string } | null }[];
  driver_documents: DriverDocument[];
};

function toDriverWithRelations(row: RawDriverRow): DriverWithRelations {
  const { driver_districts, driver_documents, area, ...driver } = row;
  return {
    ...driver,
    area,
    districts: driver_districts.map((dd) => dd.district).filter((d): d is { id: string; name: string } => !!d),
    documents: driver_documents,
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

// 新規登録フォーム・詳細モーダルの編集モードで共通して扱うドライバー項目一式。
// 地区（districts）とUID・単価（都度計算）・パスワードは対象外（別枠で扱う）。
type DriverFieldsDraft = {
  name: string;
  contractType: ContractType;
  areaId: string;
  contractStartDate: string;
  phone: string;
  email: string;
  payType: PayType;
  companyName: string;
  driverRole: DriverRole | "";
  contractEndDate: string;
  contractIndefinite: boolean;
  contractDeadlineDate: string;
  fixedCost: string;
  otherConditions: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  address: string;
  bankName: string;
  bankBranch: string;
  bankAccountType: BankAccountType | "";
  bankAccountNumber: string;
  bankAccountHolder: string;
  advanceEligible: boolean;
  vehicleNumber: string;
  vehicleOwnership: VehicleOwnership | "";
  vehicleLeaseCost: string;
  vehicleLeaseStartDate: string;
  vehicleInspectionDeadline: string;
  vehicleInsuranceDeadline: string;
  gasCardProvided: boolean;
  gasCardIssuedDate: string;
  gasCardType: GasCardType | "";
};

const EMPTY_DRIVER_FIELDS: DriverFieldsDraft = {
  name: "",
  contractType: "個人委託",
  areaId: "",
  contractStartDate: "",
  phone: "",
  email: "",
  payType: "週払い",
  companyName: "",
  driverRole: "",
  contractEndDate: "",
  contractIndefinite: false,
  contractDeadlineDate: "",
  fixedCost: "",
  otherConditions: "",
  emergencyContactName: "",
  emergencyContactRelation: "",
  emergencyContactPhone: "",
  address: "",
  bankName: "",
  bankBranch: "",
  bankAccountType: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  advanceEligible: false,
  vehicleNumber: "",
  vehicleOwnership: "",
  vehicleLeaseCost: "",
  vehicleLeaseStartDate: "",
  vehicleInspectionDeadline: "",
  vehicleInsuranceDeadline: "",
  gasCardProvided: false,
  gasCardIssuedDate: "",
  gasCardType: "",
};

function driverToFields(driver: Driver): DriverFieldsDraft {
  return {
    name: driver.name,
    contractType: driver.contract_type as ContractType,
    areaId: driver.area_id,
    contractStartDate: driver.contract_start_date,
    phone: driver.phone ?? "",
    email: driver.email ?? "",
    payType: driver.pay_type as PayType,
    companyName: driver.company_name ?? "",
    driverRole: (driver.driver_role as DriverRole | null) ?? "",
    contractEndDate: driver.contract_end_date ?? "",
    contractIndefinite: driver.contract_indefinite,
    contractDeadlineDate: driver.contract_deadline_date ?? "",
    fixedCost: driver.fixed_cost != null ? String(driver.fixed_cost) : "",
    otherConditions: driver.other_conditions ?? "",
    emergencyContactName: driver.emergency_contact_name ?? "",
    emergencyContactRelation: driver.emergency_contact_relation ?? "",
    emergencyContactPhone: driver.emergency_contact_phone ?? "",
    address: driver.address ?? "",
    bankName: driver.bank_name ?? "",
    bankBranch: driver.bank_branch ?? "",
    bankAccountType: (driver.bank_account_type as BankAccountType | null) ?? "",
    bankAccountNumber: driver.bank_account_number ?? "",
    bankAccountHolder: driver.bank_account_holder ?? "",
    advanceEligible: driver.advance_eligible,
    vehicleNumber: driver.vehicle_number ?? "",
    vehicleOwnership: (driver.vehicle_ownership as VehicleOwnership | null) ?? "",
    vehicleLeaseCost: driver.vehicle_lease_cost != null ? String(driver.vehicle_lease_cost) : "",
    vehicleLeaseStartDate: driver.vehicle_lease_start_date ?? "",
    vehicleInspectionDeadline: driver.vehicle_inspection_deadline ?? "",
    vehicleInsuranceDeadline: driver.vehicle_insurance_deadline ?? "",
    gasCardProvided: driver.gas_card_provided,
    gasCardIssuedDate: driver.gas_card_issued_date ?? "",
    gasCardType: (driver.gas_card_type as GasCardType | null) ?? "",
  };
}

function fieldsToApiBody(fields: DriverFieldsDraft) {
  return {
    name: fields.name,
    contract_type: fields.contractType,
    area_id: fields.areaId,
    contract_start_date: fields.contractStartDate,
    phone: fields.phone || null,
    email: fields.email || null,
    pay_type: fields.payType,
    company_name: fields.companyName || null,
    driver_role: fields.driverRole || null,
    contract_end_date: fields.contractEndDate || null,
    contract_indefinite: fields.contractIndefinite,
    contract_deadline_date: fields.contractIndefinite ? null : fields.contractDeadlineDate || null,
    fixed_cost: fields.fixedCost === "" ? null : Number(fields.fixedCost),
    other_conditions: fields.otherConditions || null,
    emergency_contact_name: fields.emergencyContactName || null,
    emergency_contact_relation: fields.emergencyContactRelation || null,
    emergency_contact_phone: fields.emergencyContactPhone || null,
    address: fields.address || null,
    bank_name: fields.bankName || null,
    bank_branch: fields.bankBranch || null,
    bank_account_type: fields.bankAccountType || null,
    bank_account_number: fields.bankAccountNumber || null,
    bank_account_holder: fields.bankAccountHolder || null,
    advance_eligible: fields.advanceEligible,
    vehicle_number: fields.vehicleNumber || null,
    vehicle_ownership: fields.vehicleOwnership || null,
    vehicle_lease_cost: fields.vehicleLeaseCost === "" ? null : Number(fields.vehicleLeaseCost),
    vehicle_lease_start_date: fields.vehicleLeaseStartDate || null,
    vehicle_inspection_deadline: fields.vehicleInspectionDeadline || null,
    vehicle_insurance_deadline: fields.vehicleInsuranceDeadline || null,
    gas_card_provided: fields.gasCardProvided,
    gas_card_issued_date: fields.gasCardIssuedDate || null,
    gas_card_type: fields.gasCardType || null,
  };
}

// フィールド単位の「表示 / 編集」切り替え。新規登録フォームでは常にediting=trueで使う。
function ViewOrInput({
  id,
  label,
  value,
  editing,
  onChange,
  type = "text",
  displayValue,
}: {
  id: string;
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  type?: string;
  displayValue?: string;
}) {
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      <label htmlFor={id}>{label}</label>
      {editing ? (
        type === "textarea" ? (
          <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
        ) : (
          <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
        )
      ) : (
        <p className="text-sm">{displayValue ?? (value || "-")}</p>
      )}
    </div>
  );
}

function ViewOrSelect({
  id,
  label,
  value,
  editing,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      <label htmlFor={id}>{label}</label>
      {editing ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">未設定</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm">{value || "-"}</p>
      )}
    </div>
  );
}

function ViewOrRadio({
  id,
  label,
  value,
  editing,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      <label id={`${id}-label`}>{label}</label>
      {editing ? (
        <div className="flex" style={{ gap: 16, flexWrap: "wrap" }} role="radiogroup" aria-labelledby={`${id}-label`}>
          {options.map((o) => (
            <label key={o} className="text-sm flex" style={{ gap: 6, alignItems: "center" }}>
              <input type="radio" name={id} checked={value === o} onChange={() => onChange(o)} />
              {o}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm">{value || "-"}</p>
      )}
    </div>
  );
}

function ViewOrCheckbox({
  id,
  label,
  checked,
  editing,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  editing: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      {editing ? (
        <label className="text-sm flex" style={{ gap: 6, alignItems: "center" }} htmlFor={id}>
          <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </label>
      ) : (
        <>
          <label>{label}</label>
          <p className="text-sm">{checked ? "有" : "無"}</p>
        </>
      )}
    </div>
  );
}

function DriverBasicFields({
  fields,
  editing,
  onChange,
  areas,
}: {
  fields: DriverFieldsDraft;
  editing: boolean;
  onChange: (patch: Partial<DriverFieldsDraft>) => void;
  areas: Area[];
}) {
  const areaName = areas.find((a) => a.id === fields.areaId)?.name ?? "";
  return (
    <>
      <div className="field-row">
        <ViewOrInput
          id="driver-name"
          label="名前"
          value={fields.name}
          editing={editing}
          onChange={(v) => onChange({ name: v })}
        />
        <ViewOrInput
          id="driver-company-name"
          label="会社名"
          value={fields.companyName}
          editing={editing}
          onChange={(v) => onChange({ companyName: v })}
        />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="driver-area">所属エリア</label>
        {editing ? (
          <select
            id="driver-area"
            value={fields.areaId}
            onChange={(e) => onChange({ areaId: e.target.value })}
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
        ) : (
          <p className="text-sm">{areaName || "-"}</p>
        )}
      </div>

      <ViewOrRadio
        id="driver-contract-type"
        label="契約形態"
        value={fields.contractType}
        editing={editing}
        onChange={(v) => onChange({ contractType: v as ContractType })}
        options={CONTRACT_TYPES}
      />
      <ViewOrSelect
        id="driver-role"
        label="役割"
        value={fields.driverRole}
        editing={editing}
        onChange={(v) => onChange({ driverRole: v as DriverRole | "" })}
        options={DRIVER_ROLES}
      />

      <div className="field-row">
        <ViewOrInput
          id="driver-contract-start"
          label="契約開始日"
          type="date"
          value={fields.contractStartDate}
          editing={editing}
          onChange={(v) => onChange({ contractStartDate: v })}
        />
        <ViewOrInput
          id="driver-contract-end"
          label="契約終了日"
          type="date"
          value={fields.contractEndDate}
          editing={editing}
          onChange={(v) => onChange({ contractEndDate: v })}
        />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="driver-contract-deadline">契約期限</label>
        {editing ? (
          <>
            <label
              className="text-sm flex"
              style={{ gap: 6, alignItems: "center", marginBottom: 8 }}
              htmlFor="driver-contract-indefinite"
            >
              <input
                id="driver-contract-indefinite"
                type="checkbox"
                checked={fields.contractIndefinite}
                onChange={(e) => onChange({ contractIndefinite: e.target.checked })}
              />
              無期雇用
            </label>
            {!fields.contractIndefinite && (
              <input
                id="driver-contract-deadline"
                type="date"
                value={fields.contractDeadlineDate}
                onChange={(e) => onChange({ contractDeadlineDate: e.target.value })}
              />
            )}
          </>
        ) : (
          <p className="text-sm">{fields.contractIndefinite ? "無期雇用" : fields.contractDeadlineDate || "-"}</p>
        )}
      </div>

      <div className="field-row">
        <ViewOrInput
          id="driver-fixed-cost"
          label="固定費"
          type="number"
          value={fields.fixedCost}
          editing={editing}
          onChange={(v) => onChange({ fixedCost: v })}
          displayValue={fields.fixedCost ? `${formatYen(Number(fields.fixedCost))}円` : "-"}
        />
        <ViewOrCheckbox
          id="driver-advance-eligible"
          label="前払可能有無"
          checked={fields.advanceEligible}
          editing={editing}
          onChange={(v) => onChange({ advanceEligible: v })}
        />
      </div>

      <ViewOrInput
        id="driver-other-conditions"
        label="その他条件"
        type="textarea"
        value={fields.otherConditions}
        editing={editing}
        onChange={(v) => onChange({ otherConditions: v })}
      />

      <div className="field-row">
        <ViewOrInput
          id="driver-phone"
          label="連絡先（電話番号）"
          value={fields.phone}
          editing={editing}
          onChange={(v) => onChange({ phone: v })}
        />
        <ViewOrInput
          id="driver-email"
          label="メールアドレス"
          type="email"
          value={fields.email}
          editing={editing}
          onChange={(v) => onChange({ email: v })}
        />
      </div>

      <p className="section-title" style={{ marginTop: 6 }}>
        緊急連絡先
      </p>
      <div className="field-row">
        <ViewOrInput
          id="driver-emergency-name"
          label="氏名"
          value={fields.emergencyContactName}
          editing={editing}
          onChange={(v) => onChange({ emergencyContactName: v })}
        />
        <ViewOrInput
          id="driver-emergency-relation"
          label="続柄"
          value={fields.emergencyContactRelation}
          editing={editing}
          onChange={(v) => onChange({ emergencyContactRelation: v })}
        />
      </div>
      <ViewOrInput
        id="driver-emergency-phone"
        label="電話番号"
        value={fields.emergencyContactPhone}
        editing={editing}
        onChange={(v) => onChange({ emergencyContactPhone: v })}
      />

      <ViewOrInput
        id="driver-address"
        label="住所"
        value={fields.address}
        editing={editing}
        onChange={(v) => onChange({ address: v })}
      />

      <p className="section-title" style={{ marginTop: 6 }}>
        振込口座
      </p>
      <div className="field-row">
        <ViewOrInput
          id="driver-bank-name"
          label="銀行名"
          value={fields.bankName}
          editing={editing}
          onChange={(v) => onChange({ bankName: v })}
        />
        <ViewOrInput
          id="driver-bank-branch"
          label="支店名"
          value={fields.bankBranch}
          editing={editing}
          onChange={(v) => onChange({ bankBranch: v })}
        />
      </div>
      <div className="field-row">
        <ViewOrSelect
          id="driver-bank-account-type"
          label="口座種別"
          value={fields.bankAccountType}
          editing={editing}
          onChange={(v) => onChange({ bankAccountType: v as BankAccountType | "" })}
          options={BANK_ACCOUNT_TYPES}
        />
        <ViewOrInput
          id="driver-bank-account-number"
          label="口座番号"
          value={fields.bankAccountNumber}
          editing={editing}
          onChange={(v) => onChange({ bankAccountNumber: v })}
        />
      </div>
      <ViewOrInput
        id="driver-bank-account-holder"
        label="口座名義"
        value={fields.bankAccountHolder}
        editing={editing}
        onChange={(v) => onChange({ bankAccountHolder: v })}
      />

      <ViewOrRadio
        id="driver-pay-type"
        label="支払種別"
        value={fields.payType}
        editing={editing}
        onChange={(v) => onChange({ payType: v as PayType })}
        options={PAY_TYPES}
      />
    </>
  );
}

function DriverVehicleFields({
  fields,
  editing,
  onChange,
}: {
  fields: DriverFieldsDraft;
  editing: boolean;
  onChange: (patch: Partial<DriverFieldsDraft>) => void;
}) {
  return (
    <>
      <ViewOrInput
        id="driver-vehicle-number"
        label="車両ナンバー"
        value={fields.vehicleNumber}
        editing={editing}
        onChange={(v) => onChange({ vehicleNumber: v })}
      />
      <ViewOrRadio
        id="driver-vehicle-ownership"
        label="所有車両"
        value={fields.vehicleOwnership}
        editing={editing}
        onChange={(v) => onChange({ vehicleOwnership: v as VehicleOwnership | "" })}
        options={VEHICLE_OWNERSHIPS}
      />
      <div className="field-row">
        <ViewOrInput
          id="driver-vehicle-lease-cost"
          label="貸出費用"
          type="number"
          value={fields.vehicleLeaseCost}
          editing={editing}
          onChange={(v) => onChange({ vehicleLeaseCost: v })}
          displayValue={fields.vehicleLeaseCost ? `${formatYen(Number(fields.vehicleLeaseCost))}円` : "-"}
        />
        <ViewOrInput
          id="driver-vehicle-lease-start"
          label="貸出日"
          type="date"
          value={fields.vehicleLeaseStartDate}
          editing={editing}
          onChange={(v) => onChange({ vehicleLeaseStartDate: v })}
        />
      </div>
      <div className="field-row">
        <ViewOrInput
          id="driver-vehicle-inspection-deadline"
          label="車検期限"
          type="date"
          value={fields.vehicleInspectionDeadline}
          editing={editing}
          onChange={(v) => onChange({ vehicleInspectionDeadline: v })}
        />
        <ViewOrInput
          id="driver-vehicle-insurance-deadline"
          label="任意保険期限"
          type="date"
          value={fields.vehicleInsuranceDeadline}
          editing={editing}
          onChange={(v) => onChange({ vehicleInsuranceDeadline: v })}
        />
      </div>
    </>
  );
}

function DriverGasCardFields({
  fields,
  editing,
  onChange,
}: {
  fields: DriverFieldsDraft;
  editing: boolean;
  onChange: (patch: Partial<DriverFieldsDraft>) => void;
}) {
  return (
    <>
      <ViewOrCheckbox
        id="driver-gas-card-provided"
        label="貸出有無"
        checked={fields.gasCardProvided}
        editing={editing}
        onChange={(v) => onChange({ gasCardProvided: v })}
      />
      <div className="field-row">
        <ViewOrInput
          id="driver-gas-card-issued-date"
          label="貸出日"
          type="date"
          value={fields.gasCardIssuedDate}
          editing={editing}
          onChange={(v) => onChange({ gasCardIssuedDate: v })}
        />
        <ViewOrSelect
          id="driver-gas-card-type"
          label="種類"
          value={fields.gasCardType}
          editing={editing}
          onChange={(v) => onChange({ gasCardType: v as GasCardType | "" })}
          options={GAS_CARD_TYPES}
        />
      </div>
    </>
  );
}

export default function MasterDriverPage() {
  const { user } = useCurrentUser();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [deliveryTypes, setDeliveryTypes] = useState<DeliveryType[]>([]);
  const [unitPrices, setUnitPrices] = useState<UnitPrice[]>([]);
  const [drivers, setDrivers] = useState<DriverWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<DriverFieldsDraft>(EMPTY_DRIVER_FIELDS);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([]);
  const [newDistrictName, setNewDistrictName] = useState("");

  const [detailDriverId, setDetailDriverId] = useState<string | null>(null);
  const detailDriver = drivers.find((d) => d.id === detailDriverId) ?? null;
  const [activeTab, setActiveTab] = useState<DetailTabKey>("basic");
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<DriverFieldsDraft | null>(null);
  const [docIndex, setDocIndex] = useState(0);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [areaRes, districtRes, docTypeRes, deliveryTypeRes, unitPriceRes, driverRes] = await Promise.all([
        apiRequest<{ data: Area[] }>("/api/master/areas"),
        apiRequest<{ data: District[] }>("/api/master/districts"),
        apiRequest<{ data: DocumentType[] }>("/api/master/document-types"),
        apiRequest<{ data: DeliveryType[] }>("/api/master/delivery-types"),
        apiRequest<{ data: UnitPrice[] }>("/api/master/unit-prices"),
        apiRequest<{ data: RawDriverRow[] }>("/api/master/drivers"),
      ]);
      setAreas(areaRes.data);
      setDistricts(districtRes.data);
      setDocumentTypes(docTypeRes.data);
      setDeliveryTypes(deliveryTypeRes.data);
      setUnitPrices(unitPriceRes.data);
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

  useEffect(() => {
    // 詳細モーダルを開き直す・切り替えるたびにタブ・編集状態・書類カルーセルを
    // リセットする意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab("basic");
    setIsEditing(false);
    setEditDraft(null);
    setDocIndex(0);
    setShowAccountForm(false);
    setShowPasswordForm(false);
    setPasswordInput("");
  }, [detailDriverId]);

  // 卸単価の「本日以前で最新」の値をセルキー単位で引く（master/price.tsxと同じロジック）
  const latestPriceByCell = new Map<string, UnitPrice>();
  const today = todayIso();
  for (const p of unitPrices) {
    if (p.effective_from > today) continue;
    const key = cellKey(p.price_kind, p.area_id, p.delivery_type_id);
    const current = latestPriceByCell.get(key);
    if (!current || p.effective_from > current.effective_from) {
      latestPriceByCell.set(key, p);
    }
  }
  const priceTargetTypes = deliveryTypes.filter((dt) => dt.price_master_target);

  const districtsForForm = districts.filter((d) => d.area_id === form.areaId);

  function resetForm() {
    setForm(EMPTY_DRIVER_FIELDS);
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
          ...fieldsToApiBody(form),
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

  function handleStartEdit() {
    if (!detailDriver) return;
    setEditDraft(driverToFields(detailDriver));
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditDraft(null);
  }

  async function handleSaveEdit() {
    if (!detailDriver || !editDraft) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/master/drivers/${detailDriver.id}`, {
        method: "PATCH",
        body: JSON.stringify(fieldsToApiBody(editDraft)),
      });
      setIsEditing(false);
      setEditDraft(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleIssueAccount() {
    if (!detailDriver || !passwordInput) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/master/drivers/${detailDriver.id}/account`, {
        method: "POST",
        body: JSON.stringify({ password: passwordInput }),
      });
      setShowAccountForm(false);
      setPasswordInput("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アカウント発行に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!detailDriver || !passwordInput) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/master/drivers/${detailDriver.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: passwordInput }),
      });
      setShowPasswordForm(false);
      setPasswordInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "パスワード再設定に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(driver: DriverWithRelations, docType: DocumentType, file: File, expiresOn: string) {
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

      const res = await apiRequest<{ imported: number; skipped: number }>("/api/master/drivers/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });

      if (res.skipped > 0) {
        setError(`${res.imported}件を取り込みました（${res.skipped}件は契約形態などの不正値のためスキップ）。`);
      }

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  const editingFields = isEditing ? editDraft : detailDriver ? driverToFields(detailDriver) : null;

  function updateEditDraft(patch: Partial<DriverFieldsDraft>) {
    setEditDraft((prev) => (prev ? { ...prev, ...patch } : prev));
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
                  <th>名前</th>
                  <th>所属</th>
                  <th>契約形態</th>
                  <th>連絡先</th>
                  <th>メールアドレス</th>
                  <th>前払可能有無</th>
                  <th>書類</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && drivers.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <p className="empty-note">登録済みのドライバーはいません。</p>
                    </td>
                  </tr>
                )}
                {drivers.map((driver) => {
                  const status = documentStatus(driver, documentTypes.length);
                  return (
                    <tr key={driver.id}>
                      <td>{driver.name}</td>
                      <td>{driver.area?.name ?? "-"}</td>
                      <td>{driver.contract_type}</td>
                      <td>{driver.phone || "-"}</td>
                      <td>{driver.email || "-"}</td>
                      <td>
                        <span className={`pill pill--${driver.advance_eligible ? "confirmed" : "pending"}`}>
                          {driver.advance_eligible ? "有" : "無"}
                        </span>
                      </td>
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
        <Modal title="ドライバー新規登録" onClose={() => setShowCreate(false)} wide>
          <form onSubmit={handleCreate}>
            <p className="section-title">基本情報</p>
            <DriverBasicFields fields={form} editing onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} areas={areas} />

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

            <p className="section-title" style={{ marginTop: 22 }}>
              車両情報
            </p>
            <DriverVehicleFields fields={form} editing onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />

            <p className="section-title" style={{ marginTop: 22 }}>
              ガソリンカード
            </p>
            <DriverGasCardFields fields={form} editing onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />

            <button type="submit" className="btn btn--primary btn--block" style={{ marginTop: 18 }} disabled={saving}>
              {saving ? "登録中..." : "登録する"}
            </button>
          </form>
        </Modal>
      )}

      {detailDriver && editingFields && (
        <Modal
          title={`ドライバー詳細 — ${detailDriver.name}`}
          subtitle={`UID: ${detailDriver.id}`}
          onClose={() => setDetailDriverId(null)}
          wide
          headerAction={
            isEditing ? (
              <div className="flex" style={{ gap: 8 }}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleCancelEdit} disabled={saving}>
                  キャンセル
                </button>
                <button type="button" className="btn btn--primary btn--sm" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleStartEdit}>
                編集
              </button>
            )
          }
        >
          <div className="tabbar" style={{ marginBottom: 22 }}>
            {DETAIL_TABS.map((tab) => (
              <a
                key={tab.key}
                href="#"
                className={tab.key === activeTab ? "is-active" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setActiveTab(tab.key);
                }}
              >
                {tab.label}
              </a>
            ))}
          </div>

          <div style={{ minHeight: "calc(94vh - 210px)" }}>
          {activeTab === "basic" && (
            <div>
              <DriverBasicFields fields={editingFields} editing={isEditing} onChange={updateEditDraft} areas={areas} />

              <p className="section-title" style={{ marginTop: 6 }}>
                単価（卸単価・自動取得）
              </p>
              <div className="table-wrap" style={{ marginBottom: 18 }}>
                <table>
                  <thead>
                    <tr>
                      {priceTargetTypes.map((dt) => (
                        <th className="num" key={dt.id}>
                          {dt.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {priceTargetTypes.map((dt) => {
                        const price = latestPriceByCell.get(cellKey("卸単価", detailDriver.area_id, dt.id));
                        return (
                          <td className="num" key={dt.id}>
                            {price ? formatYen(price.price_yen) : "未設定"}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="section-title">パスワード</p>
              <div style={{ marginBottom: 18 }}>
                {!detailDriver.profile_id && !detailDriver.email && (
                  <p className="text-sm text-muted">メールアドレスを設定するとアカウントを発行できます。</p>
                )}
                {!detailDriver.profile_id && detailDriver.email && user.role !== "管理者" && (
                  <p className="text-sm text-muted">アカウント発行は管理者のみ行えます。</p>
                )}
                {!detailDriver.profile_id && detailDriver.email && user.role === "管理者" && !showAccountForm && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowAccountForm(true)}>
                    アカウント発行
                  </button>
                )}
                {detailDriver.profile_id && !showPasswordForm && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowPasswordForm(true)}>
                    パスワードを再設定
                  </button>
                )}
                {(showAccountForm || showPasswordForm) && (
                  <div className="flex" style={{ gap: 8, marginTop: 8, alignItems: "center" }}>
                    <input
                      type="password"
                      placeholder="新しいパスワード"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      style={{ maxWidth: 240 }}
                    />
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={saving || !passwordInput}
                      onClick={showAccountForm ? handleIssueAccount : handleResetPassword}
                    >
                      {saving ? "処理中..." : "設定する"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        setShowAccountForm(false);
                        setShowPasswordForm(false);
                        setPasswordInput("");
                      }}
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "vehicle" && (
            <DriverVehicleFields fields={editingFields} editing={isEditing} onChange={updateEditDraft} />
          )}

          {activeTab === "gascard" && (
            <DriverGasCardFields fields={editingFields} editing={isEditing} onChange={updateEditDraft} />
          )}

          {activeTab === "documents" && documentTypes.length > 0 && (
            <DocumentCarousel
              documentTypes={documentTypes}
              docIndex={docIndex}
              setDocIndex={setDocIndex}
              driver={detailDriver}
              saving={saving}
              onUpload={handleUpload}
              onView={handleViewDocument}
            />
          )}
          </div>
        </Modal>
      )}
    </>
  );
}

function DocumentCarousel({
  documentTypes,
  docIndex,
  setDocIndex,
  driver,
  saving,
  onUpload,
  onView,
}: {
  documentTypes: DocumentType[];
  docIndex: number;
  setDocIndex: (updater: (prev: number) => number) => void;
  driver: DriverWithRelations;
  saving: boolean;
  onUpload: (driver: DriverWithRelations, docType: DocumentType, file: File, expiresOn: string) => void;
  onView: (doc: DriverDocument) => void;
}) {
  const docType = documentTypes[docIndex];
  const doc = driver.documents.find((d) => d.document_type_id === docType.id);

  return (
    <div>
      <div className="flex" style={{ justifyContent: "center", marginBottom: 18 }}>
        <div className="date-nav">
          <button
            type="button"
            className="date-nav__btn"
            aria-label="前の書類"
            onClick={() => setDocIndex((i) => (i - 1 + documentTypes.length) % documentTypes.length)}
          >
            ‹
          </button>
          <span className="date-nav__value">
            {docType.label}（{docIndex + 1}/{documentTypes.length}）
          </span>
          <button
            type="button"
            className="date-nav__btn"
            aria-label="次の書類"
            onClick={() => setDocIndex((i) => (i + 1) % documentTypes.length)}
          >
            ›
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
        {doc ? (
          <button type="button" className="tag" style={{ cursor: "pointer", fontSize: 13 }} onClick={() => onView(doc)}>
            {docType.label}
            {doc.expires_on && `（期限：${doc.expires_on}）`}
          </button>
        ) : (
          <DocumentUploadRow
            docType={docType}
            disabled={saving}
            onUpload={(file, expiresOn) => onUpload(driver, docType, file, expiresOn)}
          />
        )}
      </div>
    </div>
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
    <div className="flex" style={{ gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
      <span className="tag" style={{ borderStyle: "dashed", color: "var(--gray-400)" }}>
        未提出
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
