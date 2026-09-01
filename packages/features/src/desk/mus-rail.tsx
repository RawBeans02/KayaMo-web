'use client';

import type { MusEntry, MusEntryModule } from '@kayamo/ai';
import { useEffect, useMemo, useState } from 'react';
import { updateMusContextPermission } from '../mus/context-permissions';
import {
  MUS_FACE_RULES,
  MUS_FACES,
  musFaceFor,
  musFaceSrc,
  type MusFace,
} from '../mus/mus-faces';
import { useMusBusy, useMusSelection } from '../mus/mus-selection';
import {
  cycleMusPermLevel,
  DEFAULT_MUS_PERM_LEVELS,
  domainAllowedFromLevels,
  MUS_PERM_MODULES,
  readMusPermLevels,
  readableModuleCount,
  writeMusPermLevels,
  type MusPermLevels,
} from '../mus/perm-levels';
import { MusThread } from '../screens/mus-thread';
import { useDeskClock } from './use-desk-clock';
import styles from './mus-rail.module.css';

const SCREEN_LABEL: Record<string, string> = {
  '/today': 'Today · food log',
  '/calories': 'Today · food log',
  '/foods': 'Foods · catalog',
  '/verify': 'Verify · PH core',
  '/gym': 'Gym',
  '/todos': 'Todos',
  '/mus': 'Mus',
};

function moduleFromPath(pathname: string): MusEntryModule {
  if (pathname === '/calories' || pathname === '/today') return 'calories';
  if (pathname.startsWith('/foods')) return 'foods';
  if (pathname.startsWith('/verify')) return 'verify';
  if (pathname.startsWith('/gym')) return 'gym';
  if (pathname.startsWith('/todos')) return 'todos';
  if (pathname.startsWith('/mus')) return 'mus';
  return 'dashboard';
}

function permColor(level: MusPermLevels[keyof MusPermLevels]): string {
  if (level === 'never') return 'var(--color-muted-2)';
  if (level === 'edit') return 'var(--color-accent)';
  return 'var(--color-muted)';
}

export function MusRail({
  userId,
  pathname,
  collapsed = false,
  onToggle,
  variant = 'shell',
}: {
  userId: string;
  pathname: string;
  collapsed?: boolean;
  onToggle?: () => void;
  variant?: 'shell' | 'page';
}) {
  const { today } = useDeskClock(userId);
  const selection = useMusSelection();
  const busy = useMusBusy();
  const [levels, setLevels] = useState<MusPermLevels>(DEFAULT_MUS_PERM_LEVELS);
  const [permsOpen, setPermsOpen] = useState(variant === 'page');

  useEffect(() => {
    setLevels(readMusPermLevels(userId));
  }, [userId]);

  const face: MusFace = musFaceFor({ kind: busy ? 'thinking' : 'idle' });
  const faceSrc = musFaceSrc(face);
  const screen = SCREEN_LABEL[pathname] ?? 'Desk';
  const selectedLabel = selection?.label?.trim() || '';
  const entry: MusEntry = useMemo(
    () => ({
      module: selection?.module ?? moduleFromPath(pathname),
      view: selection?.view ?? null,
      selectedIds: selection?.selectedIds ?? [],
    }),
    [pathname, selection],
  );

  function persist(next: MusPermLevels) {
    setLevels(next);
    writeMusPermLevels(userId, next);
    const physical = domainAllowedFromLevels(next, 'physical_self');
    const goals = domainAllowedFromLevels(next, 'goals_planning');
    void updateMusContextPermission('physical_self', physical).catch(() => undefined);
    void updateMusContextPermission('goals_planning', goals).catch(() => undefined);
  }

  if (collapsed && variant === 'shell') {
    return (
      <aside className={styles.railCollapsed} aria-label="Mus, collapsed" data-shell="rail" data-mus-rail="collapsed">
        <button type="button" className={styles.expand} onClick={onToggle} aria-label="Expand Mus">
          <img src="/mus-neutral.png" alt="" width={34} height={34} />
        </button>
        <span className={styles.spine}>Mus</span>
        <span />
        <button type="button" className={styles.collapse} onClick={onToggle} aria-label="Expand Mus">
          ‹
        </button>
      </aside>
    );
  }

  const readable = readableModuleCount(levels);

  return (
    <aside
      className={variant === 'page' ? styles.page : styles.rail}
      aria-label="Mus, the shared assistant"
      data-shell="rail"
      data-mus-rail={variant}
    >
      <header className={variant === 'page' ? styles.pageHeader : styles.header}>
        {faceSrc ? (
          <img src={faceSrc} alt="" width={32} height={32} className={styles.avatar} />
        ) : (
          <span className={styles.slot}>mus-{face}</span>
        )}
        <div className={styles.title}>
          <p>Mus</p>
          <p className={styles.mono}>state · {face}</p>
        </div>
        {variant === 'shell' && onToggle ? (
          <button type="button" className={styles.collapse} onClick={onToggle} aria-label="Collapse Mus">
            ›
          </button>
        ) : null}
      </header>

      <div className={styles.context}>
        <p className={styles.mono}>Context · follows this screen</p>
        <dl>
          <div>
            <dt className={styles.mono}>screen</dt>
            <dd>{screen}</dd>
          </div>
          <div>
            <dt className={styles.mono}>this</dt>
            <dd style={{ color: selectedLabel ? 'var(--color-text)' : 'var(--color-muted-2)' }}>
              {selectedLabel || 'nothing selected — say “this” after picking a row'}
            </dd>
          </div>
        </dl>
        <p className={styles.note}>
          Mus reads only what is on. Nothing at <span className={styles.mono}>suggest</span> or
          below is ever written without you.
        </p>
        <button
          type="button"
          className={styles.permToggle}
          onClick={() => setPermsOpen((open) => !open)}
          aria-expanded={permsOpen}
        >
          <span className={styles.mono}>
            {permsOpen ? '▾' : '▸'} {readable} of 5 modules readable
          </span>
        </button>
        {permsOpen ? (
          <div className={styles.perms} data-mus-perms="">
            {MUS_PERM_MODULES.map((row) => {
              const level = levels[row.key];
              return (
                <button
                  key={row.key}
                  type="button"
                  className={styles.perm}
                  data-mus-perm={row.key}
                  data-mus-perm-level={level}
                  onClick={() => persist({ ...levels, [row.key]: cycleMusPermLevel(level) })}
                  aria-label={`${row.label} permission, currently ${level}. Click to cycle.`}
                >
                  <span>{row.label}</span>
                  <span className={styles.permLevel} style={{ color: permColor(level) }}>
                    {level}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {variant === 'shell' ? (
        <div className={styles.thread}>
          <MusThread
            userId={userId}
            logicalDate={today}
            recommended={null}
            chrome="rail"
            entry={entry}
          />
        </div>
      ) : (
        <div className={styles.states}>
          <h2 className={styles.mono}>Mus states</h2>
          <div className={styles.stateGrid}>
            {MUS_FACES.map((name) => {
              const src = musFaceSrc(name);
              return (
                <article key={name} className={styles.stateCard} data-mus-face={name}>
                  {src ? (
                    <img src={src} alt="" width={48} height={48} />
                  ) : (
                    <span className={styles.stateSlot}>mus-{name}.png needed</span>
                  )}
                  <strong>{name}</strong>
                  <p>{MUS_FACE_RULES[name]}</p>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {variant === 'shell' ? (
        <p className={styles.foot} data-shell="rail-foot">
          Same assistant as the Mus tab · proposes, never writes
        </p>
      ) : null}
    </aside>
  );
}
