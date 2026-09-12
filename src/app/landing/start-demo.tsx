'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './landing.module.css';

/**
 * Starts the no-account demo: issues a guest cookie, then lands the visitor on
 * Home, without replacing an existing guest identity or its saved records.
 */
export function StartDemo({
  children,
  variant = 'primary',
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch('/api/demo', { method: 'POST' });
      if (!response.ok) throw new Error('demo');
      router.push('/today');
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <span className={styles.ctaWrap}>
      <button
        type="button"
        className={variant === 'primary' ? styles.ctaPrimary : styles.ctaGhost}
        onClick={() => void start()}
        disabled={busy}
      >
        {busy ? 'Opening the demo…' : children}
      </button>
      {failed ? (
        <span role="alert" className={styles.ctaError}>
          Could not open the demo. Reload and try again.
        </span>
      ) : null}
    </span>
  );
}
