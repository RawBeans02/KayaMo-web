'use client';

import { type Locale } from '@kayamo/food/quick-log';
import { useSyncExternalStore } from 'react';

/**
 * Desk language preference.
 *
 * Mirrors the theme pattern: the value lives on <html data-kayamo-locale> so a
 * boot script can paint it before hydration, with localStorage as the store.
 * Packages read the attribute rather than importing from the root app.
 *
 * Only UI chrome switches. Dish names, aliases and serving units are catalog
 * data — "Kanin", "1 tasa" — and stay as they are in every locale.
 */
export const DESK_DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'kayamo:locale';
export const LOCALE_CHANGE_EVENT = 'kayamo:locale-change';

/** The two the desk offers. `fil` remains valid in the data model. */
export const DESK_LOCALES: Locale[] = ['en', 'taglish'];

export function readDeskLocale(): Locale {
  if (typeof document === 'undefined') return DESK_DEFAULT_LOCALE;
  const value = document.documentElement.dataset.kayamoLocale;
  return value === 'fil' || value === 'taglish' ? value : DESK_DEFAULT_LOCALE;
}

export function setDeskLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.kayamoLocale = locale;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private mode: the choice still applies for this page view.
  }
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}

export function toggleDeskLocale(): Locale {
  const next: Locale = readDeskLocale() === 'taglish' ? 'en' : 'taglish';
  setDeskLocale(next);
  return next;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Re-renders on change, and returns the default during SSR. */
export function useDeskLocale(): Locale {
  return useSyncExternalStore(subscribe, readDeskLocale, () => DESK_DEFAULT_LOCALE);
}
