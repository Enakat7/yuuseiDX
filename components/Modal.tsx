import { useEffect, type MouseEvent, type ReactNode } from "react";

type ModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  headerAction?: ReactNode;
};

export default function Modal({ title, subtitle, onClose, children, wide, headerAction }: ModalProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const stopPropagation = (event: MouseEvent) => event.stopPropagation();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={wide ? "modal-box modal-box--wide" : "modal-box"} onClick={stopPropagation}>
        <div className="modal-box__head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <div className="flex" style={{ alignItems: "center", gap: 12 }}>
            {headerAction}
            <button type="button" className="modal-box__close" aria-label="閉じる" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="modal-box__body">{children}</div>
      </div>
    </div>
  );
}
