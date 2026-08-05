import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "success" | "error";
export type ToastState = { message: string; tone: ToastTone } | null;

// アクション結果（成功/失敗）を一時的にトースト表示するための共通フック。
export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return { toast, showToast };
}
