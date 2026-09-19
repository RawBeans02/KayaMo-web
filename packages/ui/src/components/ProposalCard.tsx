'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  HIGH_RISK_CONFIRM_WORD,
  proposalApplyEnabled,
  proposalApplyLabel,
  proposalRiskLabel,
  type ProposalBlock,
  type ProposalDiff,
  type ProposalRisk,
} from '../proposal';
import { cx } from '../cx';
import styles from './proposal-card.module.css';

export type ProposalCardProps = {
  risk: ProposalRisk;
  action: string;
  title: string;
  why: string;
  touches: readonly string[];
  foot: string;
  diff?: ProposalDiff;
  blocks?: readonly ProposalBlock[];
  applyLabel?: string;
  confirmWord?: string;
  onConfirmWordChange?: (value: string) => void;
  onApply: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  className?: string;
};

export function ProposalCard({
  risk,
  action,
  title,
  why,
  touches,
  foot,
  diff,
  blocks,
  applyLabel,
  confirmWord,
  onConfirmWordChange,
  onApply,
  onEdit,
  onDismiss,
  className,
}: ProposalCardProps) {
  const inputId = useId();
  const [typed, setTyped] = useState(confirmWord ?? '');
  const value = confirmWord ?? typed;
  const canApply = proposalApplyEnabled(risk, value);
  const label = applyLabel ?? proposalApplyLabel(risk);

  function setWord(next: string) {
    if (confirmWord === undefined) setTyped(next);
    onConfirmWordChange?.(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canApply) return;
    onApply();
  }

  return (
    <article
      className={cx(styles.card, className)}
      data-risk={risk}
      aria-label={`${proposalRiskLabel(risk)}: ${title}`}
    >
      <header className={styles.head}>
        <span className={styles.risk}>{proposalRiskLabel(risk)}</span>
        <span className={styles.action}>{action}</span>
      </header>
      <form className={styles.body} onSubmit={submit}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.why}>{why}</p>

        {diff ? (
          <div className={styles.diff}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>now</span>
              <span className={styles.rowValue}>{diff.before}</span>
            </div>
            <div className={cx(styles.row, styles.rowAfter)}>
              <span className={styles.rowLabel}>after</span>
              <span className={styles.rowValue}>{diff.after}</span>
            </div>
          </div>
        ) : null}

        {blocks && blocks.length > 0 ? (
          <ol className={styles.blocks}>
            {blocks.map((block) => (
              <li key={`${block.time}-${block.title}`} className={styles.block}>
                <span className={styles.blockTime}>{block.time}</span>
                <span>
                  <span className={styles.blockTitle}>{block.title}</span>
                  <span className={styles.blockWhy}>{block.why}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className={styles.touches}>
          <span className={styles.touchesLabel}>touches</span>
          {touches.map((screen) => (
            <span key={screen} className={styles.chip}>
              {screen}
            </span>
          ))}
        </div>

        {risk === 'high' ? (
          <div className={styles.confirm}>
            <label className={styles.confirmLabel} htmlFor={inputId}>
              This one changes a target, so it needs the word. Type{' '}
              <span className={styles.confirmWord}>{HIGH_RISK_CONFIRM_WORD}</span>.
            </label>
            <input
              id={inputId}
              className={styles.confirmInput}
              value={value}
              onChange={(event) => setWord(event.target.value)}
              placeholder={HIGH_RISK_CONFIRM_WORD}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}

        <div className={styles.actions}>
          <button type="submit" className={styles.apply} disabled={!canApply}>
            {label}
          </button>
          <button type="button" className={styles.ghost} onClick={onEdit}>
            Edit
          </button>
          <button type="button" className={cx(styles.ghost, styles.dismiss)} onClick={onDismiss}>
            Dismiss
          </button>
        </div>
        <p className={styles.foot}>{foot}</p>
      </form>
    </article>
  );
}

export type ProposalUndoStripProps = {
  text: string;
  onUndo: () => void;
  className?: string;
};

export function ProposalUndoStrip({ text, onUndo, className }: ProposalUndoStripProps) {
  return (
    <div className={cx(styles.undo, className)} role="status">
      <span className={styles.mark} aria-hidden="true">
        ✓
      </span>
      <span className={styles.undoText}>{text}</span>
      <button type="button" className={styles.undoButton} onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
