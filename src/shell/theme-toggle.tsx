'use client';

import { toggleKayamoTheme } from './theme';
import styles from './shell.module.css';

export function ThemeToggle() {
  return (
    <button
      type="button"
      className={styles.themeToggle}
      aria-label="Toggle theme"
      onClick={() => {
        toggleKayamoTheme();
      }}
    >
      <span className={styles.themeDay} aria-hidden="true">
        ☾
      </span>
      <span className={styles.themeNight} aria-hidden="true">
        ☀
      </span>
    </button>
  );
}
