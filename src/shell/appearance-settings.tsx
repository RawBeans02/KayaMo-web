'use client';
import { useState, useSyncExternalStore } from 'react';
import { applyKayamoTheme, paintKayamoTheme, resolveKayamoTheme } from './theme';
import { BotanicalIcon } from '@kayamo/features/desktop';
import { LocaleToggle } from './locale-toggle';
import styles from './settings.module.css';

const subscribe = () => () => {};
function readPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function AppearanceSettings() {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return ready ? <AppearanceControls /> : <p role="status">Loading preferences…</p>;
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
  return (
    <div className={styles.sections}>
      <section>
        <h2>Appearance</h2>
        <p>Make this space comfortable for you. Preferences stay in this browser.</p>
        <div className={styles.options} role="group" aria-label="Appearance">
          {(
            [
              { value: 'system', label: 'System', icon: 'system' },
              { value: 'day', label: 'Light', icon: 'sun' },
              { value: 'night', label: 'Dark', icon: 'moon' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              disabled={!ready}
              aria-pressed={appearance === option.value}
              onClick={() => changeAppearance(option.value)}
            >
              <BotanicalIcon name={option.icon} />
              {option.label}
            </button>
          ))}
        </div>
        <label className={styles.check}>
          <input
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
          <span>
            Reduce Transparency
            <small>Use solid surfaces for navigation and controls.</small>
          </span>
        </label>
        {error && <p role="status">{error}</p>}
      </section>
      <section>
        <h2>Language</h2>
        <p>
          English or Taglish for supported interface copy. Your records stay as you wrote
          them.
        </p>
        <LocaleToggle />
      </section>
      <section>
        <h2>Mus permissions</h2>
        <p>
          You decide what Mus can access. Stored records are not automatically
          AI-readable.
        </p>
        <a href="/mus">Review access and proposals</a>
      </section>
    </div>
  );
}
