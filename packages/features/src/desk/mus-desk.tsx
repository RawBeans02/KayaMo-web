'use client';

import { MusThread } from '../screens/mus-thread';
import styles from '../food/desk.module.css';
import { useDeskClock } from './use-desk-clock';

export function MusDesk({ userId }: { userId: string }) {
  const { today } = useDeskClock(userId);
  return (
    <section className={styles.panel} aria-labelledby="mus-desk-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Assistant</p>
          <h1 id="mus-desk-title" className={styles.title}>
            Mus
          </h1>
          <p className={styles.lede}>
            Ask to log food, add a todo, or set a goal. Mus proposes; the
            confirm buttons under a reply are the write. This is the same
            assistant as the Todos companion — not a second bot.
          </p>
        </div>
      </header>
      <div className={styles.musPane}>
        <MusThread
          userId={userId}
          logicalDate={today}
          recommended={null}
          entry={{ module: 'mus', view: 'command_center', selectedIds: [] }}
        />
      </div>
    </section>
  );
}
