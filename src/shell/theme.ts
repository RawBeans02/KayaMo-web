export type KayamoTheme = 'day' | 'night';

export function resolveKayamoTheme(): KayamoTheme {
  if (typeof window === 'undefined') return 'day';
  try {
    const saved = window.localStorage.getItem('kayamo:theme');
    if (saved === 'night') return 'night';
    if (saved === 'day') return 'day';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  } catch {
    return 'day';
  }
}

export function readKayamoTheme(): KayamoTheme {
  if (typeof document === 'undefined') return 'day';
  return document.documentElement.dataset.kayamoTheme === 'night' ? 'night' : 'day';
}

export function paintKayamoTheme(theme: KayamoTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.kayamoTheme = theme;
  root.style.colorScheme = theme === 'night' ? 'dark' : 'light';
}

export function applyKayamoTheme(theme: KayamoTheme): void {
  paintKayamoTheme(theme);
  window.localStorage.setItem('kayamo:theme', theme);
}

export function toggleKayamoTheme(): KayamoTheme {
  const next: KayamoTheme = readKayamoTheme() === 'night' ? 'day' : 'night';
  applyKayamoTheme(next);
  return next;
}
