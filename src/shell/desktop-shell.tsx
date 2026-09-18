'use client';

import {
  BotanicalIcon,
  CommandLog,
  GymRestBar,
  GymSessionProvider,
  OPEN_LOG_EVENT,
  prefillLogPalette,
  type BotanicalIconName,
} from '@kayamo/features/desktop';
import { SyncStatusBar } from '@kayamo/features/desktop';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { paintKayamoTheme, resolveKayamoTheme } from './theme';
import { GlassToast, LogSheet, openLogSheet } from './log-sheet';
import styles from './glass-shell.module.css';

/**
 * Desktop rail: the full map. Profile is pinned to the bottom, away from the
 * content nav, matching the platform convention.
 *
 * Gym and Todos are off the rail and the Life hub for the first release
 * (owner decision, 2026-09-18): both routes still resolve, but they render the
 * legacy desk skin and are not offered as destinations until converted.
 */
const RAIL: Array<{ href: string; label: string; icon: BotanicalIconName }> = [
  { href: '/today', label: 'Home', icon: 'home' },
  { href: '/life', label: 'Life', icon: 'life' },
  { href: '/calories', label: 'Food', icon: 'food' },
  { href: '/goals', label: 'Goals', icon: 'goals' },
  { href: '/grove', label: 'Grove', icon: 'grove' },
  { href: '/mus', label: 'Lis', icon: 'lis' },
];

/**
 * Phone tab bar: five slots, Home far left, Profile far right, create in the
 * centre. Food, Goals and Grove live one level down under Life.
 */
const TABS: Array<{ href: string; label: string; icon: BotanicalIconName }> = [
  { href: '/today', label: 'Home', icon: 'home' },
  { href: '/life', label: 'Life', icon: 'life' },
  { href: '/mus', label: 'Lis', icon: 'lis' },
  { href: '/settings', label: 'Profile', icon: 'profile' },
];

/** Routes that live under the Life hub, so the hub stays lit while inside. */
const LIFE_ROUTES = ['/life', '/calories', '/foods', '/verify', '/goals', '/grove'];

function isActive(pathname: string, href: string, hubAware: boolean): boolean {
  if (href === '/today') return ['/today', '/todos'].includes(pathname);
  if (href === '/life') {
    return hubAware ? LIFE_ROUTES.includes(pathname) : pathname === '/life';
  }
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);

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
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        router.push('/mus');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const showToast = useCallback((text: string, undo?: () => void) => {
    setToast({ text, undo });
  }, []);

  // Meal text goes to the food palette, which owns catalog resolution.
  const onMeal = useCallback((draft: string) => {
    prefillLogPalette(draft);
  }, []);

  const onWorkout = useCallback(() => router.push('/gym'), [router]);

  return (
    <GymSessionProvider userId={userId}>
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>

      <div className={styles.shell} data-desk-shell="">
        <aside className={`${styles.rail} kgPanel`} data-shell="sidebar">
          <Link href="/today" className={styles.brand}>
            <span className={styles.mark} aria-hidden="true" />
            KayaMo
          </Link>

          <button
            type="button"
            className={`${styles.railLog} kgAccent`}
            onClick={() => openLogSheet('task')}
          >
            <BotanicalIcon name="plus" size={18} weight="bold" />
            Log
          </button>

          <nav className={styles.nav} aria-label="Sections">
            {RAIL.map((link) => {
              const current = isActive(pathname, link.href, false);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? 'page' : undefined}
                >
                  <BotanicalIcon
                    name={link.icon}
                    size={20}
                    weight={current ? 'fill' : 'regular'}
                  />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className={styles.railFoot} data-shell="sidebar-footer">
            <Link
              href="/settings"
              className={styles.railProfile}
              aria-current={pathname === '/settings' ? 'page' : undefined}
            >
              <BotanicalIcon
                name="profile"
                size={20}
                weight={pathname === '/settings' ? 'fill' : 'regular'}
              />
              <span>Profile</span>
            </Link>
            {guest ? (
              <p
                className={styles.railMeta}
                data-testid="sync-status"
                data-sync-kind="local_only"
              >
                Saved on this device · demo
              </p>
            ) : (
              <p className={styles.railMeta}>
                <SyncStatusBar />
              </p>
            )}
            <p className={styles.railMeta} title={email}>
              {guest ? 'Demo' : email}
            </p>
          </div>
        </aside>

        <div className={styles.mainStack}>
          {guest && (
            <p className={`${styles.demoBar} kgSurface`} data-shell="demo-bar">
              <span className={styles.demoTag}>Demo</span>
              <span>
                Demo entries stay in this browser. Clearing browser data removes them.
              </span>
              <a href="/login?from=demo">Sign in · demo entries won’t transfer</a>
            </p>
          )}

          <div className={styles.phoneHeader}>
            <Link href="/today" className={styles.brand}>
              <span className={styles.mark} aria-hidden="true" />
              KayaMo
            </Link>
            <button
              type="button"
              className="kgGhost"
              style={{ minHeight: 40, padding: '0 16px', fontSize: 14 }}
              onClick={() => router.push('/mus')}
            >
              <BotanicalIcon name="lis" size={17} />
              Ask Lis
            </button>
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

        <nav
          className={`${styles.tabBar} kgHeavy`}
          aria-label="Main"
          data-sheet={sheetOpen ? 'true' : 'false'}
        >
          {TABS.slice(0, 2).map((tab) => {
            const current = isActive(pathname, tab.href, true);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={styles.tab}
                aria-current={current ? 'page' : undefined}
              >
                <BotanicalIcon
                  name={tab.icon}
                  size={22}
                  weight={current ? 'fill' : 'regular'}
                />
                <span>{tab.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            className={styles.tabAdd}
            aria-label="Log"
            onClick={() => openLogSheet('task')}
          >
            <BotanicalIcon name="plus" size={24} weight="bold" />
          </button>

          {TABS.slice(2).map((tab) => {
            const current = isActive(pathname, tab.href, true);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={styles.tab}
                aria-current={current ? 'page' : undefined}
              >
                <BotanicalIcon
                  name={tab.icon}
                  size={22}
                  weight={current ? 'fill' : 'regular'}
                />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <LogSheet
          userId={userId}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onToast={showToast}
          onMeal={onMeal}
          onWorkout={onWorkout}
        />

        {toast ? (
          <GlassToast
            text={toast.text}
            onUndo={toast.undo}
            onDone={() => setToast(null)}
          />
        ) : null}

        <CommandLog userId={userId} onLeave={(href) => router.push(href)} />
      </div>
    </GymSessionProvider>
  );
}

/** Desktop header action, used by screens that want the create affordance. */
export function openDesktopLog(): void {
  window.dispatchEvent(new Event(OPEN_LOG_EVENT));
}
