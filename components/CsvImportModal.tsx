import { useState } from "react";
import Modal from "@/components/Modal";

type CsvImportModalProps = {
  title?: string;
  description?: string;
  onImport: (file: File) => Promise<number>;
  onClose: () => void;
};

// Shift+C→s→vのショートカットから開くCSVインポート用モーダル。ボタンは設けず
// ショートカットのみで起動する運用のため、各ページはこのコンポーネントをそのまま流用する。
export default function CsvImportModal({ title = "CSVインポート", description, onImport, onClose }: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const count = await onImport(file);
      setResult(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り込みに失敗しました。");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title={title} subtitle={description} onClose={onClose}>
      {result !== null ? (
        <p className="text-sm">{result}件取り込みました。</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="csv-import-file">CSVファイル</label>
            <input
              id="csv-import-file"
              type="file"
              accept=".csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {error && (
            <p className="text-sm" style={{ color: "var(--black)" }}>
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={handleImport}
            disabled={!file || importing}
          >
            {importing ? "取り込み中..." : "取り込む"}
          </button>
        </>
      )}
    </Modal>
  );
}
