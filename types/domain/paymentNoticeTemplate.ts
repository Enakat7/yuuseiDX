export const BREAKDOWN_ITEM_COUNT = 6;

export type PaymentNoticeTemplate = {
  version: 2;
  // 明細内訳（pn-mockup__breakdown）の項目行ラベル。行数は固定・項目名のみ編集可能。
  breakdownItemLabels: string[];
};

export type HeaderSample = {
  postalCode: string;
  address: string;
  name: string;
  payDate: string;
  bankName: string;
  bankBranch: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  invoiceNumber: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  noticeNo: string;
  payType: string;
  periodStart: string;
  periodEnd: string;
};

export type DailySampleRow = {
  date: string;
  // 配送種別マスタのcodeをキーとした件数。実績表(pn-mockup__achievements)の列は
  // 配送種別マスタ[単価マスタ対象]と連動して動的に決まるため固定フィールドを持たない。
  counts: Record<string, number>;
};

export type ItemSampleRow = {
  qty: number;
  unitPrice: number;
  amount: number;
};

export type SummarySample = {
  allowanceTotal: number;
  salesTotalTaxIncl: number;
  otherSalesTotalTaxIncl: number;
  deductionTotalTaxIncl: number;
  grandTotalTaxIncl: number;
  consumptionTax: number;
};

export type SampleData = {
  header: HeaderSample;
  daily: DailySampleRow[];
  items: ItemSampleRow[];
  summary: SummarySample;
};
