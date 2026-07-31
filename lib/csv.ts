import Papa from "papaparse";

// CSV仕様（REQUIREMENT.md §7.1・8章）：UTF-8・カンマ区切り・日本語ヘッダー。
// エクスポートは全画面共通、インポートはマスタ管理のみで使用する。

export type CsvColumn<T> = {
  key: keyof T;
  header: string;
};

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[]
): string {
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((col) => [col.header, row[col.key] ?? ""]))
  );
  return Papa.unparse(data, {
    columns: columns.map((col) => col.header),
  });
}

// ExcelでのSJIS誤認識を避けるため、UTF-8 BOMを付与してダウンロードする。
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseCsv<T extends Record<string, unknown>>(
  file: File,
  columns: CsvColumn<T>[]
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headerToKey = new Map(columns.map((col) => [col.header, col.key]));
        const rows = result.data.map((raw) => {
          const row = {} as T;
          for (const [header, value] of Object.entries(raw)) {
            const key = headerToKey.get(header);
            if (key) row[key] = value as T[keyof T];
          }
          return row;
        });
        resolve(rows);
      },
      error: (error: Error) => reject(error),
    });
  });
}
