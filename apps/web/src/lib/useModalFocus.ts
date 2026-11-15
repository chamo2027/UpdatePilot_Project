'use client';

import { useEffect, useRef } from 'react';

export function useModalFocus(onDismiss: () => void, canDismiss = true) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  const enabled = useRef(canDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
    enabled.current = canDismiss;
  }, [onDismiss, canDismiss]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    dialog.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && enabled.current) {
        event.preventDefault();
        dismiss.current();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      )).filter(element => element.getClientRects().length > 0);
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (index === -1 || (event.shiftKey ? index === 0 : index === controls.length - 1)) {
        event.preventDefault();
        const next = event.shiftKey ? controls.at(-1) : controls[0];
        (next || dialog).focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return ref;
}
