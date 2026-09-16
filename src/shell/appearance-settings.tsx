'use client';
import { useState, useSyncExternalStore } from 'react';
import { applyKayamoTheme, paintKayamoTheme, resolveKayamoTheme } from './theme';
import { BotanicalIcon } from '@kayamo/features/desktop';
import styles from './settings.module.css';

const subscribe = () => () => {};
function readPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const APPEARANCES = [
  { value: 'system', label: 'System', icon: 'system' },
  { value: 'day', label: 'Light', icon: 'sun' },
  { value: 'night', label: 'Dark', icon: 'moon' },
] as const;

export function AppearanceSettings() {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return ready ? (
    <AppearanceControls />
  ) : (
    <section className={`${styles.list} kgSurface`} aria-label="Appearance">
      <h2 className={styles.srOnly}>Appearance</h2>
      <p className={styles.status} role="status">
        Loading preferences…
      </p>
    </section>
  );
}

function AppearanceControls() {
  const [appearance, setAppearance] = useState(() => {
    const saved = readPreference('kayamo:theme');
    return saved === 'day' || saved === 'night' ? saved : 'system';
  });
  const [reduce, setReduce] = useState(
    () => readPreference('kayamo:reduce-transparency') === 'true',
  );
  const ready = true;
  const [error, setError] = useState<string | null>(null);
  function changeAppearance(value: string) {
    setAppearance(value);
    try {
      if (value === 'system') {
        localStorage.removeItem('kayamo:theme');
        paintKayamoTheme(resolveKayamoTheme());
      } else applyKayamoTheme(value === 'night' ? 'night' : 'day');
    } catch {
      paintKayamoTheme(value === 'night' ? 'night' : 'day');
      setError('Could not save this preference in your browser.');
    }
  }

  const selected = Math.max(
    0,
    APPEARANCES.findIndex((option) => option.value === appearance),
  );

  return (
    <section className={`${styles.list} kgSurface`} aria-label="Appearance">
      <h2 className={styles.srOnly}>Appearance</h2>

      <div className={styles.segRow}>
        <span className={styles.rowIcon} aria-hidden="true">
          <BotanicalIcon name="moon" size={22} />
        </span>
        <span className={styles.rowLabel} id="kg-appearance-label">
          Appearance
        </span>
        <div className={styles.seg} role="group" aria-labelledby="kg-appearance-label">
          <span
            className={styles.segIndicator}
            aria-hidden="true"
            style={{ transform: `translateX(${selected * 100}%)` }}
          />
          {APPEARANCES.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={!ready}
              aria-pressed={appearance === option.value}
              onClick={() => changeAppearance(option.value)}
            >
              <BotanicalIcon
                name={option.icon}
                size={17}
                weight={appearance === option.value ? 'fill' : 'regular'}
              />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className={styles.row}>
        <span className={styles.rowIcon} aria-hidden="true">
          <BotanicalIcon name="motion" size={22} />
        </span>
        <span className={styles.rowLabel}>
          Reduce Transparency
          <small className={styles.rowNote}>
            Use solid surfaces for navigation and controls.
          </small>
        </span>
        <span className={styles.switch}>
          <input
            className={styles.switchInput}
            type="checkbox"
            checked={reduce}
            disabled={!ready}
            onChange={(event) => {
              const value = event.target.checked;
              setReduce(value);
              document.documentElement.dataset.reduceTransparency = String(value);
              try {
                localStorage.setItem('kayamo:reduce-transparency', String(value));
              } catch {
                setError('Could not save this preference in your browser.');
              }
            }}
          />
          <span className={styles.switchTrack} aria-hidden="true">
            <span className={styles.switchKnob} />
          </span>
        </span>
      </label>

      {error && (
        <p className={styles.error} role="status">
          {error}
        </p>
      )}
    </section>
  );
}
