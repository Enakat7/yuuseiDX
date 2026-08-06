import Head from "next/head";
import { useEffect, useRef, useState, type FormEvent } from "react";
import OperationLayout from "@/components/OperationLayout";
import MasterTabs from "@/components/MasterTabs";
import Modal from "@/components/Modal";
import ImportModeToggle, { type ImportMode } from "@/components/ImportModeToggle";
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
  DriverDocumentFile,
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

const LICENSE_DOCUMENT_LABEL = "免許証";
const VEHICLE_CERT_DOCUMENT_LABEL = "車検証";
const INSURANCE_DOCUMENT_LABEL = "任意保険証";
const CALI_DOCUMENT_LABEL = "自賠責保険証";

// 令和・平成・昭和・大正・明治の元号表記（yy年mm月dd日）に変換する。
// 開始日より前（明治以前）はISO表記のままフォールバックする。
const JAPANESE_ERAS = [
  { name: "令和", start: Date.UTC(2019, 4, 1) },
  { name: "平成", start: Date.UTC(1989, 0, 8) },
  { name: "昭和", start: Date.UTC(1926, 11, 25) },
  { name: "大正", start: Date.UTC(1912, 6, 30) },
  { name: "明治", start: Date.UTC(1868, 0, 25) },
] as const;

function formatJapaneseEraDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const time = Date.UTC(y, m - 1, d);
  for (const era of JAPANESE_ERAS) {
    if (time >= era.start) {
      const eraStartYear = new Date(era.start).getUTCFullYear();
      const eraYear = y - eraStartYear + 1;
      const yearLabel = eraYear === 1 ? "元" : String(eraYear).padStart(2, "0");
      return `${era.name}${yearLabel}年${String(m).padStart(2, "0")}月${String(d).padStart(2, "0")}日`;
    }
  }
  return iso;
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
    documents: driver_documents.map((doc) => ({
      ...doc,
      files: [...doc.files].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    })),
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
  const [importMode, setImportMode] = useState<ImportMode>("append");

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
  const [licenseDraft, setLicenseDraft] = useState<LicenseFieldsDraft | null>(null);
  const [vehicleCertDraft, setVehicleCertDraft] = useState<VehicleCertFieldsDraft | null>(null);
  const [insuranceDraft, setInsuranceDraft] = useState<InsuranceFieldsDraft | null>(null);
  const [caliDraft, setCaliDraft] = useState<CaliFieldsDraft | null>(null);

  const licenseDocType = documentTypes.find((dt) => dt.label === LICENSE_DOCUMENT_LABEL);
  const licenseDoc = licenseDocType
    ? (detailDriver?.documents.find((d) => d.document_type_id === licenseDocType.id) ?? null)
    : null;
  const vehicleCertDocType = documentTypes.find((dt) => dt.label === VEHICLE_CERT_DOCUMENT_LABEL);
  const vehicleCertDoc = vehicleCertDocType
    ? (detailDriver?.documents.find((d) => d.document_type_id === vehicleCertDocType.id) ?? null)
    : null;
  const insuranceDocType = documentTypes.find((dt) => dt.label === INSURANCE_DOCUMENT_LABEL);
  const insuranceDoc = insuranceDocType
    ? (detailDriver?.documents.find((d) => d.document_type_id === insuranceDocType.id) ?? null)
    : null;
  const caliDocType = documentTypes.find((dt) => dt.label === CALI_DOCUMENT_LABEL);
  const caliDoc = caliDocType
    ? (detailDriver?.documents.find((d) => d.document_type_id === caliDocType.id) ?? null)
    : null;

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
    setLicenseDraft(licenseDoc ? licenseDraftFromDoc(licenseDoc) : null);
    setVehicleCertDraft(vehicleCertDoc ? vehicleCertDraftFromDoc(vehicleCertDoc) : null);
    setInsuranceDraft(insuranceDoc ? insuranceDraftFromDoc(insuranceDoc) : null);
    setCaliDraft(caliDoc ? caliDraftFromDoc(caliDoc) : null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditDraft(null);
    setLicenseDraft(null);
    setVehicleCertDraft(null);
    setInsuranceDraft(null);
    setCaliDraft(null);
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
      if (licenseDoc && licenseDraft) {
        await apiRequest(`/api/master/driver-documents/${licenseDoc.id}`, {
          method: "PATCH",
          body: JSON.stringify(licenseDraftToApiBody(licenseDraft)),
        });
      }
      if (vehicleCertDoc && vehicleCertDraft) {
        await apiRequest(`/api/master/driver-documents/${vehicleCertDoc.id}`, {
          method: "PATCH",
          body: JSON.stringify(vehicleCertDraftToApiBody(vehicleCertDraft)),
        });
      }
      if (insuranceDoc && insuranceDraft) {
        await apiRequest(`/api/master/driver-documents/${insuranceDoc.id}`, {
          method: "PATCH",
          body: JSON.stringify(insuranceDraftToApiBody(insuranceDraft)),
        });
      }
      if (caliDoc && caliDraft) {
        await apiRequest(`/api/master/driver-documents/${caliDoc.id}`, {
          method: "PATCH",
          body: JSON.stringify(caliDraftToApiBody(caliDraft)),
        });
      }
      setIsEditing(false);
      setEditDraft(null);
      setLicenseDraft(null);
      setVehicleCertDraft(null);
      setInsuranceDraft(null);
      setCaliDraft(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDriver() {
    if (!detailDriver) return;
    if (
      !window.confirm(
        `${detailDriver.name}を削除します。よろしいですか？\n（ログインアカウントが発行済みの場合はログインもできなくなります。この操作は取り消せません。）`
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/master/drivers/${detailDriver.id}`, { method: "DELETE" });
      setDetailDriverId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました。");
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

  async function fetchFileUrl(file: DriverDocumentFile): Promise<string> {
    const { url } = await apiRequest<{ url: string }>(`/api/master/driver-document-files/${file.id}/signed-url`);
    return url;
  }

  async function handleDeleteFile(file: DriverDocumentFile) {
    if (!window.confirm("このファイルを削除します。よろしいですか？")) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/master/driver-document-files/${file.id}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました。");
    } finally {
      setSaving(false);
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

      const res = await apiRequest<{ imported: number; updated: number; skipped: number }>(
        "/api/master/drivers/import",
        {
          method: "POST",
          body: JSON.stringify({ rows, mode: importMode }),
        }
      );

      if (res.skipped > 0) {
        setError(
          `${res.imported}件を新規登録、${res.updated}件を更新しました（${res.skipped}件は契約形態などの不正値のためスキップ）。`
        );
      }

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  const editingFields = isEditing ? editDraft : detailDriver ? driverToFields(detailDriver) : null;
  const licenseFieldsForDisplay = isEditing
    ? licenseDraft
    : licenseDoc
      ? licenseDraftFromDoc(licenseDoc)
      : null;
  const vehicleCertFieldsForDisplay = isEditing
    ? vehicleCertDraft
    : vehicleCertDoc
      ? vehicleCertDraftFromDoc(vehicleCertDoc)
      : null;
  const insuranceFieldsForDisplay = isEditing
    ? insuranceDraft
    : insuranceDoc
      ? insuranceDraftFromDoc(insuranceDoc)
      : null;
  const caliFieldsForDisplay = isEditing ? caliDraft : caliDoc ? caliDraftFromDoc(caliDoc) : null;

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

            <button type="submit" className="btn btn--ghost btn--block" style={{ marginTop: 18 }} disabled={saving}>
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
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            ) : (
              <div className="flex" style={{ gap: 8 }}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleDeleteDriver} disabled={saving}>
                  削除
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleStartEdit}>
                  編集
                </button>
              </div>
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
                      className="btn btn--ghost btn--sm"
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
              getUrl={fetchFileUrl}
              onDeleteFile={handleDeleteFile}
              isEditing={isEditing}
              licenseDraft={licenseFieldsForDisplay}
              onLicenseChange={(patch) => setLicenseDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
              vehicleCertDraft={vehicleCertFieldsForDisplay}
              onVehicleCertChange={(patch) => setVehicleCertDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
              insuranceDraft={insuranceFieldsForDisplay}
              onInsuranceChange={(patch) => setInsuranceDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
              caliDraft={caliFieldsForDisplay}
              onCaliChange={(patch) => setCaliDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          )}
          </div>
        </Modal>
      )}
    </>
  );
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

function DocumentCarousel({
  documentTypes,
  docIndex,
  setDocIndex,
  driver,
  saving,
  onUpload,
  getUrl,
  onDeleteFile,
  isEditing,
  licenseDraft,
  onLicenseChange,
  vehicleCertDraft,
  onVehicleCertChange,
  insuranceDraft,
  onInsuranceChange,
  caliDraft,
  onCaliChange,
}: {
  documentTypes: DocumentType[];
  docIndex: number;
  setDocIndex: (updater: (prev: number) => number) => void;
  driver: DriverWithRelations;
  saving: boolean;
  onUpload: (driver: DriverWithRelations, docType: DocumentType, file: File, expiresOn: string) => Promise<void>;
  getUrl: (file: DriverDocumentFile) => Promise<string>;
  onDeleteFile: (file: DriverDocumentFile) => Promise<void>;
  isEditing: boolean;
  licenseDraft: LicenseFieldsDraft | null;
  onLicenseChange: (patch: Partial<LicenseFieldsDraft>) => void;
  vehicleCertDraft: VehicleCertFieldsDraft | null;
  onVehicleCertChange: (patch: Partial<VehicleCertFieldsDraft>) => void;
  insuranceDraft: InsuranceFieldsDraft | null;
  onInsuranceChange: (patch: Partial<InsuranceFieldsDraft>) => void;
  caliDraft: CaliFieldsDraft | null;
  onCaliChange: (patch: Partial<CaliFieldsDraft>) => void;
}) {
  const docType = documentTypes[docIndex];
  const doc = driver.documents.find((d) => d.document_type_id === docType.id);
  const files = doc?.files ?? [];
  const [fileIndex, setFileIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    // 表示中の書類種別を切り替えるたびにファイルカルーセルの位置をリセットする
    // 意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFileIndex(0);
  }, [docIndex]);

  const safeFileIndex = files.length > 0 ? Math.min(fileIndex, files.length - 1) : 0;
  const currentFile = files[safeFileIndex] ?? null;

  useEffect(() => {
    // 表示中のファイルが変わるたびに署名付きURLを取り直す意図的な副作用のため無効化する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(null);
    setPreviewError(null);
    if (!currentFile) return;
    let cancelled = false;
    getUrl(currentFile)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : "表示に失敗しました。");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFile?.id, currentFile?.storage_path]);

  const extension = currentFile?.original_filename.split(".").pop()?.toLowerCase() ?? "";
  const isImage = IMAGE_EXTENSIONS.includes(extension);
  const isPdf = extension === "pdf";
  const atMaxFiles = docType.max_files !== null && files.length >= docType.max_files;

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

      <div className="grid grid--2">
        <div style={{ maxHeight: 480, overflowY: "auto", paddingRight: 8 }}>
          <p className="section-title">{docType.label}</p>
          {doc ? (
            <>
              <p className="text-sm">
                <strong>提出状況：</strong>
                <span className="pill pill--confirmed" style={{ marginLeft: 6 }}>
                  提出済み
                </span>
                <span className="text-sm text-muted" style={{ marginLeft: 8 }}>
                  {files.length}
                  {docType.max_files !== null ? `／${docType.max_files}` : ""}枚
                </span>
              </p>
              {docType.label !== LICENSE_DOCUMENT_LABEL &&
                docType.label !== VEHICLE_CERT_DOCUMENT_LABEL &&
                docType.label !== INSURANCE_DOCUMENT_LABEL &&
                docType.label !== CALI_DOCUMENT_LABEL && (
                  <p className="text-sm">
                    <strong>有効期限：</strong>
                    {doc.expires_on ?? (docType.is_expiring ? "未設定" : "期限なし")}
                  </p>
                )}
              {docType.label === LICENSE_DOCUMENT_LABEL && licenseDraft && (
                <LicenseDetails editing={isEditing} draft={licenseDraft} onChange={onLicenseChange} />
              )}
              {docType.label === VEHICLE_CERT_DOCUMENT_LABEL && vehicleCertDraft && (
                <VehicleCertDetails editing={isEditing} draft={vehicleCertDraft} onChange={onVehicleCertChange} />
              )}
              {docType.label === INSURANCE_DOCUMENT_LABEL && insuranceDraft && (
                <InsuranceDetails editing={isEditing} draft={insuranceDraft} onChange={onInsuranceChange} />
              )}
              {docType.label === CALI_DOCUMENT_LABEL && caliDraft && (
                <CaliDetails editing={isEditing} draft={caliDraft} onChange={onCaliChange} />
              )}
            </>
          ) : (
            <>
              <p className="text-sm" style={{ marginBottom: 12 }}>
                <strong>提出状況：</strong>
                <span className="pill pill--pending" style={{ marginLeft: 6 }}>
                  未提出
                </span>
              </p>
              <DocumentUploadRow
                docType={docType}
                disabled={saving}
                onUpload={(file, expiresOn) => onUpload(driver, docType, file, expiresOn)}
              />
            </>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          {!doc && <p className="text-sm text-muted">未提出</p>}

          {doc && (
            <>
              {files.length > 1 && (
                <div className="flex" style={{ justifyContent: "center", marginBottom: 12 }}>
                  <div className="date-nav">
                    <button
                      type="button"
                      className="date-nav__btn"
                      aria-label="前のファイル"
                      onClick={() => setFileIndex((i) => (i - 1 + files.length) % files.length)}
                    >
                      ‹
                    </button>
                    <span className="date-nav__value">
                      {safeFileIndex + 1}/{files.length}
                    </span>
                    <button
                      type="button"
                      className="date-nav__btn"
                      aria-label="次のファイル"
                      onClick={() => setFileIndex((i) => (i + 1) % files.length)}
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}

              {previewError && (
                <p className="text-sm" style={{ color: "var(--black)" }}>
                  {previewError}
                </p>
              )}

              {!previewError && !previewUrl && <p className="text-sm text-muted">読み込み中...</p>}

              {previewUrl && isImage && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  {/* Supabaseの署名付きURL（短時間で失効・毎回変動）のためnext/imageの最適化対象にできない */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={docType.label}
                    style={{ maxWidth: "100%", maxHeight: 420, border: "var(--border-w-sm) solid var(--black)" }}
                  />
                </a>
              )}

              {previewUrl && isPdf && (
                <iframe
                  src={previewUrl}
                  title={docType.label}
                  style={{ width: "100%", height: 420, border: "var(--border-w-sm) solid var(--black)" }}
                />
              )}

              {previewUrl && !isImage && !isPdf && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tag"
                  style={{ cursor: "pointer", fontSize: 13 }}
                >
                  {docType.label}を開く
                </a>
              )}

              {currentFile && (
                <p className="text-sm text-muted" style={{ marginTop: 8 }}>
                  {currentFile.original_filename}
                </p>
              )}

              {currentFile && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={saving}
                    onClick={() => onDeleteFile(currentFile)}
                  >
                    このファイルを削除
                  </button>
                </div>
              )}

              {!atMaxFiles && (
                <div style={{ marginTop: 16 }}>
                  <DocumentUploadRow
                    docType={docType}
                    disabled={saving}
                    label="ファイルを追加"
                    captureExpiresOn={false}
                    onUpload={(file, expiresOn) => onUpload(driver, docType, file, expiresOn)}
                  />
                </div>
              )}

              {atMaxFiles && (
                <p className="text-sm text-muted" style={{ marginTop: 16 }}>
                  アップロード上限（{docType.max_files}枚）に達しています。
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type LicenseFieldsDraft = {
  holderName: string;
  birthDate: string;
  address: string;
  issuedDate: string;
  expiresOn: string;
  conditions: string;
  licenseNumber: string;
};

function licenseDraftFromDoc(doc: DriverDocument): LicenseFieldsDraft {
  return {
    holderName: doc.license_holder_name ?? "",
    birthDate: doc.license_birth_date ?? "",
    address: doc.license_address ?? "",
    issuedDate: doc.license_issued_date ?? "",
    expiresOn: doc.expires_on ?? "",
    conditions: doc.license_conditions ?? "",
    licenseNumber: doc.license_number ?? "",
  };
}

function licenseDraftToApiBody(fields: LicenseFieldsDraft) {
  return {
    license_holder_name: fields.holderName || null,
    license_birth_date: fields.birthDate || null,
    license_address: fields.address || null,
    license_issued_date: fields.issuedDate || null,
    expires_on: fields.expiresOn || null,
    license_conditions: fields.conditions || null,
    license_number: fields.licenseNumber || null,
  };
}

function LicenseDateField({
  id,
  label,
  value,
  editing,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      <label htmlFor={id}>{label}</label>
      {editing ? (
        <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <p className="text-sm">{value ? formatJapaneseEraDate(value) : "-"}</p>
      )}
    </div>
  );
}

function LicenseDetails({
  editing,
  draft,
  onChange,
}: {
  editing: boolean;
  draft: LicenseFieldsDraft;
  onChange: (patch: Partial<LicenseFieldsDraft>) => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <p className="section-title">記載事項</p>

      <ViewOrInput
        id="license-holder-name"
        label="氏名"
        value={draft.holderName}
        editing={editing}
        onChange={(v) => onChange({ holderName: v })}
      />
      <LicenseDateField
        id="license-birth-date"
        label="生年月日"
        value={draft.birthDate}
        editing={editing}
        onChange={(v) => onChange({ birthDate: v })}
      />
      <ViewOrInput
        id="license-address"
        label="住所"
        value={draft.address}
        editing={editing}
        onChange={(v) => onChange({ address: v })}
      />
      <LicenseDateField
        id="license-issued-date"
        label="交付日"
        value={draft.issuedDate}
        editing={editing}
        onChange={(v) => onChange({ issuedDate: v })}
      />
      <LicenseDateField
        id="license-expires-on"
        label="有効期限"
        value={draft.expiresOn}
        editing={editing}
        onChange={(v) => onChange({ expiresOn: v })}
      />
      <ViewOrInput
        id="license-conditions"
        label="条件等"
        type="textarea"
        value={draft.conditions}
        editing={editing}
        onChange={(v) => onChange({ conditions: v })}
      />
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="license-number">番号</label>
        {editing ? (
          <div className="flex" style={{ gap: 6, alignItems: "center" }}>
            <span className="text-sm">第</span>
            <input
              id="license-number"
              type="text"
              value={draft.licenseNumber}
              onChange={(e) => onChange({ licenseNumber: e.target.value })}
            />
            <span className="text-sm">号</span>
          </div>
        ) : (
          <p className="text-sm">{draft.licenseNumber ? `第 ${draft.licenseNumber} 号` : "-"}</p>
        )}
      </div>
    </div>
  );
}

type VehicleCertFieldsDraft = {
  vehicleNumber: string;
  vehicleType: string;
  purpose: string;
  usage: string;
  modelName: string;
  maxLoad: string;
  chassisNumber: string;
  displacement: string;
  ownerName: string;
  ownerAddress: string;
  baseLocation: string;
  expiresOn: string;
};

function vehicleCertDraftFromDoc(doc: DriverDocument): VehicleCertFieldsDraft {
  return {
    vehicleNumber: doc.vehicle_cert_number ?? "",
    vehicleType: doc.vehicle_cert_type ?? "",
    purpose: doc.vehicle_cert_purpose ?? "",
    usage: doc.vehicle_cert_usage ?? "",
    modelName: doc.vehicle_cert_model_name ?? "",
    maxLoad: doc.vehicle_cert_max_load ?? "",
    chassisNumber: doc.vehicle_cert_chassis_number ?? "",
    displacement: doc.vehicle_cert_displacement ?? "",
    ownerName: doc.vehicle_cert_owner_name ?? "",
    ownerAddress: doc.vehicle_cert_owner_address ?? "",
    baseLocation: doc.vehicle_cert_base_location ?? "",
    expiresOn: doc.expires_on ?? "",
  };
}

function vehicleCertDraftToApiBody(fields: VehicleCertFieldsDraft) {
  return {
    vehicle_cert_number: fields.vehicleNumber || null,
    vehicle_cert_type: fields.vehicleType || null,
    vehicle_cert_purpose: fields.purpose || null,
    vehicle_cert_usage: fields.usage || null,
    vehicle_cert_model_name: fields.modelName || null,
    vehicle_cert_max_load: fields.maxLoad || null,
    vehicle_cert_chassis_number: fields.chassisNumber || null,
    vehicle_cert_displacement: fields.displacement || null,
    vehicle_cert_owner_name: fields.ownerName || null,
    vehicle_cert_owner_address: fields.ownerAddress || null,
    vehicle_cert_base_location: fields.baseLocation || null,
    expires_on: fields.expiresOn || null,
  };
}

function VehicleCertDetails({
  editing,
  draft,
  onChange,
}: {
  editing: boolean;
  draft: VehicleCertFieldsDraft;
  onChange: (patch: Partial<VehicleCertFieldsDraft>) => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <p className="section-title">記載事項</p>

      <ViewOrInput
        id="vehicle-cert-number"
        label="車両番号"
        value={draft.vehicleNumber}
        editing={editing}
        onChange={(v) => onChange({ vehicleNumber: v })}
      />
      <ViewOrInput
        id="vehicle-cert-type"
        label="自動車の種別"
        value={draft.vehicleType}
        editing={editing}
        onChange={(v) => onChange({ vehicleType: v })}
      />
      <ViewOrInput
        id="vehicle-cert-purpose"
        label="用途"
        value={draft.purpose}
        editing={editing}
        onChange={(v) => onChange({ purpose: v })}
      />
      <ViewOrInput
        id="vehicle-cert-usage"
        label="自家用･事業用の別"
        value={draft.usage}
        editing={editing}
        onChange={(v) => onChange({ usage: v })}
      />
      <ViewOrInput
        id="vehicle-cert-model-name"
        label="車名"
        value={draft.modelName}
        editing={editing}
        onChange={(v) => onChange({ modelName: v })}
      />
      <ViewOrInput
        id="vehicle-cert-max-load"
        label="最大積載量"
        value={draft.maxLoad}
        editing={editing}
        onChange={(v) => onChange({ maxLoad: v })}
      />
      <ViewOrInput
        id="vehicle-cert-chassis-number"
        label="車体番号"
        value={draft.chassisNumber}
        editing={editing}
        onChange={(v) => onChange({ chassisNumber: v })}
      />
      <ViewOrInput
        id="vehicle-cert-displacement"
        label="総排気量"
        value={draft.displacement}
        editing={editing}
        onChange={(v) => onChange({ displacement: v })}
      />
      <ViewOrInput
        id="vehicle-cert-owner-name"
        label="使用者の氏名又は名称"
        value={draft.ownerName}
        editing={editing}
        onChange={(v) => onChange({ ownerName: v })}
      />
      <ViewOrInput
        id="vehicle-cert-owner-address"
        label="使用者の住所"
        value={draft.ownerAddress}
        editing={editing}
        onChange={(v) => onChange({ ownerAddress: v })}
      />
      <ViewOrInput
        id="vehicle-cert-base-location"
        label="使用の本拠の位置"
        value={draft.baseLocation}
        editing={editing}
        onChange={(v) => onChange({ baseLocation: v })}
      />
      <LicenseDateField
        id="vehicle-cert-expires-on"
        label="有効期間の満了する日"
        value={draft.expiresOn}
        editing={editing}
        onChange={(v) => onChange({ expiresOn: v })}
      />
    </div>
  );
}

type InsuranceFieldsDraft = {
  policyNumber: string;
  periodStart: string;
  periodEnd: string;
  insuredName: string;
  vehicleOwner: string;
  driverCondition: string;
  insuredVehicle: string;
  coverageBodily: string;
  coverageProperty: string;
  coveragePersonal: string;
  coverageVehicle: string;
  coverageCargo: string;
};

function insuranceDraftFromDoc(doc: DriverDocument): InsuranceFieldsDraft {
  return {
    policyNumber: doc.insurance_policy_number ?? "",
    periodStart: doc.insurance_period_start ?? "",
    periodEnd: doc.expires_on ?? "",
    insuredName: doc.insurance_insured_name ?? "",
    vehicleOwner: doc.insurance_vehicle_owner ?? "",
    driverCondition: doc.insurance_driver_condition ?? "",
    insuredVehicle: doc.insurance_insured_vehicle ?? "",
    coverageBodily: doc.insurance_coverage_bodily ?? "",
    coverageProperty: doc.insurance_coverage_property ?? "",
    coveragePersonal: doc.insurance_coverage_personal ?? "",
    coverageVehicle: doc.insurance_coverage_vehicle ?? "",
    coverageCargo: doc.insurance_coverage_cargo ?? "",
  };
}

function insuranceDraftToApiBody(fields: InsuranceFieldsDraft) {
  return {
    insurance_policy_number: fields.policyNumber || null,
    insurance_period_start: fields.periodStart || null,
    expires_on: fields.periodEnd || null,
    insurance_insured_name: fields.insuredName || null,
    insurance_vehicle_owner: fields.vehicleOwner || null,
    insurance_driver_condition: fields.driverCondition || null,
    insurance_insured_vehicle: fields.insuredVehicle || null,
    insurance_coverage_bodily: fields.coverageBodily || null,
    insurance_coverage_property: fields.coverageProperty || null,
    insurance_coverage_personal: fields.coveragePersonal || null,
    insurance_coverage_vehicle: fields.coverageVehicle || null,
    insurance_coverage_cargo: fields.coverageCargo || null,
  };
}

function InsurancePeriodField({
  startValue,
  endValue,
  editing,
  onChangeStart,
  onChangeEnd,
}: {
  startValue: string;
  endValue: string;
  editing: boolean;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
}) {
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      <label htmlFor="insurance-period-start">保険期間</label>
      {editing ? (
        <div className="flex" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            id="insurance-period-start"
            type="date"
            value={startValue}
            onChange={(e) => onChangeStart(e.target.value)}
          />
          <span className="text-sm">から</span>
          <input
            id="insurance-period-end"
            type="date"
            value={endValue}
            onChange={(e) => onChangeEnd(e.target.value)}
          />
          <span className="text-sm">まで</span>
        </div>
      ) : (
        <p className="text-sm">
          {startValue || endValue
            ? `${startValue ? formatJapaneseEraDate(startValue) : "-"} から ${
                endValue ? formatJapaneseEraDate(endValue) : "-"
              } まで`
            : "-"}
        </p>
      )}
    </div>
  );
}

function InsuranceDetails({
  editing,
  draft,
  onChange,
}: {
  editing: boolean;
  draft: InsuranceFieldsDraft;
  onChange: (patch: Partial<InsuranceFieldsDraft>) => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <p className="section-title">記載事項</p>

      <ViewOrInput
        id="insurance-policy-number"
        label="証券番号"
        value={draft.policyNumber}
        editing={editing}
        onChange={(v) => onChange({ policyNumber: v })}
      />
      <InsurancePeriodField
        startValue={draft.periodStart}
        endValue={draft.periodEnd}
        editing={editing}
        onChangeStart={(v) => onChange({ periodStart: v })}
        onChangeEnd={(v) => onChange({ periodEnd: v })}
      />
      <ViewOrInput
        id="insurance-insured-name"
        label="記名被保険者"
        value={draft.insuredName}
        editing={editing}
        onChange={(v) => onChange({ insuredName: v })}
      />
      <ViewOrInput
        id="insurance-vehicle-owner"
        label="車両保有者"
        value={draft.vehicleOwner}
        editing={editing}
        onChange={(v) => onChange({ vehicleOwner: v })}
      />
      <ViewOrInput
        id="insurance-driver-condition"
        label="運転者の条件"
        value={draft.driverCondition}
        editing={editing}
        onChange={(v) => onChange({ driverCondition: v })}
      />
      <ViewOrInput
        id="insurance-insured-vehicle"
        label="被保険自動車"
        value={draft.insuredVehicle}
        editing={editing}
        onChange={(v) => onChange({ insuredVehicle: v })}
      />
      <ViewOrInput
        id="insurance-coverage-bodily"
        label="保障内容(対人)"
        value={draft.coverageBodily}
        editing={editing}
        onChange={(v) => onChange({ coverageBodily: v })}
      />
      <ViewOrInput
        id="insurance-coverage-property"
        label="保障内容(対物)"
        value={draft.coverageProperty}
        editing={editing}
        onChange={(v) => onChange({ coverageProperty: v })}
      />
      <ViewOrInput
        id="insurance-coverage-personal"
        label="保障内容(自身)"
        value={draft.coveragePersonal}
        editing={editing}
        onChange={(v) => onChange({ coveragePersonal: v })}
      />
      <ViewOrInput
        id="insurance-coverage-vehicle"
        label="保障内容(車)"
        value={draft.coverageVehicle}
        editing={editing}
        onChange={(v) => onChange({ coverageVehicle: v })}
      />
      <ViewOrInput
        id="insurance-coverage-cargo"
        label="保障内容(荷物)"
        value={draft.coverageCargo}
        editing={editing}
        onChange={(v) => onChange({ coverageCargo: v })}
      />
    </div>
  );
}

type CaliFieldsDraft = {
  registrationPlace: string;
  registrationClassification: string;
  registrationUsage: string;
  registrationNumber: string;
  periodStart: string;
  periodEnd: string;
  policyholderAddress: string;
  policyholderName: string;
};

function caliDraftFromDoc(doc: DriverDocument): CaliFieldsDraft {
  return {
    registrationPlace: doc.cali_registration_place ?? "",
    registrationClassification: doc.cali_registration_classification ?? "",
    registrationUsage: doc.cali_registration_usage ?? "",
    registrationNumber: doc.cali_registration_number ?? "",
    periodStart: doc.cali_period_start ?? "",
    periodEnd: doc.expires_on ?? "",
    policyholderAddress: doc.cali_policyholder_address ?? "",
    policyholderName: doc.cali_policyholder_name ?? "",
  };
}

function caliDraftToApiBody(fields: CaliFieldsDraft) {
  return {
    cali_registration_place: fields.registrationPlace || null,
    cali_registration_classification: fields.registrationClassification || null,
    cali_registration_usage: fields.registrationUsage || null,
    cali_registration_number: fields.registrationNumber || null,
    cali_period_start: fields.periodStart || null,
    expires_on: fields.periodEnd || null,
    cali_policyholder_address: fields.policyholderAddress || null,
    cali_policyholder_name: fields.policyholderName || null,
  };
}

function CaliDetails({
  editing,
  draft,
  onChange,
}: {
  editing: boolean;
  draft: CaliFieldsDraft;
  onChange: (patch: Partial<CaliFieldsDraft>) => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <p className="section-title">記載事項</p>

      <ViewOrInput
        id="cali-registration-place"
        label="自動車登録番号(地名)"
        value={draft.registrationPlace}
        editing={editing}
        onChange={(v) => onChange({ registrationPlace: v })}
      />
      <ViewOrInput
        id="cali-registration-classification"
        label="自動車登録番号(分類番号)"
        value={draft.registrationClassification}
        editing={editing}
        onChange={(v) => onChange({ registrationClassification: v })}
      />
      <ViewOrInput
        id="cali-registration-usage"
        label="自動車登録番号(用途を表す文字)"
        value={draft.registrationUsage}
        editing={editing}
        onChange={(v) => onChange({ registrationUsage: v })}
      />
      <ViewOrInput
        id="cali-registration-number"
        label="自動車登録番号(指定番号)"
        value={draft.registrationNumber}
        editing={editing}
        onChange={(v) => onChange({ registrationNumber: v })}
      />
      <LicenseDateField
        id="cali-period-start"
        label="保険期間(自)"
        value={draft.periodStart}
        editing={editing}
        onChange={(v) => onChange({ periodStart: v })}
      />
      <LicenseDateField
        id="cali-period-end"
        label="保険期間(至)"
        value={draft.periodEnd}
        editing={editing}
        onChange={(v) => onChange({ periodEnd: v })}
      />
      <ViewOrInput
        id="cali-policyholder-address"
        label="保険契約者(住所)"
        value={draft.policyholderAddress}
        editing={editing}
        onChange={(v) => onChange({ policyholderAddress: v })}
      />
      <ViewOrInput
        id="cali-policyholder-name"
        label="保険契約者(氏名)"
        value={draft.policyholderName}
        editing={editing}
        onChange={(v) => onChange({ policyholderName: v })}
      />
    </div>
  );
}

function DocumentUploadRow({
  docType,
  disabled,
  label = "未提出",
  captureExpiresOn = true,
  onUpload,
}: {
  docType: DocumentType;
  disabled: boolean;
  label?: string;
  captureExpiresOn?: boolean;
  onUpload: (file: File, expiresOn: string) => void;
}) {
  const [expiresOn, setExpiresOn] = useState("");

  return (
    <div className="flex" style={{ gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
      <span className="tag" style={{ borderStyle: "dashed", color: "var(--gray-400)" }}>
        {label}
      </span>
      {docType.is_expiring && captureExpiresOn && (
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
