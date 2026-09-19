'use client';

import Link from 'next/link';
import styles from './recovery.module.css';

/**
 * Route error boundary. Next renders this in place of the segment that threw,
 * inside the root layout. The error object is not shown: a render error in a
 * health-data app can carry a row in its message. Only the digest is shown,
 * because that is what a support conversation needs.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={styles.page} id="main-content">
      <section className={`${styles.card} kgSurface`} role="alert" aria-labelledby="error-title">
        <p className="kgEyebrow">Something went wrong</p>
        <h1 id="error-title" className="kgTitle">
          This screen hit a snag.
        </h1>
        <p className={styles.lede}>
          Your entries are saved on this device and nothing was lost. Try again, or go
          back to Home.
        </p>
        <div className={styles.actions}>
          <button type="button" className="kgAccent" onClick={reset}>
            Try again
          </button>
          <Link className="kgGhost" href="/today">
            Go to Home
          </Link>
        </div>
        {error.digest ? (
          <p className={styles.digest}>
            Reference <code>{error.digest}</code>
          </p>
        ) : null}
      </section>
    </main>
  );
}
