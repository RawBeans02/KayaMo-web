'use client';

import { CommandLog } from '@kayamo/features/desktop';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { SignOutButton } from './sign-out-button';
import styles from './shell.module.css';

const LIVE = [
  { href: '/today', label: 'Dashboard' },
  { href: '/calories', label: 'Calories' },
  { href: '/gym', label: 'Gym' },
  { href: '/todos', label: 'Todos' },
  { href: '/mus', label: 'Mus' },
] as const;

const CATALOG = [
  { href: '/foods', label: 'Foods' },
  { href: '/verify', label: 'Verify' },
] as const;

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
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <p className={styles.brand}>KayaMo</p>
        <nav className={styles.nav} aria-label="Desktop">
          {LIVE.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <nav className={styles.subnav} aria-label="Catalog">
          {CATALOG.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className={styles.hint}>
          {email}
          <br />
          Command palette <span className={styles.k}>⌘K</span>
        </p>
        <SignOutButton />
      </aside>
      <div className={styles.main}>{children}</div>
      <CommandLog userId={userId} />
    </div>
  );
}
