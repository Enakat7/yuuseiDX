import type { ToastState } from "@/lib/useToast";

export default function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      <span>{toast.message}</span>
      <button type="button" className="toast__close" aria-label="閉じる" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
