'use client';

import Image from 'next/image';
import { CommandLog, OPEN_LOG_EVENT } from '@kayamo/features/desktop';
import { SyncStatusBar } from '@kayamo/features';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { MusRailMount } from './mus-rail-mount';
import { SignOutButton } from './sign-out-button';
import { ThemeToggle } from './theme-toggle';
import styles from './shell.module.css';

const NAV = [
  { href: '/today', label: 'Today', glyph: '▤' },
  { href: '/foods', label: 'Foods', glyph: '▦' },
  { href: '/verify', label: 'Verify', glyph: '◈' },
  { href: '/gym', label: 'Gym', glyph: '▬' },
  { href: '/todos', label: 'Todos', glyph: '◻' },
  { href: '/mus', label: 'Mus', glyph: '◉' },
] as const;

const PHONE_FIRST = [
  { name: 'Goals', note: 'Goals stay on the phone until the desk has a layout for them.' },
  { name: 'Life', note: 'Life areas stay on the phone until the desk has a layout for them.' },
  { name: 'Grove', note: 'Grove stays on the phone until the desk has a layout for them.' },
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
}: {
  email: string;
  userId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hideRail = pathname === '/mus';
  const [railCollapsed, setRailCollapsed] = useState(false);

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
          Below 1280px, use the phone app. The desk does not collapse — it is
          deliberately desktop-only.
        </p>
      </div>
      <div className={styles.shell} data-desk-shell="" data-rail={railState}>
        <aside className={styles.sidebar}>
          <div className={styles.brandRow}>
            <div className={styles.brandAvatar}>
              <Image src="/mus-neutral.png" alt="" width={38} height={38} />
              <span className={styles.presence} aria-hidden="true" />
            </div>
            <div>
              <p className={styles.brand}>KayaMo</p>
              <p className={styles.brandMeta}>Manila · desk</p>
            </div>
          </div>

          <nav className={styles.nav} aria-label="Sections">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(pathname, link.href) ? 'page' : undefined}
              >
                <span aria-hidden="true" className={styles.glyph}>
                  {link.glyph}
                </span>
                <span>{link.label}</span>
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

          <div className={styles.footer}>
            <button type="button" className={styles.logFood} onClick={openFoodLog}>
              <span>Log food</span>
              <span className={styles.keys} aria-hidden="true">
                <kbd>⌘</kbd>
                <kbd>K</kbd>
              </span>
            </button>
            <p className={styles.syncLine}>
              <span className={styles.syncDot} aria-hidden="true" />
              <SyncStatusBar className={styles.syncText} />
            </p>
            <div className={styles.account}>
              <span className={styles.email} title={email}>
                {email}
              </span>
              <ThemeToggle />
            </div>
            <SignOutButton />
          </div>
        </aside>

        <div className={styles.main}>{children}</div>

        {hideRail ? null : (
          <MusRailMount
            pathname={pathname}
            collapsed={railCollapsed}
            onToggle={() => setRailCollapsed((value) => !value)}
          />
        )}

        <CommandLog userId={userId} />
      </div>
    </>
  );
}
