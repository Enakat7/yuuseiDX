import { BREAKDOWN_ITEM_COUNT } from "@/types/domain/paymentNoticeTemplate";
import type { PaymentNoticeTemplate, SampleData } from "@/types/domain/paymentNoticeTemplate";

export const DEFAULT_BREAKDOWN_ITEM_LABELS = ["完了数", "転居等", "夜間配送", "繁忙期加算", "大配送", "集荷"];

export function createDefaultTemplate(): PaymentNoticeTemplate {
  return { version: 2, breakdownItemLabels: [...DEFAULT_BREAKDOWN_ITEM_LABELS] };
}

export function normalizeTemplate(raw: unknown): PaymentNoticeTemplate {
  if (!raw || typeof raw !== "object") return createDefaultTemplate();
  const t = raw as Record<string, unknown>;
  if (
    t.version !== 2 ||
    !Array.isArray(t.breakdownItemLabels) ||
    t.breakdownItemLabels.length !== BREAKDOWN_ITEM_COUNT ||
    !t.breakdownItemLabels.every((v) => typeof v === "string")
  ) {
    return createDefaultTemplate();
  }
  return { version: 2, breakdownItemLabels: t.breakdownItemLabels as string[] };
}

export function setBreakdownItemLabel(
  template: PaymentNoticeTemplate,
  index: number,
  label: string
): PaymentNoticeTemplate {
  const breakdownItemLabels = [...template.breakdownItemLabels];
  breakdownItemLabels[index] = label;
  return { ...template, breakdownItemLabels };
}

const SAMPLE_DAY_DATES = ["7/1(水)", "7/2(木)", "7/3(金)", "7/4(土)", "7/5(日)", "7/6(月)"];

// 配送種別マスタの並び順（列index）ごとの日別サンプル件数。種別数がこの列数を超える場合は循環利用する。
const SAMPLE_COUNT_SERIES: number[][] = [
  [32, 30, 35, 28, 0, 33],
  [1, 0, 2, 0, 0, 1],
  [0, 1, 0, 0, 0, 1],
  [2, 1, 0, 3, 0, 1],
  [4, 3, 5, 2, 0, 4],
  [0, 0, 1, 0, 0, 0],
];

export function buildSampleData(deliveryTypeCodes: string[]): SampleData {
  const daily = SAMPLE_DAY_DATES.map((date, dayIndex) => ({
    date,
    counts: Object.fromEntries(
      deliveryTypeCodes.map((code, colIndex) => [
        code,
        SAMPLE_COUNT_SERIES[colIndex % SAMPLE_COUNT_SERIES.length][dayIndex],
      ])
    ),
  }));
  const items: SampleData["items"] = [
    { qty: 158, unitPrice: 150, amount: 23700 },
    { qty: 4, unitPrice: 200, amount: 800 },
    { qty: 2, unitPrice: 300, amount: 600 },
    { qty: 7, unitPrice: 500, amount: 3500 },
    { qty: 18, unitPrice: 100, amount: 1800 },
  ];
  return {
    header: {
      postalCode: "123-4567",
      address: "東京都○○区○○1-2-3",
      name: "山田 太郎",
      payDate: "2026-08-07",
      bankName: "○○銀行",
      bankBranch: "○○支店",
      bankAccountType: "普通",
      bankAccountNumber: "1234567",
      bankAccountHolder: "ヤマダ タロウ",
      invoiceNumber: "T1234567890123",
      companyName: "株式会社ユウセイ",
      companyAddress: "東京都△△区△△4-5-6",
      companyPhone: "03-1234-5678",
      noticeNo: "PN-2026-0001",
      payType: "週払い",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-06",
    },
    daily,
    items,
    summary: {
      allowanceTotal: 30400,
      salesTotalTaxIncl: 30400,
      otherSalesTotalTaxIncl: 0,
      deductionTotalTaxIncl: 0,
      grandTotalTaxIncl: 30400,
      consumptionTax: 2764,
    },
  };
}
