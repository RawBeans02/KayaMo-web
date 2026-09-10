'use client';

import Image from 'next/image';
import {
  CommandLog,
  GymRestBar,
  GymSessionProvider,
  OPEN_LOG_EVENT,
} from '@kayamo/features/desktop';
import { SyncStatusBar } from '@kayamo/features';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { MusRailMount } from './mus-rail-mount';
import { useNavCounts } from './use-nav-counts';
import { SignOutButton } from './sign-out-button';
import { LocaleToggle } from './locale-toggle';
import { ThemeToggle } from './theme-toggle';
import styles from './shell.module.css';

const NAV = [
  { href: '/today', label: 'Today', glyph: '▤', count: null },
  { href: '/gym', label: 'Gym', glyph: '▬', count: null },
  { href: '/todos', label: 'Todos', glyph: '◻', count: 'todos' },
  { href: '/mus', label: 'Mus', glyph: '◉', count: null },
] as const;

const CATALOG_NAV = [
  { href: '/foods', label: 'Foods', glyph: '▦', count: 'foods' },
  { href: '/verify', label: 'Verify', glyph: '◈', count: 'verify' },
] as const;

const PHONE_FIRST = [
  {
    name: 'Goals',
    note: 'Goals stay on the phone until the desk has a layout for them.',
  },
  {
    name: 'Life',
    note: 'Life areas stay on the phone until the desk has a layout for them.',
  },
  {
    name: 'Grove',
    note: 'Grove stays on the phone until the desk has a layout for them.',
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/today') return pathname === '/today' || pathname === '/calories';
  return pathname === href;
}

function openFoodLog(): void {
  window.dispatchEvent(new Event(OPEN_LOG_EVENT));
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
  /** No account: local-only, never synced. */
  guest?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navCounts = useNavCounts(userId);
  const hideRail = pathname === '/mus';
  const [railCollapsed, setRailCollapsed] = useState(true);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key !== '\\') return;
      event.preventDefault();
      setRailCollapsed((open) => !open);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const railState = hideRail ? 'off' : railCollapsed ? 'collapsed' : 'open';

  return (
    <>
      <div className={styles.narrow} role="dialog" aria-labelledby="narrow-title">
        <p className={styles.narrowEyebrow}>KayaMo desk</p>
        <h1 id="narrow-title">This surface needs a wide screen.</h1>
        <p>
          The diary and training tools need at least 960px of space. Widen this window to
          continue, or return to sign in.
        </p>
        <Link href={guest ? '/login?from=demo' : '/login'}>Back to sign in</Link>
      </div>
      <GymSessionProvider userId={userId}>
        <div className={styles.shell} data-desk-shell="" data-rail={railState}>
          <aside className={styles.sidebar} data-shell="sidebar">
            <div className={styles.brandRow}>
              <div className={styles.brandAvatar}>
                <Image src="/mus-neutral.webp" alt="" width={38} height={38} />
                <span className={styles.presence} aria-hidden="true" />
              </div>
              <div>
                <p className={styles.brand}>KayaMo</p>
                <p className={styles.brandMeta}>Manila · desk</p>
              </div>
            </div>

            <nav className={styles.nav} aria-label="Sections">
              {NAV.map((link) => {
                const count = link.count ? navCounts[link.count] : null;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                  >
                    <span aria-hidden="true" className={styles.glyph}>
                      {link.glyph}
                    </span>
                    <span>{link.label}</span>
                    <span className={styles.navCount}>{count}</span>
                  </Link>
                );
              })}
              <p className={styles.navGroup}>Food catalog</p>
              {CATALOG_NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                >
                  <span aria-hidden="true" className={styles.glyph}>
                    {link.glyph}
                  </span>
                  <span>{link.label}</span>
                  <span className={styles.navCount}>{navCounts[link.count]}</span>
                </Link>
              ))}
            </nav>

            <div className={styles.phoneFirst}>
              <p className={styles.phoneLabel}>Phone-first for now</p>
              <ul>
                {PHONE_FIRST.map((item) => (
                  <li key={item.name} title={item.note}>
                    <span>{item.name}</span>
                    <span className={styles.onPhone}>on phone</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.footer} data-shell="sidebar-footer">
              <button type="button" className={styles.logFood} onClick={openFoodLog}>
                <span>Log food</span>
                <span className={styles.keys} aria-hidden="true">
                  <kbd>⌘</kbd>
                  <kbd>K</kbd>
                </span>
              </button>
              <p className={styles.syncLine}>
                <span className={styles.syncDot} aria-hidden="true" />
                {guest ? <span className={styles.syncText} data-testid="sync-status" data-sync-kind="local_only">Saved on this device · demo</span> : <SyncStatusBar className={styles.syncText} />}
              </p>
              <div className={styles.account}>
                <span className={styles.email} title={email}>
                  {email}
                </span>
                <LocaleToggle />
                <ThemeToggle />
              </div>
              {guest ? (
                <a className={styles.signOut} href="/login?from=demo">
                  Create an account
                </a>
              ) : (
                <SignOutButton />
              )}
            </div>
          </aside>

          <div className={styles.mainStack}>
            {guest ? (
              <p className={styles.demoBar} data-shell="demo-bar">
                <span className={styles.demoTag}>Demo</span>
                <span>
                  Demo entries stay in this browser. Clearing browser data removes them.
                </span>
                <a className={styles.demoCta} href="/login?from=demo">
                  Sign in · demo entries won’t transfer
                </a>
              </p>
            ) : null}
            {pathname === '/gym' ? null : <GymRestBar />}
            <div
              className={styles.main}
              data-shell="main"
              data-mus-page={pathname === '/mus' ? '' : undefined}
            >
              {children}
            </div>
          </div>

          {hideRail ? null : (
            <MusRailMount
              userId={userId}
              pathname={pathname}
              collapsed={railCollapsed}
              onToggle={() => setRailCollapsed((value) => !value)}
            />
          )}

          <CommandLog userId={userId} onLeave={(href) => router.push(href)} />
        </div>
      </GymSessionProvider>
    </>
  );
}
