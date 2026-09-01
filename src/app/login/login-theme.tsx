'use client';

import { useEffect } from 'react';

export function LoginTheme() {
  useEffect(() => {
    const saved = localStorage.getItem('kayamo:theme');
    const systemNight = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const night = saved === 'night' || (saved === 'system' && systemNight);
    const root = document.documentElement;
    root.dataset.kayamoTheme = night ? 'night' : 'day';
    root.style.colorScheme = night ? 'dark' : 'light';
  }, []);

  return null;
}
