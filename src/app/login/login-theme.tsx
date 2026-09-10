'use client';

import { useEffect } from 'react';
import { paintKayamoTheme, resolveKayamoTheme } from '@/shell/theme';

export function LoginTheme() {
  useEffect(() => {
    paintKayamoTheme(resolveKayamoTheme());
  }, []);

  return null;
}
