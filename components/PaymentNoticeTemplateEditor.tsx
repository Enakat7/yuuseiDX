import { useEffect, useMemo, useState } from "react";
import PaymentNoticeMockupPreview from "@/components/PaymentNoticeMockupPreview";
import { apiRequest } from "@/lib/apiClient";
import { buildSampleData, setBreakdownItemLabel } from "@/lib/paymentNoticeTemplate";
import type { PaymentNoticeTemplate } from "@/types/domain/paymentNoticeTemplate";
import type { DeliveryType } from "@/types/domain/master";

type Props = { value: PaymentNoticeTemplate; onChange: (next: PaymentNoticeTemplate) => void };

export default function PaymentNoticeTemplateEditor({ value, onChange }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [deliveryTypes, setDeliveryTypes] = useState<DeliveryType[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ data: DeliveryType[] }>("/api/master/delivery-types")
      .then((res) => setDeliveryTypes(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "配送種別マスタの取得に失敗しました。"));
  }, []);

  const activeCodes = useMemo(
    () => deliveryTypes.filter((t) => t.price_master_target).map((t) => t.code),
    [deliveryTypes]
  );
  const sampleData = useMemo(() => buildSampleData(activeCodes), [activeCodes]);

  return (
    <div className="template-editor">
      <div className="role-toggle" style={{ maxWidth: 280, marginBottom: 14 }}>
        <button
          type="button"
          className={`opt${!editMode ? " is-active" : ""}`}
          onClick={() => setEditMode(false)}
        >
          プレビュー
        </button>
        <button type="button" className={`opt${editMode ? " is-active" : ""}`} onClick={() => setEditMode(true)}>
          編集
        </button>
      </div>

      {error && <p className="template-editor__error">{error}</p>}

      <div className="template-editor__canvas">
        <p className="hint" style={{ marginBottom: 10 }}>
          サンプルデータで表示しています。実データとの連携は今後対応予定です。
          {editMode && " 明細内訳の項目名は下の欄から編集できます。"}
        </p>
        <PaymentNoticeMockupPreview
          sample={sampleData}
          deliveryTypes={deliveryTypes}
          breakdownItemLabels={value.breakdownItemLabels}
          editMode={editMode}
          onChangeBreakdownLabel={(index, label) => onChange(setBreakdownItemLabel(value, index, label))}
        />
      </div>
    </div>
  );
}
