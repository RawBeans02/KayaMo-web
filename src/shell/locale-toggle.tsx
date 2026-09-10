'use client';

import { setDeskLocale, useDeskLocale } from '@kayamo/features/desktop';
import styles from './shell.module.css';

/**
 * English / Taglish. Chrome only — dish names and serving units are catalog
 * data and read the same either way.
 */
export function LocaleToggle() {
  const locale = useDeskLocale();
  const taglish = locale !== 'en';

  return (
    <div className={styles.localeToggle} role="group" aria-label="Language">
      <button
        type="button"
        data-on={taglish ? 'false' : 'true'}
        aria-pressed={!taglish}
        onClick={() => setDeskLocale('en')}
      >
        EN
      </button>
      <button
        type="button"
        data-on={taglish ? 'true' : 'false'}
        aria-pressed={taglish}
        onClick={() => setDeskLocale('taglish')}
      >
        TAG
      </button>
    </div>
  );
}
