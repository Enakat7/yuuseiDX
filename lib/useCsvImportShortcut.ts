import { useEffect, useRef } from "react";

const SEQUENCE_TIMEOUT_MS = 1500;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

// Shift+Ctrl+C → s → v の順次押下でCSVインポートモーダルを開くショートカット。
// 入力欄にフォーカス中は編集中の誤爆を避けるため無効化する。
export function useCsvImportShortcut(onTrigger: () => void, enabled = true) {
  const stepRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const now = Date.now();
      if (now - lastTimeRef.current > SEQUENCE_TIMEOUT_MS) {
        stepRef.current = 0;
      }

      const key = event.key.toLowerCase();
      const step = stepRef.current;

      if (step === 0 && event.shiftKey && event.ctrlKey && key === "c") {
        stepRef.current = 1;
        lastTimeRef.current = now;
      } else if (step === 1 && !event.shiftKey && !event.ctrlKey && key === "s") {
        stepRef.current = 2;
        lastTimeRef.current = now;
      } else if (step === 2 && !event.shiftKey && !event.ctrlKey && key === "v") {
        stepRef.current = 0;
        event.preventDefault();
        onTrigger();
      } else {
        stepRef.current = 0;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onTrigger]);
}
