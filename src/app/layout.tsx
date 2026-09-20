import { ClerkProvider } from '@clerk/nextjs';
import { isClerkConfigured } from '@/lib/clerk';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';
import { PRIVATE_ROBOTS, SITE_URL } from '@/lib/site-metadata';
import './globals.css';

// Display face for titles and numerals. System SF carries the UI text.
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KayaMo',
  metadataBase: new URL(SITE_URL),
  robots: PRIVATE_ROBOTS,
  icons: { icon: '/botanical/favicon-32.png', apple: '/botanical/apple-touch-icon.png' },
  openGraph: {
    title: 'KayaMo · plan, food and movement in one place',
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
    'Plan, meals and movement in a single glanceable view. Lis proposes; you confirm.',
};

const THEME_BOOT = `try{var t=localStorage.getItem('kayamo:theme');var n=t==='night'||(t!=='day'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.kayamoTheme=n?'night':'day';document.documentElement.style.colorScheme=n?'dark':'light';document.documentElement.dataset.reduceTransparency=localStorage.getItem('kayamo:reduce-transparency')==='true'?'true':'false';}catch(e){}`;

// The rebrand retires the Taglish *toggle*, and English is the default. A
// reader who had already chosen a language keeps it: dropping a control is not
// a reason to silently discard an explicit choice someone already made.
const LOCALE_BOOT = `try{var l=localStorage.getItem('kayamo:locale');document.documentElement.dataset.kayamoLocale=(l==='taglish'||l==='fil')?l:'en';}catch(e){document.documentElement.dataset.kayamoLocale='en';}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${manrope.variable}`}
      data-kayamo-web=""
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOT }} />
      </head>
      <body className="min-h-full antialiased">
        <AuthProvider>
          {/* The wash the glass refracts. Inert, behind everything. */}
          <div className="kgWash" aria-hidden="true" />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

/**
 * Clerk wraps the tree only when its publishable key is set; without it the
 * provider would throw, and the demo and CI's key-less build must still run.
 */
function AuthProvider({ children }: { children: ReactNode }) {
  return isClerkConfigured() ? <ClerkProvider>{children}</ClerkProvider> : <>{children}</>;
}
