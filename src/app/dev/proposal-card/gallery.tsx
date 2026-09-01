'use client';

import { ProposalCard, ProposalUndoStrip, type ProposalRisk } from '@kayamo/ui';
import { useState } from 'react';
import styles from './gallery.module.css';

type DemoId = 'low' | 'medium' | 'high' | 'blocks';

const DEMOS: Record<
  DemoId,
  {
    risk: ProposalRisk;
    action: string;
    title: string;
    why: string;
    touches: readonly string[];
    foot: string;
    diff?: { before: string; after: string };
    blocks?: ReadonlyArray<{ time: string; title: string; why: string }>;
    undo: string;
  }
> = {
  low: {
    risk: 'low',
    action: 'merge aliases',
    title: 'Fold “sinaing” into Kanin as an alias',
    why: 'The standalone row has no entries logged against it, so nothing in your history changes.',
    diff: {
      before: '2 rows · sinaing, Kanin (white rice, cooked)',
      after: '1 row · Kanin — alias: sinaing',
    },
    touches: ['Foods'],
    foot: 'Low risk, so this applies straight away with an undo for the rest of the day.',
    undo: 'Folded sinaing into Kanin.',
  },
  medium: {
    risk: 'medium',
    action: 'edit ph_core row',
    title: 'Sinigang na baboy — fat 6.5 → 5.8 g',
    why: 'Brings 4/4/9 inside 1% and matches the 30 g cooked pork in your own source note. Confidence stays 0.50 until you verify it yourself.',
    diff: {
      before: 'P 8.0 / C 3.5 / F 6.5 → 104.5 kcal · off 8.4%',
      after: 'P 8.0 / C 3.5 / F 5.8 → 98.2 kcal · off 0.9%',
    },
    touches: ['Verify', 'Foods'],
    foot: 'Verifying is still your action. This only fixes the arithmetic you flagged.',
    undo: 'Reverted the sinigang fat figure.',
  },
  high: {
    risk: 'high',
    action: 'set nutrition target',
    title: 'Raise the daily target 2,450 → 2,520 kcal',
    why: 'Eight-week trend is −1.2 kg, faster than the 0.5 kg/month you asked for. This is a suggestion from your own numbers, not a medical recommendation.',
    diff: {
      before: 'target 2,450 kcal/day · set 12 Jul',
      after: 'target 2,520 kcal/day · from tomorrow',
    },
    touches: ['Today', 'Goals'],
    foot: 'Past days keep the target they were logged against. Nothing is rewritten.',
    undo: 'Kept the 2,450 kcal target.',
  },
  blocks: {
    risk: 'medium',
    action: 'replan from now',
    title: 'Four blocks for the rest of today',
    why: 'Nothing before 15:30 moves. Gym stays where you fixed it.',
    touches: ['Todos', 'Gym'],
    blocks: [
      { time: '15:30', title: 'Paper — second block', why: 'due tomorrow, no block yet today' },
      { time: '17:15', title: 'Travel to gym', why: '20 min, from your usual' },
      { time: '18:00', title: 'Gym · Push A', why: 'you fixed this — not moved' },
      { time: '19:30', title: 'Dinner', why: 'wall you set' },
    ],
    foot: 'Verify rows stay unscheduled — leftover minutes after dinner are yours.',
    undo: 'Restored the previous plan.',
  },
};

export function ProposalCardGallery() {
  const [applied, setApplied] = useState<Partial<Record<DemoId, boolean>>>({});
  const [dismissed, setDismissed] = useState<Partial<Record<DemoId, boolean>>>({});

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Dev only · delete after mutations use the card</p>
        <h1>Proposal card</h1>
        <p>
          Three risk tiers, one component. Low applies with undo. Medium needs Confirm. High
          needs the word <span className={styles.mono}>apply</span>. Nothing here writes.
        </p>
      </header>
      <div className={styles.grid}>
        {(Object.keys(DEMOS) as DemoId[]).map((id) => {
          const demo = DEMOS[id];
          return (
            <section key={id} className={styles.col} data-demo={id}>
              {dismissed[id] ? (
                <p className={styles.idle}>Dismissed.</p>
              ) : applied[id] ? (
                <ProposalUndoStrip
                  text={demo.undo}
                  onUndo={() => setApplied((current) => ({ ...current, [id]: false }))}
                />
              ) : (
                <ProposalCard
                  key={id}
                  risk={demo.risk}
                  action={demo.action}
                  title={demo.title}
                  why={demo.why}
                  touches={demo.touches}
                  foot={demo.foot}
                  diff={demo.diff}
                  blocks={demo.blocks}
                  onApply={() => setApplied((current) => ({ ...current, [id]: true }))}
                  onEdit={() => undefined}
                  onDismiss={() => setDismissed((current) => ({ ...current, [id]: true }))}
                />
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
