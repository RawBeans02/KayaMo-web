'use client';

import { useEffect, useRef } from 'react';
import styles from '../food/desk.module.css';
import { useGymSession } from './gym-session-provider';

export function GymRestBar() {
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

  return (
    <div
      className={styles.restBar}
      data-gym-rest=""
      data-urgent={session.urgent ? 'true' : undefined}
      data-done={done ? 'true' : undefined}
      role="status"
      aria-live="polite"
    >
      <p className={styles.restBarLabel}>{done ? 'Rest done' : 'Rest'}</p>
      <p className={styles.restBarClock} data-gym-rest-clock="">
        {session.restLabel}
      </p>
      <p className={styles.restBarNote}>
        {session.elapsedLabel ? `${session.elapsedLabel} · ` : ''}
        Timer keeps running if you leave Gym.
      </p>
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
    </div>
  );
}
