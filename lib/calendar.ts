export type MonthCell = {
  day: number | null;
  isWork: boolean;
};

export const DOW_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

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

/** Mon=0 ... Sun=6 weekday of a given date, regardless of locale. */
export function mondayFirstWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Builds a Mon-start month grid from real per-day records (work_schedule_days),
 * rather than a repeating weekly pattern.
 */
export function buildMonthGridFromDates(
  year: number,
  month: number, // 1-12
  workedDates: Set<string> // "YYYY-MM-DD"
): { cells: MonthCell[]; workCount: number; daysInMonth: number } {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = mondayFirstWeekday(new Date(year, month - 1, 1));
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
