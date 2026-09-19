'use client';

import { toggleKayamoTheme } from './theme';
import { BotanicalIcon } from '@kayamo/features/icons';
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
        <BotanicalIcon name="moon" />
      </span>
      <span className={styles.themeNight} aria-hidden="true">
        <BotanicalIcon name="sun" />
      </span>
    </button>
  );
}
