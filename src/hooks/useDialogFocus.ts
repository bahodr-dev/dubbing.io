import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface DialogFocusOptions {
  isOpen: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  canClose?: boolean;
}

/** Keep keyboard navigation in an open dialog and restore its launch point. */
export function useDialogFocus(options: DialogFocusOptions) {
  const { isOpen, dialogRef, initialFocusRef, returnFocusRef } = options;
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const returnTarget = returnFocusRef?.current || previousFocus;
    const previousOverflow = document.body.style.overflow;
    const inactive: Array<{ element: HTMLElement; inert: boolean }> = [];
    let branch: HTMLElement = dialog;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement && !sibling.hasAttribute('data-dialog-backdrop')) {
          inactive.push({ element: sibling, inert: sibling.hasAttribute('inert') });
          sibling.setAttribute('inert', '');
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    document.body.style.overflow = 'hidden';

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
    )).filter(element => !element.closest('[hidden], [inert], [aria-hidden="true"]'));
    (initialFocusRef?.current || focusable()[0] || dialog).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (latest.current.canClose !== false) latest.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      inactive.forEach(({ element, inert }) => { if (!inert) element.removeAttribute('inert'); });
      document.body.style.overflow = previousOverflow;
      if (returnTarget?.isConnected) returnTarget.focus();
      else document.querySelector<HTMLElement>('[data-dialog-return-focus]')?.focus();
    };
  }, [isOpen, dialogRef, initialFocusRef, returnFocusRef]);
}
