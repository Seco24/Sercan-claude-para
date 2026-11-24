import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Verilirse içerik bir <form> olarak sarılır ve Enter ile gönderilir */
  onSubmit?: () => void;
  footer?: ReactNode;
  size?: 'sm' | 'md';
}

/**
 * Yerel <dialog> tabanlı pencere: odak tuzağı ve Esc ile kapanma tarayıcıdan gelir.
 * Mobilde alttan açılan sayfa (bottom sheet), masaüstünde ortada pencere olarak görünür.
 */
export function Modal({ open, title, onClose, children, onSubmit, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!open) return null;

  const body = (
    <>
      <header className="modal__head">
        <h2 className="modal__title">{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Kapat">
          <Icon name="close" />
        </button>
      </header>
      <div className="modal__body">{children}</div>
      {footer && <footer className="modal__foot">{footer}</footer>}
    </>
  );

  return (
    <dialog
      ref={ref}
      className={`modal modal--${size}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // arka plana tıklama
      }}
    >
      {onSubmit ? (
        <form
          className="modal__inner"
          noValidate
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {body}
        </form>
      ) : (
        <div className="modal__inner">{body}</div>
      )}
    </dialog>
  );
}
