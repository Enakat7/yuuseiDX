export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

export function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 月曜始まりの週の開始日・終了日（ISO文字列）を返す
export function getWeekRange(date: Date): { start: string; end: string } {
  const day = date.getDay(); // 0=日 ... 6=土
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(date, mondayOffset);
  const end = addDays(start, 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

// 月初・月末（ISO文字列）を返す
export function getMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

const DOW_LABELS_JA = ["日", "月", "火", "水", "木", "金", "土"];

// 月初日を指定した月数だけずらす（日は常に1日に正規化する。稼働表の月送り用）
export function addMonths(monthAnchor: Date, delta: number): Date {
  return new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + delta, 1);
}

// 月内の全日分（ISO文字列と表示ラベル "M/D(曜)"）を返す（稼働表の月表示用）
export function getMonthDates(monthAnchor: Date): { iso: string; label: string }[] {
  const daysInMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), i + 1);
    return { iso: toIsoDate(d), label: `${d.getMonth() + 1}/${d.getDate()}(${DOW_LABELS_JA[d.getDay()]})` };
  });
}
