export type KayamoTheme = 'day' | 'night';

export function readKayamoTheme(): KayamoTheme {
  if (typeof document === 'undefined') return 'day';
  return document.documentElement.dataset.kayamoTheme === 'night' ? 'night' : 'day';
}

export function applyKayamoTheme(theme: KayamoTheme): void {
  const root = document.documentElement;
  root.dataset.kayamoTheme = theme;
  root.style.colorScheme = theme === 'night' ? 'dark' : 'light';
  window.localStorage.setItem('kayamo:theme', theme);
}

export function toggleKayamoTheme(): KayamoTheme {
  const next: KayamoTheme = readKayamoTheme() === 'night' ? 'day' : 'night';
  applyKayamoTheme(next);
  return next;
}
