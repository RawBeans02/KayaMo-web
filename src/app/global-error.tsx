'use client';

import styles from './recovery.module.css';

/**
 * Last resort: replaces the root layout when it is the layout itself that
 * threw. It must render <html> and <body>. No CSS from globals.css is
 * guaranteed here, so this uses only its own module and inline structure.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className={styles.bare}>
        <main className={styles.page} id="main-content">
          <section className={styles.card} role="alert" aria-labelledby="global-error-title">
            <h1 id="global-error-title">KayaMo could not load.</h1>
            <p className={styles.lede}>
              Your entries are saved on this device. Reload to try again.
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={reset}>
                Reload
              </button>
            </div>
            {error.digest ? (
              <p className={styles.digest}>
                Reference <code>{error.digest}</code>
              </p>
            ) : null}
          </section>
        </main>
      </body>
    </html>
  );
}
