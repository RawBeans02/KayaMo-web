import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Barlow_Condensed, IBM_Plex_Mono, Source_Sans_3, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-source-sans',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-source-serif',
  display: 'swap',
});

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

const plex = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KayaMo',
  description: 'KayaMo — Filipino food, everyday portions, and your training in one place.',
};

const THEME_BOOT = `try{var t=localStorage.getItem('kayamo:theme');var n=t==='night'||(t!=='day'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.kayamoTheme=n?'night':'day';document.documentElement.style.colorScheme=n?'dark':'light';}catch(e){}`;

// English unless the reader has chosen Taglish. Painted before hydration so the
// first frame is already in the right language.
const LOCALE_BOOT = `try{var l=localStorage.getItem('kayamo:locale');document.documentElement.dataset.kayamoLocale=(l==='taglish'||l==='fil')?l:'en';}catch(e){document.documentElement.dataset.kayamoLocale='en';}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${sourceSerif.variable} ${barlow.variable} ${plex.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOT }} />
      </head>
      <body className="min-h-full bg-bg font-body text-text antialiased">{children}</body>
    </html>
  );
}
