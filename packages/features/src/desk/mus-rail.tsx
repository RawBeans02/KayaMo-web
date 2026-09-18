'use client';

import { defaultMusContextPermissions, type MusContextPermissionDomain, type MusContextPermissions, type MusEntry, type MusEntryModule } from '@kayamo/ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadMusContextPermissions, updateMusContextPermission } from '../mus/context-permissions';
import { LisFace } from '../mus/lis-face';
import { useMusBusy, useMusSelection } from '../mus/mus-selection';
import { MusThread } from '../mus/mus-thread';
import { useDeskClock } from './use-desk-clock';
import styles from './mus-rail.module.css';

const SCREEN_LABEL: Record<string, string> = {
  '/today': 'Today · food log',
  '/calories': 'Today · food log',
  '/foods': 'Foods · catalog',
  '/verify': 'Verify · PH core',
  '/gym': 'Gym',
  '/todos': 'Todos',
  '/mus': 'Lis',
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

const PERMISSION_ROWS: { key: MusContextPermissionDomain; label: string }[] = [
  { key: 'physical_self', label: 'Food, nutrition & workouts' },
  { key: 'goals_planning', label: 'Goals & planning' },
  { key: 'memory', label: 'Saved memories' },
  { key: 'identity', label: 'Who you are' },
  { key: 'faith', label: 'Faith context' },
];

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
  const guest = userId.startsWith('guest-');
  const [permissions, setPermissions] = useState<MusContextPermissions>(defaultMusContextPermissions);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const updating = useRef(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permsOpen, setPermsOpen] = useState(variant === 'page');

  useEffect(() => {
    let cancelled = false;
    async function reload() {
      if (guest) return;
      setLoaded(false);
      try {
        const value = await loadMusContextPermissions();
        if (!cancelled) { setPermissions(value); setLoaded(true); setPermissionError(null); }
      } catch {
        if (!cancelled) setPermissionError('Could not verify access. Retry before using Lis.');
      }
    }
    void reload();
    window.addEventListener('kayamo:mus-permissions', reload);
    return () => { cancelled = true; window.removeEventListener('kayamo:mus-permissions', reload); };
  }, [guest, userId]);

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

  async function persist(domain: MusContextPermissionDomain) {
    if (!loaded || updating.current || guest) return;
    updating.current = true;
    setPending(true);
    setPermissionError(null);
    try {
      const confirmed = await updateMusContextPermission(domain, !permissions[domain]);
      setPermissions(confirmed);
      window.dispatchEvent(new Event('kayamo:mus-permissions'));
    } catch {
      // A timed-out response may still have committed. Treat access as unknown
      // until a fresh GET, and never claim a revocation succeeded.
      setLoaded(false);
      setPermissionError('Change not confirmed. Access may be unchanged. Retry to check the server before sharing anything.');
    } finally {
      updating.current = false;
      setPending(false);
    }
  }

  if (collapsed && variant === 'shell') {
    return (
      <aside className={styles.railCollapsed} aria-label="Lis, collapsed" data-shell="rail" data-mus-rail="collapsed">
        <button type="button" className={styles.expand} onClick={onToggle} aria-label="Expand Lis">
          <LisFace size={34} className={styles.face} />
        </button>
        <span className={styles.spine}>Lis</span>
        <span />
        <button type="button" className={styles.collapse} onClick={onToggle} aria-label="Expand Lis">
          ‹
        </button>
      </aside>
    );
  }

  const readable = Object.values(permissions).filter(Boolean).length;

  return (
    <aside
      className={variant === 'page' ? styles.page : styles.rail}
      aria-label="Lis, the shared assistant"
      data-shell="rail"
      data-mus-rail={variant}
    >
      <header className={variant === 'page' ? styles.pageHeader : styles.header}>
        <LisFace size={36} className={styles.face} />
        <div className={styles.title}>
          <p>Lis</p>
          <p className={styles.mono}>{busy ? 'thinking' : 'proposes · you confirm'}</p>
        </div>
        {variant === 'shell' && onToggle ? (
          <button type="button" className={styles.collapse} onClick={onToggle} aria-label="Collapse Lis">
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
            <dd style={{ color: selectedLabel ? 'var(--ink)' : 'var(--ink2)' }}>
              {selectedLabel || 'nothing selected. Say “this” after picking a row'}
            </dd>
          </div>
        </dl>
        <p className={styles.note}>
          {guest ? 'Online chat is unavailable in the demo. Sign in to use it.' : 'These controls govern stored context for Lis. Food and workouts share one access setting. Your messages and explicit tool requests are still sent when you submit them. Lis proposes changes; you confirm them.'}
        </p>
        <button
          type="button"
          className={styles.permToggle}
          onClick={() => setPermsOpen((open) => !open)}
          aria-expanded={permsOpen}
        >
          <span className={styles.mono}>
            {permsOpen ? '▾' : '▸'} {guest ? 'Sign in to manage access' : loaded ? `${readable} of ${PERMISSION_ROWS.length} context areas readable` : 'Context access unverified'}
          </span>
        </button>
        {permsOpen ? (
          <div className={styles.perms} data-mus-perms="">
            {PERMISSION_ROWS.map((row) => {
              const level = guest ? 'sign in' : !loaded ? 'unverified' : permissions[row.key] ? 'read' : 'off';
              return (
                <button
                  key={row.key}
                  type="button"
                  className={styles.perm}
                  data-mus-perm={row.key}
                  data-mus-perm-level={level}
                  disabled={guest || !loaded || pending}
                  onClick={() => void persist(row.key)}
                  aria-label={`${row.label} access, currently ${level}`}
                  aria-pressed={loaded && permissions[row.key]}
                >
                  <span>{row.label}</span>
                  <span className={styles.permLevel} >
                    {level}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {permissionError ? <div role="alert"><p>{permissionError}</p><button type="button" disabled={pending} onClick={() => window.dispatchEvent(new Event('kayamo:mus-permissions'))}>Retry access check</button></div> : null}

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
      ) : null}

      {variant === 'shell' ? (
        <p className={styles.foot} data-shell="rail-foot">
          Same assistant as the Lis tab · proposes, never writes
        </p>
      ) : null}
    </aside>
  );
}
