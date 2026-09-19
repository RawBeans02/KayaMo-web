import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/shell/theme-toggle';
import {
  LEGAL_APPROVED_ON,
  LEGAL_ROUTES,
  LEGAL_UPDATED_ON,
  OPERATOR_NAME,
  SUPPORT_EMAIL,
} from '@/lib/legal';
import styles from './legal.module.css';

function longDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The frame every legal page renders in: the login's top bar, one glass
 * article, and a footer that links the three pages to each other. The draft
 * banner is on until the owner records an approval date in src/lib/legal.ts;
 * the pages are published early so what KayaMo intends is readable, not so
 * anyone mistakes a draft for a reviewed policy.
 */
export function LegalPage({
  current,
  eyebrow,
  title,
  children,
}: {
  current: (typeof LEGAL_ROUTES)[number]['href'];
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.viewport}>
      <header className={styles.nav}>
        <Link href="/" className={styles.wordmark} aria-label="KayaMo home">
          <span className={styles.wordmarkTile} aria-hidden="true" />
          KayaMo
        </Link>
        <nav className={styles.navActions} aria-label="Policies">
          {LEGAL_ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={styles.navLink}
              aria-current={route.href === current ? 'page' : undefined}
            >
              {route.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </header>

      <main className={styles.main} id="main-content">
        <article className={`${styles.article} kgSurface`} aria-labelledby="legal-title">
          <p className="kgEyebrow">{eyebrow}</p>
          <h1 id="legal-title">{title}</h1>
          <p className={styles.meta}>
            {LEGAL_APPROVED_ON
              ? `In effect since ${longDate(LEGAL_APPROVED_ON)}.`
              : `Written ${longDate(LEGAL_UPDATED_ON)}.`}{' '}
            Operated by {OPERATOR_NAME}. Questions:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
          {LEGAL_APPROVED_ON ? null : (
            <p className={styles.draft} role="note">
              <strong>Draft, under review.</strong>
              This page describes how KayaMo works today and what its operator
              intends. It has not yet been reviewed by a lawyer or formally
              approved, and it will be marked as in effect when it has.
            </p>
          )}
          {children}
        </article>
      </main>

      <footer className={styles.footer}>
        <span>KayaMo · personal growth, on your terms.</span>
        <nav className={styles.footerLinks} aria-label="Legal">
          {LEGAL_ROUTES.map((route) => (
            <Link key={route.href} href={route.href}>
              {route.label}
            </Link>
          ))}
          <Link href="/login">Sign in</Link>
        </nav>
      </footer>
    </div>
  );
}

/** Shared metadata shape for the three routes. */
export function legalMetadata(title: string, description: string) {
  return { title: `${title} | KayaMo`, description };
}
