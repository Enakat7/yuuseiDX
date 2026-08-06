export type CellAlign = "left" | "center" | "right";
export type CellVAlign = "top" | "middle" | "bottom";

export type CellBorders = { top: boolean; right: boolean; bottom: boolean; left: boolean };

export type CellStyle = {
  bold?: boolean;
  align?: CellAlign;
  valign?: CellVAlign;
  background?: string;
  fontSize?: number;
  borders?: CellBorders;
};

export type TemplateCell = {
  content: string;
  rowSpan?: number;
  colSpan?: number;
  style?: CellStyle;
};

export type RepeatingSource = "daily" | "items";

export type RepeatingRegion = {
  id: string;
  row: number;
  source: RepeatingSource;
};

export type PaymentNoticeTemplate = {
  version: 1;
  rowCount: number;
  colCount: number;
  columnWidths: number[];
  rowHeights: number[];
  cells: Record<string, TemplateCell>;
  repeatingRows: RepeatingRegion[];
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
  completed: number;
  relocation: number;
  night: number;
  bulk: number;
  pickup: number;
  other: number;
};

export type ItemSampleRow = {
  category: string;
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

export type TokenDef = { key: string; label: string };
export type TokenGroup = { namespace: "header" | "daily" | "items" | "summary"; label: string; tokens: TokenDef[] };

export type CellSelection = { r1: number; c1: number; r2: number; c2: number };
