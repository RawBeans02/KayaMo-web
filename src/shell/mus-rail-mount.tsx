'use client';

import Image from 'next/image';
import styles from './shell.module.css';

const SCREEN_LABEL: Record<string, string> = {
  '/today': 'Today',
  '/calories': 'Today',
  '/foods': 'Foods',
  '/verify': 'Verify',
  '/gym': 'Gym',
  '/todos': 'Todos',
  '/mus': 'Mus',
};

export function MusRailMount({
  pathname,
  collapsed,
  onToggle,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const screen = SCREEN_LABEL[pathname] ?? 'Desk';

  if (collapsed) {
    return (
      <aside className={styles.railCollapsed} aria-label="Mus, collapsed" data-shell="rail">
        <button type="button" className={styles.railExpand} onClick={onToggle} aria-label="Expand Mus">
          <Image src="/mus-neutral.png" alt="" width={28} height={28} />
        </button>
      </aside>
    );
  }

  return (
    <aside className={styles.rail} aria-label="Mus, the shared assistant" data-shell="rail">
      <header className={styles.railHeader}>
        <Image src="/mus-neutral.png" alt="" width={32} height={32} className={styles.railAvatar} />
        <div className={styles.railTitle}>
          <p>Mus</p>
          <p className={styles.mono}>state · waiting</p>
        </div>
        <button type="button" className={styles.railCollapse} onClick={onToggle} aria-label="Collapse Mus">
          ›
        </button>
      </header>
      <div className={styles.railContext}>
        <p className={styles.mono}>Context · follows this screen</p>
        <dl>
          <div>
            <dt className={styles.mono}>screen</dt>
            <dd>{screen}</dd>
          </div>
          <div>
            <dt className={styles.mono}>this</dt>
            <dd>Nothing selected</dd>
          </div>
        </dl>
        <p className={styles.railNote}>
          Mus reads only what is on. Nothing at <span className={styles.mono}>suggest</span> or below
          is ever written without you.
        </p>
      </div>
      <div className={styles.railThread}>
        <p className={styles.railEmpty}>Mus waits here. Proposals land in a later pass.</p>
      </div>
      <p className={styles.railFoot} data-shell="rail-foot">
        Same assistant as the Mus tab · proposes, never writes
      </p>
    </aside>
  );
}
