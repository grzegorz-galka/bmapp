import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Modal.module.css';

/**
 * A modal native dialog, open for as long as it is rendered.
 *
 * `showModal()` puts it in the browser's top layer, above the sticky header
 * and anything else on the page, without a z-index to keep in step. Escape
 * closes it through the same path as a cancel button. Focus goes back to
 * whatever had it before, so a keyboard user lands where they left off.
 */
export function Modal({
  labelledBy,
  onClose,
  wide = false,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  /** Wider, for content such as a chart rather than a form. */
  wide?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    if (element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={wide ? `${styles.dialog} ${styles.wide}` : styles.dialog}
      aria-labelledby={labelledBy}
      // Escape is handled here rather than left to the browser's cancel
      // event, so it closes through the caller in every environment; the
      // prevented keydown keeps the browser from also firing cancel.
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
