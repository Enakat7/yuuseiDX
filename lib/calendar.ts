export type MonthCell = {
  day: number | null;
  isWork: boolean;
};

export const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * Builds a Mon-start month grid.
 * `firstWeekday` is the weekday of day 1 (Mon=0 ... Sun=6).
 * `pattern` is a Mon-Sun work/off flag applied to every week of the month.
 */
export function buildMonthGrid(
  daysInMonth: number,
  firstWeekday: number,
  pattern: boolean[]
): { cells: MonthCell[]; workCount: number } {
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells: MonthCell[] = [];
  let workCount = 0;

  for (let slot = 0; slot < totalCells; slot++) {
    const day = slot - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) {
      cells.push({ day: null, isWork: false });
      continue;
    }
    const col = slot % 7;
    const isWork = pattern[col];
    if (isWork) workCount += 1;
    cells.push({ day, isWork });
  }

  return { cells, workCount };
}

/** Sun=0 ... Sat=6 weekday of a given date (matches Date#getDay), regardless of locale. */
export function sundayFirstWeekday(date: Date): number {
  return date.getDay();
}

/**
 * Builds a Sun-start month grid from real per-day records (work_schedule_days),
 * rather than a repeating weekly pattern.
 */
export function buildMonthGridFromDates(
  year: number,
  month: number, // 1-12
  workedDates: Set<string> // "YYYY-MM-DD"
): { cells: MonthCell[]; workCount: number; daysInMonth: number } {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = sundayFirstWeekday(new Date(year, month - 1, 1));
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells: MonthCell[] = [];
  let workCount = 0;

  for (let slot = 0; slot < totalCells; slot++) {
    const day = slot - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) {
      cells.push({ day: null, isWork: false });
      continue;
    }
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isWork = workedDates.has(iso);
    if (isWork) workCount += 1;
    cells.push({ day, isWork });
  }

  return { cells, workCount, daysInMonth };
}

export type MonthDistrictCell = {
  day: number | null;
  deliveryDistrictId: string | null;
  code: string | null;
  backgroundColor: string | null;
  worked: boolean;
};

// worked（実績の真偽値）はcode割り当ての有無から独立して保持する。
// 配達地区コード導入前の履歴データ（worked=trueだがdelivery_district_idがない）
// でも稼働日数の集計・表示が欠落しないようにするため。
export type MonthDistrictEntry = Omit<MonthDistrictCell, "day">;

/**
 * Sun-start month grid with a per-day delivery district assignment
 * (稼働カレンダーで日別に配達地区コードを選択するための版）。
 */
export function buildMonthGridFromDistrictMap(
  year: number,
  month: number, // 1-12
  entries: Map<string, MonthDistrictEntry> // "YYYY-MM-DD" -> その日の稼働実績・割当地区
): { cells: MonthDistrictCell[]; workCount: number; daysInMonth: number } {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = sundayFirstWeekday(new Date(year, month - 1, 1));
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells: MonthDistrictCell[] = [];
  let workCount = 0;

  for (let slot = 0; slot < totalCells; slot++) {
    const day = slot - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) {
      cells.push({ day: null, deliveryDistrictId: null, code: null, backgroundColor: null, worked: false });
      continue;
    }
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const entry = entries.get(iso);
    if (entry?.worked) workCount += 1;
    cells.push({
      day,
      deliveryDistrictId: entry?.deliveryDistrictId ?? null,
      code: entry?.code ?? null,
      backgroundColor: entry?.backgroundColor ?? null,
      worked: entry?.worked ?? false,
    });
  }

  return { cells, workCount, daysInMonth };
}
