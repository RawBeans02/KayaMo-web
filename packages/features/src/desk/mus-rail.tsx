'use client';

import { defaultMusContextPermissions, type MusContextPermissionDomain, type MusContextPermissions, type MusEntry, type MusEntryModule } from '@kayamo/ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadMusContextPermissions, updateMusContextPermission } from '../mus/context-permissions';
import {
  MUS_FACE_RULES,
  MUS_FACES,
  musFaceFor,
  musFaceSrc,
  type MusFace,
} from '../mus/mus-faces';
import { useMusBusy, useMusSelection } from '../mus/mus-selection';
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

const PERMISSION_ROWS: { key: MusContextPermissionDomain; label: string }[] = [
  { key: 'physical_self', label: 'Food, nutrition & workouts' },
  { key: 'goals_planning', label: 'Goals & planning' },
  { key: 'memory', label: 'Saved memories' },
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
        if (!cancelled) setPermissionError('Could not verify access. Retry before using Mus.');
      }
    }
    void reload();
    window.addEventListener('kayamo:mus-permissions', reload);
    return () => { cancelled = true; window.removeEventListener('kayamo:mus-permissions', reload); };
  }, [guest, userId]);

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

  const readable = Object.values(permissions).filter(Boolean).length;

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
          {guest ? 'Online Mus is unavailable in the local demo. Sign in to use it.' : 'These controls govern stored context for Mus chat. Food and workouts share one access setting. Your messages and explicit tool requests are still sent when you submit them. Mus proposes changes; you confirm them.'}
        </p>
        <button
          type="button"
          className={styles.permToggle}
          onClick={() => setPermsOpen((open) => !open)}
          aria-expanded={permsOpen}
        >
          <span className={styles.mono}>
            {permsOpen ? '▾' : '▸'} {guest ? 'Sign in to manage access' : loaded ? `${readable} of 4 context areas readable` : 'Context access unverified'}
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
      ) : (
        <details className={styles.states}>
          <summary>About Mus’s expressions</summary>
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
        </details>
      )}

      {variant === 'shell' ? (
        <p className={styles.foot} data-shell="rail-foot">
          Same assistant as the Mus tab · proposes, never writes
        </p>
      ) : null}
    </aside>
  );
}
