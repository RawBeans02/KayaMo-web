import Link from 'next/link';
import styles from './recovery.module.css';

/**
 * Root 404. Renders inside the root layout only, so it has the wash and the
 * glass tokens but no shell. Plain copy, one way back; nothing about the URL
 * the person typed is echoed.
 */
export default function NotFound() {
  return (
    <main className={styles.page} id="main-content">
      <section className={`${styles.card} kgSurface`} aria-labelledby="not-found-title">
        <p className="kgEyebrow">404</p>
        <h1 id="not-found-title" className="kgTitle">
          That page is not here.
        </h1>
        <p className={styles.lede}>
          The link may be old, or the address may have a typo. Your saved entries are
          untouched.
        </p>
        <div className={styles.actions}>
          <Link className="kgAccent" href="/today">
            Go to Home
          </Link>
          <Link className="kgGhost" href="/">
            KayaMo front page
          </Link>
        </div>
      </section>
    </main>
  );
}
