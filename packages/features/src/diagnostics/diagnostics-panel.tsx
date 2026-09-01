'use client';

import {
  getOfflineDatabaseName,
  getOfflineDbVersion,
  recoverClosedOfflineDb,
  retryFailedSyncWrites,
  syncNow,
  useSyncStatus,
} from '@kayamo/offline';
import { ArrowLeft } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/api-origin';
import styles from '../screens/kayamo-app.module.css';

type Probe = 'checking' | 'yes' | 'no' | 'unknown';

function probeLabel(value: Probe): string {
  if (value === 'checking') return 'checking';
  if (value === 'yes') return 'yes';
  if (value === 'no') return 'no';
  return 'unknown';
}

export function DiagnosticsPanel({
  userId,
  onBack,
}: {
  userId: string;
  onBack: () => void;
}) {
  const sync = useSyncStatus();
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [api, setApi] = useState<Probe>('checking');
  const [auth, setAuth] = useState<Probe>('checking');
  const [dbReady, setDbReady] = useState<Probe>('checking');
  const [dbName, setDbName] = useState('—');
  const [dbVersion, setDbVersion] = useState<number | null>(null);
  const [sw, setSw] = useState('unknown');
  const [push, setPush] = useState('unknown');
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setOnline(navigator.onLine);
    setDbName(getOfflineDatabaseName());
    setDbVersion(getOfflineDbVersion());
    try {
      await recoverClosedOfflineDb(async () => getOfflineDbVersion());
      setDbReady('yes');
    } catch {
      setDbReady('no');
    }
    try {
      const response = await apiFetch('/api/mus/permissions', {
        cache: 'no-store',
        timeoutMs: 8_000,
      });
      setApi(response.ok || response.status === 401 ? 'yes' : 'no');
      setAuth(response.status === 401 ? 'no' : response.ok ? 'yes' : 'unknown');
    } catch {
      setApi('no');
      setAuth('unknown');
    }
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      setSw(registration?.active ? 'installed' : 'missing');
    } else {
      setSw('unsupported');
    }
    setPush(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const report = [
    `Build ${process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'}`,
    `Environment ${process.env.NODE_ENV}`,
    `Online ${online ? 'yes' : 'no'}`,
    `API ${probeLabel(api)}`,
    `Auth ${probeLabel(auth)}`,
    `User DB ${probeLabel(dbReady)}`,
    `Offline DB ${dbName} v${dbVersion ?? '—'}`,
    `Sync ${sync.kind}`,
    `Service worker ${sw}`,
    `Push ${push}`,
  ].join('\n');

  return (
    <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
      <div className={styles.activeHeader}>
        <button type="button" className={styles.iconButton} onClick={onBack} aria-label="Back">
          <ArrowLeft size={21} />
        </button>
        <h1>Diagnostics</h1>
      </div>
      <div className={styles.flowScroll}>
        <p className={styles.mutedNote}>
          Developer status only. Tokens, food, journals, and private text are not included.
        </p>
        <dl className={styles.readingList}>
          <div>
            <dt>App build</dt>
            <dd>{process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'}</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>{process.env.NODE_ENV}</dd>
          </div>
          <div>
            <dt>Online</dt>
            <dd>{online ? 'yes' : 'no'}</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>{probeLabel(api)}</dd>
          </div>
          <div>
            <dt>Supabase auth</dt>
            <dd>{probeLabel(auth)}</dd>
          </div>
          <div>
            <dt>User DB</dt>
            <dd>{probeLabel(dbReady)}</dd>
          </div>
          <div>
            <dt>Offline DB</dt>
            <dd>
              {dbName} · v{dbVersion ?? '—'}
            </dd>
          </div>
          <div>
            <dt>Sync</dt>
            <dd>{sync.kind}</dd>
          </div>
          <div>
            <dt>Service worker</dt>
            <dd>{sw}</dd>
          </div>
          <div>
            <dt>Push</dt>
            <dd>{push}</dd>
          </div>
        </dl>
        {notice ? <p className={styles.mutedNote}>{notice}</p> : null}
        <div className={styles.buttonRow}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              void syncNow().then(() => setNotice('Sync requested.'));
            }}
          >
            Sync now
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              void retryFailedSyncWrites(userId).then((count) => {
                setNotice(count === 0 ? 'No failed writes to retry.' : `Retrying ${count} writes.`);
              });
            }}
          >
            Retry failed writes
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(report).then(() => setNotice('Copied diagnostic report.'));
            }}
          >
            Copy report
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => void refresh()}>
            Reload probes
          </button>
          <button className={styles.secondaryButton} type="button" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      </div>
    </div>
  );
}
