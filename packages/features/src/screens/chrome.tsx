'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { SyncStatusBar } from '../sync/sync-status-bar';
import styles from './kayamo-app.module.css';

export function CompanionButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.companionButton} type="button" onClick={onClick} aria-label="Talk to Lis">
      <img src="/coco-seed.webp" alt="" width={44} height={44} />
    </button>
  );
}

export function AppScreenHeader({
  title,
  subtitle,
  onChat,
  onBack,
}: {
  title: string;
  subtitle: string;
  onChat: () => void;
  onBack?: () => void;
}) {
  return (
    <header className={styles.appScreenHeader}>
      <div>
        {onBack ? (
          <button type="button" className={styles.textLink} onClick={onBack}>
            Life areas
          </button>
        ) : null}
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <SyncStatusBar className={styles.syncChip} />
      </div>
      <CompanionButton onClick={onChat} />
    </header>
  );
}

export function EmptyLine({ text }: { text: string }) {
  return <p className={styles.emptyLine}>{text}</p>;
}

export function ActionDialog({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby={titleId}>
      <div className={styles.dialogHandle} aria-hidden="true" />
      <div className={styles.dialogTop}>
        <div>
          <p className={styles.eyebrow}>Your choice</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {description ? <p className={styles.dialogDescription}>{description}</p> : null}
      {children}
    </dialog>
  );
}
