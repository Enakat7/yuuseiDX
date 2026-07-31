import { useEffect, useRef } from "react";

const SEQUENCE_TIMEOUT_MS = 1500;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

// Space+c → Space+s → Space+v の順次押下でCSVインポートモーダルを開くショートカット。
// SpaceはKeyboardEventのshiftKey等と違い修飾フラグを持たないため、押下状態を
// keydown/keyupで自前追跡し、各文字キー押下時に「Spaceが押されているか」を判定する。
// 入力欄にフォーカス中は編集中の誤爆を避けるため無効化する。
export function useCsvImportShortcut(onTrigger: () => void, enabled = true) {
  const stepRef = useRef(0);
  const lastTimeRef = useRef(0);
  const spaceDownRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target) || event.repeat) return;

      if (event.code === "Space") {
        spaceDownRef.current = true;
        return;
      }

      const now = Date.now();
      if (now - lastTimeRef.current > SEQUENCE_TIMEOUT_MS) {
        stepRef.current = 0;
      }

      const key = event.key.toLowerCase();
      const step = stepRef.current;
      const withSpace = spaceDownRef.current;

      if (step === 0 && withSpace && key === "c") {
        stepRef.current = 1;
        lastTimeRef.current = now;
      } else if (step === 1 && withSpace && key === "s") {
        stepRef.current = 2;
        lastTimeRef.current = now;
      } else if (step === 2 && withSpace && key === "v") {
        stepRef.current = 0;
        event.preventDefault();
        onTrigger();
      } else {
        stepRef.current = 0;
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        spaceDownRef.current = false;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, onTrigger]);
}
