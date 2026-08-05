import type { ToastState } from "@/lib/useToast";

export default function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      {toast.message}
    </div>
  );
}
