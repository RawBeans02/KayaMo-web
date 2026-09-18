'use client';

import { useEffect, useRef } from 'react';
import styles from './desk.module.css';
import { useGymSession } from './gym-session-provider';

export function GymRestBar({
  variant = 'shell',
  restFrom,
}: {
  variant?: 'shell' | 'page';
  restFrom?: string;
}) {
  const session = useGymSession();
  const pinged = useRef(false);

  useEffect(() => {
    pinged.current = false;
  }, [session.timer?.ends_at]);

  useEffect(() => {
    if (!session.timer || session.remainingSeconds > 0 || pinged.current) return;
    pinged.current = true;
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
      // Visual ping is enough if audio is blocked.
    }
  }, [session.remainingSeconds, session.timer]);

  if (!session.timer || !session.workout) return null;

  const done = session.remainingSeconds === 0;
  const from = restFrom?.trim() || 'set';

  return (
    <div
      className={styles.restBar}
      data-gym-rest=""
      data-embed={variant === 'page' ? '' : undefined}
      data-urgent={session.urgent ? 'true' : undefined}
      data-done={done ? 'true' : undefined}
      role="status"
      aria-live="polite"
    >
      <p className={styles.restBarLabel}>{done ? 'Rest done' : `Rest · ${from}`}</p>
      <p className={styles.restBarClock} data-gym-rest-clock="">
        {session.restLabel}
      </p>
      <span className={styles.restTrack} aria-hidden="true">
        <span style={{ width: `${done ? 100 : session.restPct}%` }} />
      </span>
      <div className={styles.restBarActions}>
        <button type="button" onClick={() => void session.extend(-30)}>
          −30s
        </button>
        <button type="button" onClick={() => void session.extend(30)}>
          +30s
        </button>
        <button type="button" onClick={() => void session.skip()}>
          Skip rest
        </button>
      </div>
      {variant === 'shell' ? (
        <p className={styles.restBarNote}>Timer keeps running if you leave Gym.</p>
      ) : null}
    </div>
  );
}
