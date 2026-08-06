// 稼働カレンダー等で日別の担当地区を識別しやすい色を優先しつつ、自由選択できる余地も残す。
const COLOR_PALETTE = [
  "#ffffff",
  "#d1d5db",
  "#808080",
  "#fca5a5",
  "#f5aa5f",
  "#fcd34d",
  "#86efac",
  "#67e8f9",
  "#93c5fd",
  "#c4b5fd",
  "#e493f5",
  "#f9a8d4",
];

export default function ColorPaletteInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="color-palette">
      {COLOR_PALETTE.map((hex) => (
        <button
          type="button"
          key={hex}
          className={`color-palette__swatch${value.toLowerCase() === hex ? " is-selected" : ""}`}
          style={{ background: hex }}
          aria-label={hex}
          onClick={() => onChange(hex)}
        />
      ))}
      <input
        type="color"
        className="color-palette__custom"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="その他の色を選択"
      />
    </div>
  );
}
