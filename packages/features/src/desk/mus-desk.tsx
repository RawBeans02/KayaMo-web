'use client';

import { MusRail } from './mus-rail';
import { MusThread } from '../screens/mus-thread';
import { useDeskClock } from './use-desk-clock';
import styles from './mus-desk.module.css';

/**
 * The Lis screen. The route and internal identifiers still say "mus"; the
 * assistant's name and face do not — Lis is a sparkle, never a character.
 */
export function MusDesk({ userId }: { userId: string }) {
  const { today } = useDeskClock(userId);
  return (
    <section className={styles.desk} aria-labelledby="mus-chat-title" data-mus-desk="">
      <MusThread
        userId={userId}
        logicalDate={today}
        recommended={null}
        unavailableMessage={
          userId.startsWith('guest-')
            ? 'Online chat is unavailable in the demo. Sign in to talk with Lis.'
            : undefined
        }
        chrome="page"
        headingLevel={1}
        entry={{ module: 'mus', view: 'command_center', selectedIds: [] }}
      />
      <MusRail userId={userId} pathname="/mus" variant="page" />
    </section>
  );
}
