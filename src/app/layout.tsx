import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'KayaMo',
  metadataBase: new URL('https://www.kayamo.fit'),
  icons: { icon: '/botanical/favicon-32.png', apple: '/botanical/apple-touch-icon.png' },
  openGraph: {
    title: 'KayaMo — small steps, room to grow',
    description:
      'A calmer place for your daily steps, meaningful goals, and personal growth.',
    type: 'website',
    images: [
      {
        url: '/botanical/home-preview.webp',
        width: 1440,
        height: 1024,
        alt: 'KayaMo daily plan with illustrative sample tasks',
      },
    ],
  },
  twitter: { card: 'summary_large_image' },
  description:
    'KayaMo — a calmer place for your daily steps, meaningful goals, and personal growth.',
};

const THEME_BOOT = `try{var t=localStorage.getItem('kayamo:theme');var n=t==='night'||(t!=='day'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.kayamoTheme=n?'night':'day';document.documentElement.style.colorScheme=n?'dark':'light';document.documentElement.dataset.reduceTransparency=localStorage.getItem('kayamo:reduce-transparency')==='true'?'true':'false';}catch(e){}`;

// English unless the reader has chosen Taglish. Painted before hydration so the
// first frame is already in the right language.
const LOCALE_BOOT = `try{var l=localStorage.getItem('kayamo:locale');document.documentElement.dataset.kayamoLocale=(l==='taglish'||l==='fil')?l:'en';}catch(e){document.documentElement.dataset.kayamoLocale='en';}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full" data-kayamo-web="" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOT }} />
      </head>
      <body className="min-h-full bg-bg font-body text-text antialiased">{children}</body>
    </html>
  );
}
