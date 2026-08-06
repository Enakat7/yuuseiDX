import type {
  CellSelection,
  CellStyle,
  PaymentNoticeTemplate,
  RepeatingRegion,
  RepeatingSource,
  SampleData,
  TemplateCell,
  TokenGroup,
} from "@/types/domain/paymentNoticeTemplate";

const DEFAULT_COL_WIDTH = 90;
const DEFAULT_ROW_HEIGHT = 32;
const MIN_ROWS = 2;
const MIN_COLS = 2;

const DEFAULT_BORDERS = { top: true, right: true, bottom: true, left: true };

export const DEFAULT_CELL_STYLE: Required<CellStyle> = {
  bold: false,
  align: "left",
  valign: "middle",
  background: "#ffffff",
  fontSize: 12,
  borders: DEFAULT_BORDERS,
};

export function resolveStyle(style?: CellStyle): Required<CellStyle> {
  return {
    bold: style?.bold ?? DEFAULT_CELL_STYLE.bold,
    align: style?.align ?? DEFAULT_CELL_STYLE.align,
    valign: style?.valign ?? DEFAULT_CELL_STYLE.valign,
    background: style?.background ?? DEFAULT_CELL_STYLE.background,
    fontSize: style?.fontSize ?? DEFAULT_CELL_STYLE.fontSize,
    borders: style?.borders ?? DEFAULT_BORDERS,
  };
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function parseKey(k: string): { row: number; col: number } {
  const [row, col] = k.split(",").map(Number);
  return { row, col };
}

export function normalizeSelection(sel: CellSelection): CellSelection {
  return {
    r1: Math.min(sel.r1, sel.r2),
    c1: Math.min(sel.c1, sel.c2),
    r2: Math.max(sel.r1, sel.r2),
    c2: Math.max(sel.c1, sel.c2),
  };
}

export function isWholeRowSelection(selection: CellSelection | null, colCount: number): boolean {
  if (!selection) return false;
  const sel = normalizeSelection(selection);
  return sel.r1 === sel.r2 && sel.c1 === 0 && sel.c2 === colCount - 1;
}

export function getCoveredSet(template: PaymentNoticeTemplate): Set<string> {
  const covered = new Set<string>();
  for (const k of Object.keys(template.cells)) {
    const { row, col } = parseKey(k);
    const cell = template.cells[k];
    const rowSpan = cell.rowSpan ?? 1;
    const colSpan = cell.colSpan ?? 1;
    for (let dr = 0; dr < rowSpan; dr++) {
      for (let dc = 0; dc < colSpan; dc++) {
        if (dr === 0 && dc === 0) continue;
        covered.add(key(row + dr, col + dc));
      }
    }
  }
  return covered;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createDefaultTemplate(): PaymentNoticeTemplate {
  const cells: Record<string, TemplateCell> = {
    [key(0, 0)]: {
      content: "支払通知書",
      colSpan: 7,
      style: { bold: true, align: "center", fontSize: 16 },
    },
    [key(1, 0)]: { content: "氏名：" },
    [key(1, 1)]: { content: "{{header.name}}", colSpan: 2 },
    [key(1, 3)]: { content: "支払日：" },
    [key(1, 4)]: { content: "{{header.payDate}}", colSpan: 3 },
    [key(2, 0)]: { content: "日付", style: { bold: true, align: "center" } },
    [key(2, 1)]: { content: "配達完了", style: { bold: true, align: "center" } },
    [key(2, 2)]: { content: "転居等", style: { bold: true, align: "center" } },
    [key(2, 3)]: { content: "夜間配送", style: { bold: true, align: "center" } },
    [key(2, 4)]: { content: "大配送", style: { bold: true, align: "center" } },
    [key(2, 5)]: { content: "集荷", style: { bold: true, align: "center" } },
    [key(2, 6)]: { content: "その他", style: { bold: true, align: "center" } },
    [key(3, 0)]: { content: "{{daily.date}}", style: { align: "center" } },
    [key(3, 1)]: { content: "{{daily.completed}}", style: { align: "center" } },
    [key(3, 2)]: { content: "{{daily.relocation}}", style: { align: "center" } },
    [key(3, 3)]: { content: "{{daily.night}}", style: { align: "center" } },
    [key(3, 4)]: { content: "{{daily.bulk}}", style: { align: "center" } },
    [key(3, 5)]: { content: "{{daily.pickup}}", style: { align: "center" } },
    [key(3, 6)]: { content: "{{daily.other}}", style: { align: "center" } },
    [key(4, 0)]: { content: "項目", colSpan: 3, style: { bold: true, align: "center" } },
    [key(4, 3)]: { content: "数量", style: { bold: true, align: "center" } },
    [key(4, 4)]: { content: "単価", style: { bold: true, align: "center" } },
    [key(4, 5)]: { content: "金額", colSpan: 2, style: { bold: true, align: "center" } },
    [key(5, 0)]: { content: "{{items.category}}", colSpan: 3 },
    [key(5, 3)]: { content: "{{items.qty}}", style: { align: "right" } },
    [key(5, 4)]: { content: "{{items.unitPrice}}", style: { align: "right" } },
    [key(5, 5)]: { content: "{{items.amount}}", colSpan: 2, style: { align: "right" } },
    [key(6, 0)]: { content: "合計（税込）", colSpan: 5, style: { bold: true, align: "right" } },
    [key(6, 5)]: { content: "{{summary.grandTotalTaxIncl}}", colSpan: 2, style: { bold: true, align: "right" } },
  };

  const repeatingRows: RepeatingRegion[] = [
    { id: makeId(), row: 3, source: "daily" },
    { id: makeId(), row: 5, source: "items" },
  ];

  const rowCount = 7;
  const colCount = 7;

  return {
    version: 1,
    rowCount,
    colCount,
    columnWidths: Array.from({ length: colCount }, (_, i) => (i === 0 ? 120 : DEFAULT_COL_WIDTH)),
    rowHeights: Array.from({ length: rowCount }, (_, i) => (i === 0 ? 44 : DEFAULT_ROW_HEIGHT)),
    cells,
    repeatingRows,
  };
}

export function normalizeTemplate(raw: unknown): PaymentNoticeTemplate {
  if (!raw || typeof raw !== "object") return createDefaultTemplate();
  const t = raw as Record<string, unknown>;
  const rowCount = t.rowCount;
  const colCount = t.colCount;
  if (
    typeof rowCount !== "number" ||
    typeof colCount !== "number" ||
    rowCount < MIN_ROWS ||
    colCount < MIN_COLS ||
    !Array.isArray(t.columnWidths) ||
    !Array.isArray(t.rowHeights) ||
    typeof t.cells !== "object" ||
    t.cells === null ||
    !Array.isArray(t.repeatingRows) ||
    t.columnWidths.length !== colCount ||
    t.rowHeights.length !== rowCount
  ) {
    return createDefaultTemplate();
  }
  return {
    version: 1,
    rowCount,
    colCount,
    columnWidths: t.columnWidths as number[],
    rowHeights: t.rowHeights as number[],
    cells: t.cells as Record<string, TemplateCell>,
    repeatingRows: t.repeatingRows as RepeatingRegion[],
  };
}

export function insertRow(template: PaymentNoticeTemplate, at: number): PaymentNoticeTemplate {
  const insertAt = Math.max(0, Math.min(at, template.rowCount));
  const newCells: Record<string, TemplateCell> = {};
  for (const k of Object.keys(template.cells)) {
    const { row, col } = parseKey(k);
    const cell = template.cells[k];
    const rowSpan = cell.rowSpan ?? 1;
    if (row >= insertAt) {
      newCells[key(row + 1, col)] = cell;
    } else if (row + rowSpan > insertAt) {
      newCells[key(row, col)] = { ...cell, rowSpan: rowSpan + 1 };
    } else {
      newCells[k] = cell;
    }
  }
  const rowHeights = [...template.rowHeights];
  rowHeights.splice(insertAt, 0, DEFAULT_ROW_HEIGHT);
  const repeatingRows = template.repeatingRows.map((r) => (r.row >= insertAt ? { ...r, row: r.row + 1 } : r));
  return { ...template, rowCount: template.rowCount + 1, rowHeights, cells: newCells, repeatingRows };
}

export function insertColumn(template: PaymentNoticeTemplate, at: number): PaymentNoticeTemplate {
  const insertAt = Math.max(0, Math.min(at, template.colCount));
  const newCells: Record<string, TemplateCell> = {};
  for (const k of Object.keys(template.cells)) {
    const { row, col } = parseKey(k);
    const cell = template.cells[k];
    const colSpan = cell.colSpan ?? 1;
    if (col >= insertAt) {
      newCells[key(row, col + 1)] = cell;
    } else if (col + colSpan > insertAt) {
      newCells[key(row, col)] = { ...cell, colSpan: colSpan + 1 };
    } else {
      newCells[k] = cell;
    }
  }
  const columnWidths = [...template.columnWidths];
  columnWidths.splice(insertAt, 0, DEFAULT_COL_WIDTH);
  return { ...template, colCount: template.colCount + 1, columnWidths, cells: newCells };
}

function clipSpansIntersectingRow(
  cells: Record<string, TemplateCell>,
  row: number
): { cells: Record<string, TemplateCell>; hadMerge: boolean } {
  let hadMerge = false;
  const next: Record<string, TemplateCell> = {};
  for (const k of Object.keys(cells)) {
    const { row: r } = parseKey(k);
    const cell = cells[k];
    const rowSpan = cell.rowSpan ?? 1;
    const colSpan = cell.colSpan ?? 1;
    if ((rowSpan > 1 || colSpan > 1) && row >= r && row < r + rowSpan) {
      hadMerge = true;
      next[k] = { ...cell, rowSpan: 1, colSpan: 1 };
    } else {
      next[k] = cell;
    }
  }
  return { cells: next, hadMerge };
}

function clipSpansIntersectingCol(
  cells: Record<string, TemplateCell>,
  col: number
): { cells: Record<string, TemplateCell>; hadMerge: boolean } {
  let hadMerge = false;
  const next: Record<string, TemplateCell> = {};
  for (const k of Object.keys(cells)) {
    const { col: c } = parseKey(k);
    const cell = cells[k];
    const rowSpan = cell.rowSpan ?? 1;
    const colSpan = cell.colSpan ?? 1;
    if ((rowSpan > 1 || colSpan > 1) && col >= c && col < c + colSpan) {
      hadMerge = true;
      next[k] = { ...cell, rowSpan: 1, colSpan: 1 };
    } else {
      next[k] = cell;
    }
  }
  return { cells: next, hadMerge };
}

export function removeRow(
  template: PaymentNoticeTemplate,
  row: number
): { template: PaymentNoticeTemplate; notice?: string } {
  if (template.rowCount <= MIN_ROWS) {
    return { template, notice: `行はこれ以上削除できません（最小${MIN_ROWS}行）。` };
  }
  const { cells: clipped, hadMerge } = clipSpansIntersectingRow(template.cells, row);
  const newCells: Record<string, TemplateCell> = {};
  for (const k of Object.keys(clipped)) {
    const { row: r, col: c } = parseKey(k);
    if (r === row) continue;
    newCells[key(r > row ? r - 1 : r, c)] = clipped[k];
  }
  const rowHeights = [...template.rowHeights];
  rowHeights.splice(row, 1);
  const repeatingRows = template.repeatingRows
    .filter((r) => r.row !== row)
    .map((r) => (r.row > row ? { ...r, row: r.row - 1 } : r));
  return {
    template: { ...template, rowCount: template.rowCount - 1, rowHeights, cells: newCells, repeatingRows },
    notice: hadMerge ? "このセルは結合されています。削除により結合が解除されました。" : undefined,
  };
}

export function removeColumn(
  template: PaymentNoticeTemplate,
  col: number
): { template: PaymentNoticeTemplate; notice?: string } {
  if (template.colCount <= MIN_COLS) {
    return { template, notice: `列はこれ以上削除できません（最小${MIN_COLS}列）。` };
  }
  const { cells: clipped, hadMerge } = clipSpansIntersectingCol(template.cells, col);
  const newCells: Record<string, TemplateCell> = {};
  for (const k of Object.keys(clipped)) {
    const { row: r, col: c } = parseKey(k);
    if (c === col) continue;
    newCells[key(r, c > col ? c - 1 : c)] = clipped[k];
  }
  const columnWidths = [...template.columnWidths];
  columnWidths.splice(col, 1);
  return {
    template: { ...template, colCount: template.colCount - 1, columnWidths, cells: newCells },
    notice: hadMerge ? "このセルは結合されています。削除により結合が解除されました。" : undefined,
  };
}

function rectsOverlap(a: CellSelection, b: CellSelection): boolean {
  return a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;
}

function rectContains(outer: CellSelection, inner: CellSelection): boolean {
  return inner.r1 >= outer.r1 && inner.r2 <= outer.r2 && inner.c1 >= outer.c1 && inner.c2 <= outer.c2;
}

export function mergeCells(
  template: PaymentNoticeTemplate,
  selection: CellSelection
): { template: PaymentNoticeTemplate; error?: string } {
  const sel = normalizeSelection(selection);
  if (sel.r1 === sel.r2 && sel.c1 === sel.c2) {
    return { template, error: "結合するには複数のセルを選択してください。" };
  }
  if (sel.r2 > sel.r1 && template.repeatingRows.some((r) => r.row >= sel.r1 && r.row <= sel.r2)) {
    return { template, error: "繰り返し行を含む範囲は結合できません。" };
  }
  for (const k of Object.keys(template.cells)) {
    const { row, col } = parseKey(k);
    const cell = template.cells[k];
    const rowSpan = cell.rowSpan ?? 1;
    const colSpan = cell.colSpan ?? 1;
    const cellRect: CellSelection = { r1: row, c1: col, r2: row + rowSpan - 1, c2: col + colSpan - 1 };
    if (rectsOverlap(cellRect, sel) && !rectContains(sel, cellRect)) {
      return { template, error: "選択範囲が既存の結合と重なっています。" };
    }
  }
  const anchorKey = key(sel.r1, sel.c1);
  const anchorCell = template.cells[anchorKey] ?? { content: "" };
  const newCells = { ...template.cells };
  for (let r = sel.r1; r <= sel.r2; r++) {
    for (let c = sel.c1; c <= sel.c2; c++) {
      delete newCells[key(r, c)];
    }
  }
  newCells[anchorKey] = { ...anchorCell, rowSpan: sel.r2 - sel.r1 + 1, colSpan: sel.c2 - sel.c1 + 1 };
  return { template: { ...template, cells: newCells } };
}

export function unmergeCell(template: PaymentNoticeTemplate, row: number, col: number): PaymentNoticeTemplate {
  const k = key(row, col);
  const cell = template.cells[k];
  if (!cell || ((cell.rowSpan ?? 1) === 1 && (cell.colSpan ?? 1) === 1)) return template;
  return { ...template, cells: { ...template.cells, [k]: { ...cell, rowSpan: 1, colSpan: 1 } } };
}

export function setColumnWidth(template: PaymentNoticeTemplate, col: number, width: number): PaymentNoticeTemplate {
  const columnWidths = [...template.columnWidths];
  columnWidths[col] = width;
  return { ...template, columnWidths };
}

export function setRowHeight(template: PaymentNoticeTemplate, row: number, height: number): PaymentNoticeTemplate {
  const rowHeights = [...template.rowHeights];
  rowHeights[row] = height;
  return { ...template, rowHeights };
}

export function toggleRepeatingRow(
  template: PaymentNoticeTemplate,
  row: number,
  source: RepeatingSource | null
): { template: PaymentNoticeTemplate; error?: string } {
  if (source === null) {
    return { template: { ...template, repeatingRows: template.repeatingRows.filter((r) => r.row !== row) } };
  }
  const covered = getCoveredSet(template);
  for (let c = 0; c < template.colCount; c++) {
    if (covered.has(key(row, c))) {
      return { template, error: "この行は結合セルにまたがっているため、繰り返し行にできません。" };
    }
    const cell = template.cells[key(row, c)];
    if (cell && ((cell.rowSpan ?? 1) > 1 || (cell.colSpan ?? 1) > 1)) {
      return { template, error: "この行は結合セルを含むため、繰り返し行にできません。" };
    }
  }
  const repeatingRows = [...template.repeatingRows.filter((r) => r.row !== row), { id: makeId(), row, source }];
  return { template: { ...template, repeatingRows } };
}

export function setCellContent(template: PaymentNoticeTemplate, row: number, col: number, content: string): PaymentNoticeTemplate {
  const k = key(row, col);
  const existing = template.cells[k];
  return { ...template, cells: { ...template.cells, [k]: { ...(existing ?? {}), content } } };
}

export function setCellStyle(
  template: PaymentNoticeTemplate,
  cellsToUpdate: { row: number; col: number }[],
  updater: (style: CellStyle | undefined) => CellStyle
): PaymentNoticeTemplate {
  const next = { ...template.cells };
  for (const { row, col } of cellsToUpdate) {
    const k = key(row, col);
    const existing = next[k] ?? { content: "" };
    next[k] = { ...existing, style: updater(existing.style) };
  }
  return { ...template, cells: next };
}

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    namespace: "header",
    label: "ヘッダー",
    tokens: [
      { key: "header.noticeNo", label: "通知書番号" },
      { key: "header.name", label: "氏名" },
      { key: "header.postalCode", label: "郵便番号" },
      { key: "header.address", label: "住所" },
      { key: "header.payDate", label: "支払日" },
      { key: "header.bankName", label: "銀行名" },
      { key: "header.bankBranch", label: "支店名" },
      { key: "header.bankAccountType", label: "口座種別" },
      { key: "header.bankAccountNumber", label: "口座番号" },
      { key: "header.bankAccountHolder", label: "口座名義" },
      { key: "header.invoiceNumber", label: "インボイス番号" },
      { key: "header.companyName", label: "会社名" },
      { key: "header.companyAddress", label: "会社住所" },
      { key: "header.companyPhone", label: "会社電話番号" },
      { key: "header.payType", label: "支払種別" },
      { key: "header.periodStart", label: "対象期間（開始）" },
      { key: "header.periodEnd", label: "対象期間（終了）" },
    ],
  },
  {
    namespace: "daily",
    label: "日別（繰り返し行）",
    tokens: [
      { key: "daily.date", label: "日付" },
      { key: "daily.completed", label: "配達完了" },
      { key: "daily.relocation", label: "転居等" },
      { key: "daily.night", label: "夜間配送" },
      { key: "daily.bulk", label: "大配送" },
      { key: "daily.pickup", label: "集荷" },
      { key: "daily.other", label: "その他" },
    ],
  },
  {
    namespace: "items",
    label: "項目別（繰り返し行）",
    tokens: [
      { key: "items.category", label: "項目" },
      { key: "items.qty", label: "数量" },
      { key: "items.unitPrice", label: "単価" },
      { key: "items.amount", label: "金額" },
    ],
  },
  {
    namespace: "summary",
    label: "合計",
    tokens: [
      { key: "summary.allowanceTotal", label: "手当合計額" },
      { key: "summary.salesTotalTaxIncl", label: "売上合計（税込）" },
      { key: "summary.otherSalesTotalTaxIncl", label: "その他項目売上合計（税込）" },
      { key: "summary.deductionTotalTaxIncl", label: "引き去り額合計（税込）" },
      { key: "summary.grandTotalTaxIncl", label: "合計（税込）" },
      { key: "summary.consumptionTax", label: "内消費税（10%）" },
    ],
  },
];

export function buildSampleData(): SampleData {
  const daily = [
    { date: "7/1(水)", completed: 32, relocation: 1, night: 0, bulk: 2, pickup: 4, other: 0 },
    { date: "7/2(木)", completed: 30, relocation: 0, night: 1, bulk: 1, pickup: 3, other: 0 },
    { date: "7/3(金)", completed: 35, relocation: 2, night: 0, bulk: 0, pickup: 5, other: 1 },
    { date: "7/4(土)", completed: 28, relocation: 0, night: 0, bulk: 3, pickup: 2, other: 0 },
    { date: "7/5(日)", completed: 0, relocation: 0, night: 0, bulk: 0, pickup: 0, other: 0 },
    { date: "7/6(月)", completed: 33, relocation: 1, night: 1, bulk: 1, pickup: 4, other: 0 },
  ];
  const items = [
    { category: "配達完了", qty: 158, unitPrice: 150, amount: 23700 },
    { category: "転居等", qty: 4, unitPrice: 200, amount: 800 },
    { category: "夜間配送", qty: 2, unitPrice: 300, amount: 600 },
    { category: "大配送", qty: 7, unitPrice: 500, amount: 3500 },
    { category: "集荷", qty: 18, unitPrice: 100, amount: 1800 },
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

const TOKEN_PATTERN = /\{\{(\w+)\.(\w+)\}\}/g;

export function resolveCellContent(content: string, scope: Record<string, Record<string, unknown> | undefined>): string {
  return content.replace(TOKEN_PATTERN, (match, ns: string, field: string) => {
    const nsScope = scope[ns];
    if (!nsScope || !(field in nsScope)) return match;
    const val = nsScope[field];
    return val === undefined || val === null ? match : String(val);
  });
}

export type RenderCell = {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  content: string;
  style?: CellStyle;
};

function buildRowCells(
  template: PaymentNoticeTemplate,
  covered: Set<string>,
  row: number,
  scope?: Record<string, Record<string, unknown> | undefined>
): RenderCell[] {
  const out: RenderCell[] = [];
  for (let col = 0; col < template.colCount; col++) {
    if (covered.has(key(row, col))) continue;
    const cell = template.cells[key(row, col)];
    const rawContent = cell?.content ?? "";
    out.push({
      row,
      col,
      rowSpan: cell?.rowSpan ?? 1,
      colSpan: cell?.colSpan ?? 1,
      content: scope ? resolveCellContent(rawContent, scope) : rawContent,
      style: cell?.style,
    });
  }
  return out;
}

export function buildEditRows(template: PaymentNoticeTemplate): RenderCell[][] {
  const covered = getCoveredSet(template);
  const rows: RenderCell[][] = [];
  for (let row = 0; row < template.rowCount; row++) {
    rows.push(buildRowCells(template, covered, row));
  }
  return rows;
}

export type PreviewRow = { key: string; cells: RenderCell[] };

export function expandForPreview(template: PaymentNoticeTemplate, sample: SampleData): PreviewRow[] {
  const covered = getCoveredSet(template);
  const repeatingByRow = new Map(template.repeatingRows.map((r) => [r.row, r.source]));
  const rows: PreviewRow[] = [];
  for (let row = 0; row < template.rowCount; row++) {
    const source = repeatingByRow.get(row);
    if (source) {
      const list = sample[source] as unknown as Record<string, unknown>[];
      list.forEach((item, idx) => {
        const scope = { header: sample.header, summary: sample.summary, [source]: item };
        rows.push({ key: `${row}-${idx}`, cells: buildRowCells(template, covered, row, scope) });
      });
    } else {
      const scope = { header: sample.header, summary: sample.summary };
      rows.push({ key: `${row}`, cells: buildRowCells(template, covered, row, scope) });
    }
  }
  return rows;
}
