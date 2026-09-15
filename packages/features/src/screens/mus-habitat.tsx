'use client';

import { Tree } from '@phosphor-icons/react';
import { stageLabel } from './copy';
import styles from './kayamo-app.module.css';

export function MusHabitat({ progress, onGrove }: { progress: { totalPoints: number; stageKey: string }; onGrove: () => void }) {
  const threshold = progress.totalPoints < 100 ? 100 : progress.totalPoints < 300 ? 300 : progress.totalPoints < 700 ? 700 : 1500;
  const percent = Math.min(100, Math.max(4, progress.totalPoints / threshold * 100));
  return (
    <section className={styles.habitat} aria-label={`Lis is at the ${stageLabel(progress.stageKey)} stage with ${progress.totalPoints} growth points`}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <img className={styles.cocoImage} src="/coco-seed.webp" alt="Lis, a hopeful seed companion with a gentle expression" width={196} height={196} />
      <button className={styles.stageProgress} type="button" onClick={onGrove}>
        <Tree size={16} weight="fill" />
        <span>{stageLabel(progress.stageKey)}</span>
        <i aria-hidden="true"><b style={{ width: `${percent}%` }} /></i>
      </button>
    </section>
  );
}
