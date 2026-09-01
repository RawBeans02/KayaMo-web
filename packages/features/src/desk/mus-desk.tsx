'use client';

import { MusRail } from './mus-rail';
import { MusThread } from '../screens/mus-thread';
import { useDeskClock } from './use-desk-clock';
import styles from './mus-desk.module.css';

export function MusDesk({ userId }: { userId: string }) {
  const { today } = useDeskClock(userId);
  return (
    <section className={styles.desk} aria-labelledby="mus-desk-title" data-mus-desk="">
      <MusThread
        userId={userId}
        logicalDate={today}
        recommended={null}
        chrome="page"
        entry={{ module: 'mus', view: 'command_center', selectedIds: [] }}
      />
      <MusRail userId={userId} pathname="/mus" variant="page" />
    </section>
  );
}
