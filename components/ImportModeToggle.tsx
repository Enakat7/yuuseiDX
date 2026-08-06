export type ImportMode = "append" | "overwrite";

// CSVインポート時の「追加」「上書き保存」切り替え。各マスタ管理画面で共通利用する。
export default function ImportModeToggle({
  mode,
  onChange,
}: {
  mode: ImportMode;
  onChange: (mode: ImportMode) => void;
}) {
  return (
    <div className="flex" style={{ gap: 12, alignItems: "center" }}>
      <label className="text-sm flex" style={{ gap: 4, alignItems: "center" }}>
        <input type="radio" name="import-mode" checked={mode === "append"} onChange={() => onChange("append")} />
        追加
      </label>
      <label className="text-sm flex" style={{ gap: 4, alignItems: "center" }}>
        <input
          type="radio"
          name="import-mode"
          checked={mode === "overwrite"}
          onChange={() => onChange("overwrite")}
        />
        上書き保存
      </label>
    </div>
  );
}
