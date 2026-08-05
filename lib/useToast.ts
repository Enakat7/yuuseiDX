import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "success" | "error";
export type ToastState = { message: string; tone: ToastTone } | null;

// アクション結果（成功/失敗）を一時的にトースト表示するための共通フック。
// ユーザーが[×]で閉じるか、durationMs経過で自動的に閉じる。
export function useToast(durationMs = 30000) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, tone });
      timerRef.current = setTimeout(() => setToast(null), durationMs);
    },
    [durationMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast, hideToast };
}
