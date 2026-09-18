'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx';
import { useWebSheetMotion } from '../use-web-sheet-motion';

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Sheet({ open, onClose, title, children, footer, className }: SheetProps) {
  const { ref, visible } = useWebSheetMotion(open);
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [visible, onClose]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kayamo-sheet-title"
        data-kayamo-sheet=""
        ref={ref}
        className={cx(className)}
      >
        <div className="flex flex-col">
          <div className="flex justify-center pt-3 pb-2" aria-hidden="true">
            <span className="h-1 w-10 rounded-sm bg-accent" />
          </div>
          <header className="px-4 pb-3">
            <h2 id="kayamo-sheet-title" className="font-body text-title text-text">
              {title}
            </h2>
          </header>
          <div className="overflow-y-auto px-4 pb-4">{children}</div>
          {footer ? (
            <div className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
