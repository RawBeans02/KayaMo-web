'use client';

import Image from 'next/image';
import {
  BotanicalIcon,
  CommandLog,
  GymRestBar,
  GymSessionProvider,
  OPEN_LOG_EVENT,
} from '@kayamo/features/desktop';
import { SyncStatusBar } from '@kayamo/features';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { paintKayamoTheme, resolveKayamoTheme } from './theme';
import styles from './botanical-shell.module.css';

const NAV = [
  { href: '/today', label: 'Home', icon: 'home' },
  { href: '/goals', label: 'Goals', icon: 'goals' },
  { href: '/life', label: 'Life', icon: 'life' },
  { href: '/grove', label: 'Grove', icon: 'grove' },
  { href: '/mus', label: 'Mus', icon: 'mus' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/today') return ['/today', '/todos'].includes(pathname);
  if (href === '/life')
    return ['/life', '/calories', '/gym', '/foods', '/verify'].includes(pathname);
  return pathname === href;
}

export function DesktopShell({
  email,
  userId,
  children,
  guest = false,
}: {
  email: string;
  userId: string;
  children: ReactNode;
  guest?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => paintKayamoTheme(resolveKayamoTheme());
    update();
    media.addEventListener('change', update);
    window.addEventListener('storage', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  useEffect(() => {
    const openMus = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        router.push('/mus');
      }
    };
    window.addEventListener('keydown', openMus);
    return () => window.removeEventListener('keydown', openMus);
  }, [router]);
  return (
    <GymSessionProvider userId={userId}>
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      <div className={styles.shell} data-desk-shell="" data-rail="off">
        <aside className={styles.sidebar} data-shell="sidebar">
          <Link href="/today" className={styles.brand}>
            <Image src="/botanical/seed-mark.webp" width={34} height={34} alt="" />
            KayaMo
          </Link>
          <nav className={styles.nav} aria-label="Sections">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(pathname, link.href) ? 'page' : undefined}
              >
                <BotanicalIcon name={link.icon} />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>
          <div className={styles.footer} data-shell="sidebar-footer">
            <button
              type="button"
              className={styles.settings}
              onClick={() => window.dispatchEvent(new Event(OPEN_LOG_EVENT))}
            >
              <BotanicalIcon name="food" />
              Log food
            </button>
            <Link
              href="/settings"
              className={styles.settings}
              aria-current={pathname === '/settings' ? 'page' : undefined}
            >
              <BotanicalIcon name="settings" />
              Settings
            </Link>
            {guest ? (
              <p data-testid="sync-status" data-sync-kind="local_only">
                Saved on this device · demo
              </p>
            ) : (
              <SyncStatusBar />
            )}
            <p title={email}>{guest ? 'A little room to grow.' : email}</p>
          </div>
        </aside>
        <div className={styles.mainStack}>
          {guest && (
            <p className={styles.demoBar} data-shell="demo-bar">
              <span className={styles.demoTag}>Demo</span>
              <span>
                Demo entries stay in this browser. Clearing browser data removes them.
              </span>
              <a href="/login?from=demo">Sign in · demo entries won’t transfer</a>
            </p>
          )}
          <div className={styles.mobileHeader}>
            <Link href="/today">
              <Image src="/botanical/seed-mark.webp" width={26} height={26} alt="" />
              KayaMo
            </Link>
            <Link href="/settings">
              <BotanicalIcon name="settings" size={20} />
              Settings
            </Link>
          </div>
          {pathname !== '/gym' && <GymRestBar />}
          <main
            id="main-content"
            tabIndex={-1}
            className={styles.main}
            data-shell="main"
            data-mus-page={pathname === '/mus' ? '' : undefined}
          >
            {children}
          </main>
        </div>
        <CommandLog userId={userId} onLeave={(href) => router.push(href)} />
      </div>
    </GymSessionProvider>
  );
}
