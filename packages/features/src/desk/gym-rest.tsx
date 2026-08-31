'use client';

import { useEffect, useState } from 'react';
import {
  clearLocalRestTimer,
  extendLocalRestTimer,
  type LocalRestTimer,
} from '@kayamo/offline';
import styles from '../food/desk.module.css';

function remainingSeconds(timer: LocalRestTimer, nowMs: number): number {
  return Math.max(0, Math.round((Date.parse(timer.ends_at) - nowMs) / 1000));
}

function formatRemain(total: number): string {
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function GymRestOverlay({
  timer,
  onChange,
}: {
  timer: LocalRestTimer;
  onChange: () => Promise<void>;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pinged, setPinged] = useState(false);
  const left = remainingSeconds(timer, nowMs);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer.ends_at]);

  useEffect(() => {
    if (left > 0 || pinged) return;
    setPinged(true);
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // In-app visual ping is enough if audio is blocked.
    }
  }, [left, pinged]);

  return (
    <div className={styles.restOverlay} role="status" aria-live="polite">
      <p className={styles.statLabel}>{left === 0 ? 'Rest done' : 'Rest'}</p>
      <p className={styles.dashMetric}>{formatRemain(left)}</p>
      <p className={styles.statNote}>
        Timer stays up if you start another lift. It does not check the next set for you.
      </p>
      <div className={styles.formRow}>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => void extendLocalRestTimer(timer.workout_id, -30).then(onChange)}
        >
          −30s
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => void extendLocalRestTimer(timer.workout_id, 30).then(onChange)}
        >
          +30s
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => void clearLocalRestTimer(timer.workout_id).then(onChange)}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
