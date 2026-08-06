import { useMemo, useRef, useState, type MouseEvent } from "react";
import ColorPaletteInput from "@/components/ColorPaletteInput";
import {
  buildEditRows,
  buildSampleData,
  expandForPreview,
  getCoveredSet,
  insertColumn,
  insertRow,
  isWholeRowSelection,
  mergeCells,
  normalizeSelection,
  removeColumn,
  removeRow,
  resolveStyle,
  setCellContent,
  setCellStyle,
  setColumnWidth,
  setRowHeight,
  toggleRepeatingRow,
  TOKEN_GROUPS,
  unmergeCell,
} from "@/lib/paymentNoticeTemplate";
import type {
  CellAlign,
  CellSelection,
  CellStyle,
  PaymentNoticeTemplate,
  RepeatingSource,
} from "@/types/domain/paymentNoticeTemplate";

type Props = { value: PaymentNoticeTemplate; onChange: (next: PaymentNoticeTemplate) => void };

type Mode = "edit" | "preview";
type BorderSide = "top" | "right" | "bottom" | "left";

const FONT_SIZES = [10, 11, 12, 14, 16, 18];

export default function PaymentNoticeTemplateEditor({ value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("edit");
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const covered = useMemo(() => getCoveredSet(value), [value]);
  const editRows = useMemo(() => buildEditRows(value), [value]);
  const sampleData = useMemo(() => buildSampleData(), []);
  const previewRows = useMemo(
    () => (mode === "preview" ? expandForPreview(value, sampleData) : []),
    [mode, value, sampleData]
  );

  const sel = selection ? normalizeSelection(selection) : null;
  const wholeRowSelected = isWholeRowSelection(sel, value.colCount);
  const selectedRepeatingSource: RepeatingSource | "" =
    wholeRowSelected && sel ? value.repeatingRows.find((r) => r.row === sel.r1)?.source ?? "" : "";
  const canRemoveRow = value.rowCount > 2;
  const canRemoveColumn = value.colCount > 2;
  const anchorStyle = sel ? resolveStyle(value.cells[`${sel.r1},${sel.c1}`]?.style) : resolveStyle(undefined);
  const editingRowSource = editingCell
    ? value.repeatingRows.find((r) => r.row === editingCell.row)?.source
    : undefined;
  const availableTokenGroups = TOKEN_GROUPS.filter(
    (g) => g.namespace === "header" || g.namespace === "summary" || g.namespace === editingRowSource
  );

  function isCellSelected(row: number, col: number): boolean {
    if (!sel) return false;
    return row >= sel.r1 && row <= sel.r2 && col >= sel.c1 && col <= sel.c2;
  }

  function selectedCellCoords(): { row: number; col: number }[] {
    if (!sel) return [];
    const coords: { row: number; col: number }[] = [];
    for (let r = sel.r1; r <= sel.r2; r++) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        if (!covered.has(`${r},${c}`)) coords.push({ row: r, col: c });
      }
    }
    return coords;
  }

  function handleCellClick(row: number, col: number, event: MouseEvent) {
    if (mode !== "edit") return;
    setError(null);
    setEditingCell(null);
    if (event.shiftKey && sel) {
      setSelection({ r1: sel.r1, c1: sel.c1, r2: row, c2: col });
    } else {
      setSelection({ r1: row, c1: col, r2: row, c2: col });
    }
  }

  function handleCellDoubleClick(row: number, col: number) {
    if (mode !== "edit") return;
    setSelection({ r1: row, c1: col, r2: row, c2: col });
    setEditingCell({ row, col });
  }

  function handleRulerClick(row: number) {
    if (mode !== "edit") return;
    setEditingCell(null);
    setSelection({ r1: row, c1: 0, r2: row, c2: value.colCount - 1 });
  }

  function applyStyle(updater: (style: CellStyle | undefined) => CellStyle) {
    const coords = selectedCellCoords();
    if (coords.length === 0) return;
    onChange(setCellStyle(value, coords, updater));
  }

  function handleBold() {
    const nextBold = !anchorStyle.bold;
    applyStyle((style) => ({ ...style, bold: nextBold }));
  }

  function handleAlign(align: CellAlign) {
    applyStyle((style) => ({ ...style, align }));
  }

  function handleBorderToggle(side: BorderSide) {
    const nextOn = !anchorStyle.borders[side];
    applyStyle((style) => {
      const borders = resolveStyle(style).borders;
      return { ...style, borders: { ...borders, [side]: nextOn } };
    });
  }

  function handleAllBorders(on: boolean) {
    applyStyle((style) => ({ ...style, borders: { top: on, right: on, bottom: on, left: on } }));
  }

  function handleBackground(hex: string) {
    applyStyle((style) => ({ ...style, background: hex }));
  }

  function handleFontSize(size: number) {
    applyStyle((style) => ({ ...style, fontSize: size }));
  }

  function handleMerge() {
    if (!sel) return;
    const result = mergeCells(value, sel);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange(result.template);
  }

  function handleUnmerge() {
    if (!sel) return;
    onChange(unmergeCell(value, sel.r1, sel.c1));
  }

  function handleInsertRow() {
    const at = sel ? sel.r2 + 1 : value.rowCount;
    setNotice(null);
    onChange(insertRow(value, at));
    setSelection(null);
  }

  function handleRemoveRow() {
    const row = sel ? sel.r1 : value.rowCount - 1;
    const result = removeRow(value, row);
    setNotice(result.notice ?? null);
    onChange(result.template);
    setSelection(null);
  }

  function handleInsertColumn() {
    const at = sel ? sel.c2 + 1 : value.colCount;
    setNotice(null);
    onChange(insertColumn(value, at));
    setSelection(null);
  }

  function handleRemoveColumn() {
    const col = sel ? sel.c1 : value.colCount - 1;
    const result = removeColumn(value, col);
    setNotice(result.notice ?? null);
    onChange(result.template);
    setSelection(null);
  }

  function handleColumnWidth(width: number) {
    if (!sel || Number.isNaN(width) || width <= 0) return;
    let next = value;
    for (let c = sel.c1; c <= sel.c2; c++) next = setColumnWidth(next, c, width);
    onChange(next);
  }

  function handleRowHeight(height: number) {
    if (!sel || Number.isNaN(height) || height <= 0) return;
    let next = value;
    for (let r = sel.r1; r <= sel.r2; r++) next = setRowHeight(next, r, height);
    onChange(next);
  }

  function handleRepeatingChange(source: RepeatingSource | "") {
    if (!sel) return;
    const result = toggleRepeatingRow(value, sel.r1, source === "" ? null : source);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange(result.template);
  }

  function handleContentChange(row: number, col: number, content: string) {
    onChange(setCellContent(value, row, col, content));
  }

  function handleInsertToken(tokenKey: string) {
    if (!editingCell || !textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const token = `{{${tokenKey}}}`;
    const nextValue = el.value.slice(0, start) + token + el.value.slice(end);
    handleContentChange(editingCell.row, editingCell.col, nextValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function cellBoxStyle(style: CellStyle | undefined) {
    const s = resolveStyle(style);
    return {
      background: s.background,
      fontWeight: s.bold ? 700 : 400,
      textAlign: s.align,
      verticalAlign: s.valign,
      fontSize: s.fontSize,
      borderTop: s.borders.top ? "1px solid var(--black)" : "none",
      borderRight: s.borders.right ? "1px solid var(--black)" : "none",
      borderBottom: s.borders.bottom ? "1px solid var(--black)" : "none",
      borderLeft: s.borders.left ? "1px solid var(--black)" : "none",
    } as const;
  }

  function spanWidth(col: number, colSpan: number): number {
    return value.columnWidths.slice(col, col + colSpan).reduce((a, b) => a + b, 0);
  }

  function spanHeight(row: number, rowSpan: number): number {
    return value.rowHeights.slice(row, row + rowSpan).reduce((a, b) => a + b, 0);
  }

  return (
    <div className="template-editor">
      <div className="role-toggle" style={{ maxWidth: 280 }}>
        <button
          type="button"
          className={`opt${mode === "edit" ? " is-active" : ""}`}
          onClick={() => {
            setMode("edit");
            setError(null);
          }}
        >
          編集
        </button>
        <button
          type="button"
          className={`opt${mode === "preview" ? " is-active" : ""}`}
          onClick={() => {
            setMode("preview");
            setEditingCell(null);
          }}
        >
          プレビュー
        </button>
      </div>

      {error && <p className="template-editor__error">{error}</p>}
      {notice && <p className="template-editor__notice">{notice}</p>}

      {mode === "edit" && (
        <div className="template-editor__toolbar">
          <div className="template-editor__toolbar-group">
            <span className="template-editor__toolbar-label">文字</span>
            <div className="template-editor__toolbar-row">
              <button
                type="button"
                className={`template-editor__btn${anchorStyle.bold ? " is-active" : ""}`}
                onClick={handleBold}
                disabled={!sel}
              >
                太字
              </button>
              <select
                value={anchorStyle.fontSize}
                onChange={(e) => handleFontSize(Number(e.target.value))}
                disabled={!sel}
                style={{ width: "auto" }}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="template-editor__toolbar-group">
            <span className="template-editor__toolbar-label">配置</span>
            <div className="template-editor__toolbar-row">
              {(["left", "center", "right"] as CellAlign[]).map((align) => (
                <button
                  key={align}
                  type="button"
                  className={`template-editor__btn${anchorStyle.align === align ? " is-active" : ""}`}
                  onClick={() => handleAlign(align)}
                  disabled={!sel}
                >
                  {align === "left" ? "左" : align === "center" ? "中" : "右"}
                </button>
              ))}
            </div>
          </div>

          <div className="template-editor__toolbar-group">
            <span className="template-editor__toolbar-label">罫線</span>
            <div className="template-editor__toolbar-row">
              {([
                ["top", "上"],
                ["right", "右"],
                ["bottom", "下"],
                ["left", "左"],
              ] as [BorderSide, string][]).map(([side, label]) => (
                <button
                  key={side}
                  type="button"
                  className={`template-editor__btn${anchorStyle.borders[side] ? " is-active" : ""}`}
                  onClick={() => handleBorderToggle(side)}
                  disabled={!sel}
                >
                  {label}
                </button>
              ))}
              <button type="button" className="template-editor__btn" onClick={() => handleAllBorders(true)} disabled={!sel}>
                全罫線
              </button>
              <button type="button" className="template-editor__btn" onClick={() => handleAllBorders(false)} disabled={!sel}>
                罫線なし
              </button>
            </div>
          </div>

          <div className="template-editor__toolbar-group">
            <span className="template-editor__toolbar-label">背景色</span>
            <ColorPaletteInput value={anchorStyle.background} onChange={handleBackground} />
          </div>

          <div className="template-editor__toolbar-group">
            <span className="template-editor__toolbar-label">セル結合</span>
            <div className="template-editor__toolbar-row">
              <button type="button" className="template-editor__btn" onClick={handleMerge} disabled={!sel}>
                結合
              </button>
              <button type="button" className="template-editor__btn" onClick={handleUnmerge} disabled={!sel}>
                結合解除
              </button>
            </div>
          </div>

          <div className="template-editor__toolbar-group">
            <span className="template-editor__toolbar-label">行</span>
            <div className="template-editor__toolbar-row">
              <button type="button" className="template-editor__btn" onClick={handleInsertRow}>
                +行
              </button>
              <button type="button" className="template-editor__btn" onClick={handleRemoveRow} disabled={!canRemoveRow}>
                −行
              </button>
              <input
                type="number"
                min={16}
                style={{ width: 56 }}
                value={sel ? value.rowHeights[sel.r1] : ""}
                placeholder="行高"
                onChange={(e) => handleRowHeight(Number(e.target.value))}
                disabled={!sel}
              />
            </div>
          </div>

          <div className="template-editor__toolbar-group">
            <span className="template-editor__toolbar-label">列</span>
            <div className="template-editor__toolbar-row">
              <button type="button" className="template-editor__btn" onClick={handleInsertColumn}>
                +列
              </button>
              <button
                type="button"
                className="template-editor__btn"
                onClick={handleRemoveColumn}
                disabled={!canRemoveColumn}
              >
                −列
              </button>
              <input
                type="number"
                min={20}
                style={{ width: 56 }}
                value={sel ? value.columnWidths[sel.c1] : ""}
                placeholder="列幅"
                onChange={(e) => handleColumnWidth(Number(e.target.value))}
                disabled={!sel}
              />
            </div>
          </div>

          <div className="template-editor__toolbar-group">
            <span className="template-editor__toolbar-label">繰り返し行</span>
            <select
              value={selectedRepeatingSource}
              onChange={(e) => handleRepeatingChange(e.target.value as RepeatingSource | "")}
              disabled={!wholeRowSelected}
              style={{ width: "auto" }}
            >
              <option value="">なし</option>
              <option value="daily">日別</option>
              <option value="items">項目別</option>
            </select>
          </div>

          <div className="template-editor__toolbar-group">
            <span className="template-editor__toolbar-label">プレースホルダー挿入</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) handleInsertToken(e.target.value);
              }}
              disabled={!editingCell}
              style={{ width: "auto" }}
            >
              <option value="">選択してください</option>
              {availableTokenGroups.map((group) => (
                <optgroup key={group.namespace} label={group.label}>
                  {group.tokens.map((token) => (
                    <option key={token.key} value={token.key}>
                      {token.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      )}

      {mode === "edit" ? (
        <div className="template-editor__canvas">
          <table className="template-editor__table">
            <tbody>
              {editRows.map((rowCells, row) => (
                <tr key={row}>
                  <td className="template-editor__ruler-cell">
                    <button
                      type="button"
                      className={`template-editor__ruler-btn${sel && sel.r1 <= row && row <= sel.r2 ? " is-active" : ""}`}
                      onClick={() => handleRulerClick(row)}
                    >
                      {row + 1}
                    </button>
                  </td>
                  {rowCells.map((cell) => {
                    const isRepeatingRow = value.repeatingRows.some((r) => r.row === cell.row);
                    const isEditingThis = editingCell?.row === cell.row && editingCell?.col === cell.col;
                    return (
                      <td
                        key={cell.col}
                        rowSpan={cell.rowSpan}
                        colSpan={cell.colSpan}
                        className="template-editor__td"
                        style={{ width: spanWidth(cell.col, cell.colSpan), height: spanHeight(cell.row, cell.rowSpan) }}
                      >
                        {isEditingThis ? (
                          <textarea
                            ref={textareaRef}
                            className="template-editor__cell-input"
                            autoFocus
                            value={cell.content}
                            onChange={(e) => handleContentChange(cell.row, cell.col, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                          />
                        ) : (
                          <div
                            className={`template-editor__cell${isCellSelected(cell.row, cell.col) ? " is-selected" : ""}${isRepeatingRow ? " is-repeating" : ""}`}
                            style={cellBoxStyle(cell.style)}
                            onClick={(e) => handleCellClick(cell.row, cell.col, e)}
                            onDoubleClick={() => handleCellDoubleClick(cell.row, cell.col)}
                          >
                            {cell.content || " "}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="template-editor__canvas">
          <p className="hint" style={{ marginBottom: 10 }}>
            サンプルデータで表示しています。実データとの連携は今後対応予定です。
          </p>
          <table className="template-editor__preview-table">
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.col}
                      rowSpan={cell.rowSpan}
                      colSpan={cell.colSpan}
                      className="template-editor__td"
                      style={{ width: spanWidth(cell.col, cell.colSpan) }}
                    >
                      <div className="template-editor__cell" style={{ ...cellBoxStyle(cell.style), cursor: "default" }}>
                        {cell.content || " "}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
