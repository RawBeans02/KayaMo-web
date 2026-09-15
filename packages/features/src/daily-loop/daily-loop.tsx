'use client';

import { isWithinQuietHours, notificationDelivery } from '@kayamo/core';
import { createBrowserSupabase, getProfile } from '@kayamo/db';
import {
  completeLocalEveningReflection,
  createLocalFocusSession,
  finishLocalFocusSession,
  getLocalDailyLoopPreferences,
  getLocalDailyPlan,
  listLocalFocusSessions,
  listLocalScripture,
  logicalDateFromInstant,
  recoverClosedOfflineDb,
  saveLocalDailyLoopPreferences,
  saveLocalDailyPlan,
  saveLocalJournalEntry,
  startLocalFocusSession,
  type LocalDailyLoopPreference,
  type LocalDailyPlan,
  type LocalFocusSession,
  type LocalScripturePassage,
} from '@kayamo/offline';
import { Button } from '@kayamo/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/api-origin';
import type { NativePorts } from '../ports';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function localTime(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
}

function remainingLabel(endsAt: string | null, nowMs: number): string {
  if (!endsAt) return 'Ready';
  const seconds = Math.max(0, Math.ceil((Date.parse(endsAt) - nowMs) / 1_000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function vapidKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function DailyLoop({ userId, native }: { userId: string; native: NativePorts }) {
  const [timeZone, setTimeZone] = useState('Asia/Manila');
  const [dayStartsAt, setDayStartsAt] = useState('00:00:00');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [plan, setPlan] = useState<LocalDailyPlan | null>(null);
  const [sessions, setSessions] = useState<LocalFocusSession[]>([]);
  const [preferences, setPreferences] = useState<LocalDailyLoopPreference | null>(null);
  const [scripture, setScripture] = useState<LocalScripturePassage[]>([]);
  const [action, setAction] = useState('');
  const [reflection, setReflection] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [prayer, setPrayer] = useState('');
  const [nudge, setNudge] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const today = logicalDateFromInstant(now.toISOString(), timeZone, dayStartsAt);
  const active = sessions.find((row) => row.status === 'active') ?? null;
  const faithEnabled = preferences?.faith_enabled ?? false;

  const hydrate = useCallback(async (date: string, faith: boolean) => {
    await recoverClosedOfflineDb(async () => {
      const [nextPlan, nextSessions, passages] = await Promise.all([
        getLocalDailyPlan(userId, date),
        listLocalFocusSessions(userId, date),
        listLocalScripture({ faithEnabled: faith }),
      ]);
      setPlan(nextPlan);
      setSessions(nextSessions);
      setScripture(passages);
    });
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    localStorage.setItem('kayamo:last-user-id', userId);
    async function loadLocalFirst() {
      try {
        const prefs = await recoverClosedOfflineDb(() => getLocalDailyLoopPreferences(userId));
        if (cancelled) return;
        setPreferences(prefs);
        await hydrate(
          logicalDateFromInstant(new Date().toISOString(), 'Asia/Manila', '00:00:00'),
          prefs?.faith_enabled ?? false,
        );
      } catch {
        // IndexedDB can close during auth/scope switch.
      }
    }
    async function refreshProfile() {
      try {
        const profile = await getProfile(createBrowserSupabase(), userId);
        if (cancelled || !profile) return;
        const tz = profile.timezone || 'Asia/Manila';
        const start = profile.day_starts_at || '00:00:00';
        setTimeZone(tz);
        setDayStartsAt(start);
        const prefs = await getLocalDailyLoopPreferences(userId);
        await hydrate(
          logicalDateFromInstant(new Date().toISOString(), tz, start),
          prefs?.faith_enabled ?? false,
        );
      } catch {
        // The local loop is already ready; remote profile refresh can wait.
      }
    }
    void loadLocalFirst();
    void refreshProfile();
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, [hydrate, userId]);

  const scheduledNudge = useMemo(() => {
    if (!preferences?.notifications_enabled) return null;
    const current = localTime(now, timeZone);
    const quiet = isWithinQuietHours(
      current, preferences.quiet_starts_at, preferences.quiet_ends_at,
    );
    const permission = 'Notification' in globalThis
      ? Notification.permission
      : 'unsupported';
    if (notificationDelivery({ enabled: true, quiet, permission }).channel !== 'in_app') {
      return null;
    }
    if (current === preferences.morning_reminder_at.slice(0, 5)) {
      return 'Kai’s morning check-in is ready here in KayaMo.';
    }
    if (current === preferences.evening_reminder_at.slice(0, 5)) {
      return 'Your evening reflection is ready here in KayaMo.';
    }
    return null;
  }, [now, preferences, timeZone]);

  useEffect(() => {
    if (!preferences?.notifications_enabled) return;
    const current = localTime(now, timeZone);
    const kind = current === preferences.morning_reminder_at.slice(0, 5)
      ? 'morning'
      : current === preferences.evening_reminder_at.slice(0, 5)
        ? 'evening'
        : null;
    if (!kind) return;
    const marker = `kayamo:nudge:${userId}:${today}:${kind}`;
    if (localStorage.getItem(marker)) return;
    const quiet = isWithinQuietHours(
      current, preferences.quiet_starts_at, preferences.quiet_ends_at,
    );
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    const delivery = notificationDelivery({ enabled: true, quiet, permission });
    if (delivery.channel === 'system') {
      void navigator.serviceWorker?.ready.then((registration) =>
        registration.showNotification(
          kind === 'morning' ? 'Choose one honest step' : 'Close the day gently',
          {
            body: kind === 'morning'
              ? 'Open KayaMo when you are ready to plan.'
              : 'Your reflection can be brief, and it stays on this device.',
            icon: '/icon.svg', tag: `kayamo-${kind}-${today}`,
          },
        ),
      );
    }
    localStorage.setItem(marker, 'shown');
  }, [now, preferences, timeZone, today, userId]);

  async function planMorning() {
    const label = action.trim();
    if (!label) return;
    const row = await saveLocalDailyPlan({
      userId, logicalDate: today, actionKind: 'custom', label, completeMorning: true,
    });
    setPlan(row);
    setAction('');
    setNotice('Today has one clear next action. Kai will not change it without you.');
  }

  async function startFocus() {
    if (!plan?.selected_action_kind || !plan.selected_label_snapshot) return;
    const scheduled = await createLocalFocusSession({
      userId, logicalDate: today, dailyPlanId: plan.id,
      targetKind: plan.selected_action_kind,
      targetRecordId: plan.selected_record_id,
      targetLabel: plan.selected_label_snapshot, plannedMinutes: 25,
    });
    const row = await startLocalFocusSession({ id: scheduled.id, userId });
    if (row) setSessions((current) => [...current, row]);
  }

  async function endFocus(outcome: 'completed' | 'cancelled') {
    if (!active) return;
    const row = await finishLocalFocusSession({ id: active.id, userId, outcome });
    if (!row) return;
    setSessions((current) => current.map((item) => item.id === row.id ? row : item));
    setNotice(outcome === 'completed' ? 'Focus complete. Honest effort counts.' : 'Focus stopped. You can return without penalty.');
  }

  async function saveReflection() {
    const row = await completeLocalEveningReflection({
      userId, logicalDate: today, reflection, gratitude,
    });
    setPlan(row);
    setReflection('');
    setGratitude('');
    setNotice('Reflection saved only on this device.');
  }

  async function toggleFaith(enabled: boolean) {
    const row = await saveLocalDailyLoopPreferences({ userId, faithEnabled: enabled });
    setPreferences(row);
    setScripture(await listLocalScripture({ faithEnabled: enabled }));
  }

  async function savePrayer() {
    if (!prayer.trim()) return;
    await saveLocalJournalEntry({ userId, kind: 'prayer', content: prayer });
    setPrayer('');
    setNotice('Prayer saved only on this device.');
  }

  async function enableNotifications() {
    if (native.isNativeApp()) {
      const token = await native.registerPushIfNative?.();
      const row = await saveLocalDailyLoopPreferences({
        userId, notificationsEnabled: true,
      });
      setPreferences(row);
      if (!token) {
        setNudge('Notifications stayed off. You can enable them in system settings.');
      }
      return;
    }
    const permission = 'Notification' in window
      ? await Notification.requestPermission()
      : 'unsupported';
    const row = await saveLocalDailyLoopPreferences({
      userId, notificationsEnabled: true,
    });
    setPreferences(row);
    const quiet = isWithinQuietHours(
      localTime(new Date(), timeZone), row.quiet_starts_at, row.quiet_ends_at,
    );
    const delivery = notificationDelivery({ enabled: true, quiet, permission });
    if (delivery.channel === 'system') {
      const registration = await navigator.serviceWorker?.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
      if (registration && publicKey && 'PushManager' in window) {
        const subscription = (await registration.pushManager.getSubscription()) ??
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey(publicKey),
          });
        await apiFetch('/api/notifications/subscriptions', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });
      }
      await registration?.showNotification('Kai is ready', {
        body: 'Notifications are on. Quiet hours will always be respected.',
        icon: '/icon.svg', tag: 'kayamo-permission-confirmed',
      });
    } else if (delivery.channel === 'in_app') {
      setNudge('Browser notifications are unavailable. Kai’s reminders will stay inside KayaMo.');
    } else {
      setNudge('Quiet hours are active. No reminder was sent.');
    }
  }

  async function disableNotifications() {
    const registration = await navigator.serviceWorker?.ready;
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) {
      await apiFetch('/api/notifications/subscriptions', {
        method: 'DELETE', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => undefined);
      await subscription.unsubscribe();
    }
    const row = await saveLocalDailyLoopPreferences({
      userId, notificationsEnabled: false,
    });
    setPreferences(row);
    setNudge(null);
  }

  async function updateReminderTimes(values: {
    morningReminderAt?: string;
    eveningReminderAt?: string;
    quietStartsAt?: string;
    quietEndsAt?: string;
  }) {
    setPreferences(await saveLocalDailyLoopPreferences({ userId, ...values }));
  }

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    setNotice('On iPhone or iPad, use Share → Add to Home Screen. On desktop, use your browser’s Install option.');
  }

  return (
    <section aria-labelledby="daily-loop-title" className="mt-6 border-y border-line py-5">
      <p className="font-data text-caption uppercase tracking-[0.14em] text-muted">Plan · focus · reflect</p>
      <h2 id="daily-loop-title" className="mt-1 font-body text-heading">One honest step</h2>

      {!plan?.morning_completed_at ? (
        <div className="mt-4 flex flex-col gap-3">
          <label htmlFor="next-action" className="font-body text-body">What is the one action that would help today?</label>
          <input id="next-action" value={action} onChange={(event) => setAction(event.target.value)} maxLength={160}
            className="min-h-12 rounded-md border border-line bg-surface px-3 font-body text-body" />
          <Button type="button" size="md" onClick={() => void planMorning()} disabled={!action.trim()}>Choose this action</Button>
        </div>
      ) : (
        <div className="mt-4">
          <p className="font-body text-body">{plan.selected_label_snapshot}</p>
          {active ? (
            <div className="mt-3 rounded-md bg-surface-2 p-4" aria-live="polite">
              <p className="font-data text-title">{remainingLabel(active.ends_at, nowMs)}</p>
              <p className="mt-1 font-body text-body text-muted">Timer and nudges only. KayaMo does not block other apps on the web.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" size="md" onClick={() => void endFocus('completed')}>Complete</Button>
                <Button type="button" variant="secondary" size="md" onClick={() => void endFocus('cancelled')}>Stop for now</Button>
              </div>
            </div>
          ) : (
            <Button className="mt-3" type="button" size="md" onClick={() => void startFocus()}>Focus for 25 minutes</Button>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <label htmlFor="reflection" className="font-body text-body">Evening reflection <span className="text-muted">(local only)</span></label>
            <textarea id="reflection" value={reflection} onChange={(event) => setReflection(event.target.value)} rows={3} maxLength={4000}
              className="rounded-md border border-line bg-surface p-3 font-body text-body" />
            <label htmlFor="gratitude" className="font-body text-body">One thing you are grateful for</label>
            <input id="gratitude" value={gratitude} onChange={(event) => setGratitude(event.target.value)} maxLength={1000}
              className="min-h-12 rounded-md border border-line bg-surface px-3 font-body text-body" />
            <Button type="button" variant="secondary" size="md" onClick={() => void saveReflection()}>Finish today</Button>
          </div>
        </div>
      )}

      <details className="mt-6 border-t border-line pt-4">
        <summary className="cursor-pointer font-body text-body">Daily-loop settings</summary>
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex min-h-12 items-center gap-3 font-body text-body">
            <input type="checkbox" checked={preferences?.notifications_enabled ?? false}
              onChange={(event) => void (event.target.checked ? enableNotifications() : disableNotifications())} />
            Enable reminders
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="font-body text-body">Morning
              <input aria-label="Morning reminder time" type="time"
                value={(preferences?.morning_reminder_at ?? '08:00:00').slice(0, 5)}
                onChange={(event) => void updateReminderTimes({ morningReminderAt: `${event.target.value}:00` })}
                className="mt-1 min-h-12 w-full rounded-md border border-line bg-surface px-2" />
            </label>
            <label className="font-body text-body">Evening
              <input aria-label="Evening reminder time" type="time"
                value={(preferences?.evening_reminder_at ?? '20:00:00').slice(0, 5)}
                onChange={(event) => void updateReminderTimes({ eveningReminderAt: `${event.target.value}:00` })}
                className="mt-1 min-h-12 w-full rounded-md border border-line bg-surface px-2" />
            </label>
            <label className="font-body text-body">Quiet from
              <input aria-label="Quiet hours start" type="time"
                value={(preferences?.quiet_starts_at ?? '22:00:00').slice(0, 5)}
                onChange={(event) => void updateReminderTimes({ quietStartsAt: `${event.target.value}:00` })}
                className="mt-1 min-h-12 w-full rounded-md border border-line bg-surface px-2" />
            </label>
            <label className="font-body text-body">Quiet until
              <input aria-label="Quiet hours end" type="time"
                value={(preferences?.quiet_ends_at ?? '07:00:00').slice(0, 5)}
                onChange={(event) => void updateReminderTimes({ quietEndsAt: `${event.target.value}:00` })}
                className="mt-1 min-h-12 w-full rounded-md border border-line bg-surface px-2" />
            </label>
          </div>
          {nudge ?? scheduledNudge ? <p role="status" className="font-body text-body text-muted">{nudge ?? scheduledNudge}</p> : null}
          <label className="flex min-h-12 items-center gap-3 font-body text-body">
            <input type="checkbox" checked={faithEnabled} onChange={(event) => void toggleFaith(event.target.checked)} />
            Include optional faith mode
          </label>
          <Button type="button" variant="secondary" size="md" onClick={() => void install()}>Install KayaMo</Button>
        </div>
      </details>

      {faithEnabled ? (
        <section aria-labelledby="faith-title" className="mt-6 rounded-md bg-surface-2 p-4">
          <h3 id="faith-title" className="font-body text-heading">Faith reflection</h3>
          {scripture[0] ? (
            <blockquote className="mt-3 font-body text-body">
              <p>{scripture[0].text}</p>
              <footer className="mt-2 font-data text-caption text-muted">{scripture[0].reference} · World English Bible</footer>
            </blockquote>
          ) : null}
          <label htmlFor="prayer" className="mt-5 block font-body text-body">Prayer journal <span className="text-muted">(local only)</span></label>
          <textarea id="prayer" value={prayer} onChange={(event) => setPrayer(event.target.value)} rows={3} maxLength={5000}
            className="mt-2 w-full rounded-md border border-line bg-surface p-3 font-body text-body" />
          <Button className="mt-3" type="button" variant="secondary" size="md" onClick={() => void savePrayer()}>Save prayer</Button>
          <p className="mt-3 font-data text-caption text-muted">Kai is a companion, not a theological authority. Generated text is never shown as a Bible quotation.</p>
        </section>
      ) : null}

      {notice ? <p role="status" className="mt-4 font-body text-body text-muted">{notice}</p> : null}
    </section>
  );
}
