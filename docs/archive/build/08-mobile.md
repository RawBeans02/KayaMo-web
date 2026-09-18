# Phase 8 — Mobile

**Chapters 29–32** · Week 8 · **Prerequisite:** Phase 7 complete and committed.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/08-mobile.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


## Chapter 29 — PWA hardening

**Effort:** high

### Prompt

```
Effort: high.

Harden the PWA before wrapping.

1. Manifest: name "KayaMo", short_name "KayaMo", id "ph.kayamo.app",
   maskable icons at all sizes, theme/background from the Chapter 2
   tokens, display standalone, orientation portrait,
   shortcuts for "Quick log" and "Log weight".
2. Service worker (Workbox): app shell precache, stale-while-revalidate
   for food lookups, network-first for API, offline fallback page.
3. iOS-specific handling — document each in code comments:
   - No Background Sync → sync on visibilitychange and focus
   - Web Push only when installed to home screen
   - Tighter storage quota → cap the Dexie food cache with LRU eviction
   - Safe-area insets for the notch and home indicator
   - Disable the pull-to-refresh gesture where it fights the UI
4. Lighthouse: PWA installable, performance > 90 on a mid-tier Android
   profile with 4G throttling. Fix what fails.
5. Custom install prompts, platform-aware (Android beforeinstallprompt,
   iOS instructional sheet).

Test on a real mid-range Android and a real iPhone. Not simulators.
```

**Done when:** installed from the home screen on both platforms, works offline, and push arrives on Android.

---

## Chapter 30 — Capacitor wrap

**Effort:** high

Capacitor over React Native here: it embeds your existing web build, so you ship the same codebase instead of rewriting the UI.

### Prompt

```
Effort: high.

Wrap KayaMo with Capacitor.

1. Add Capacitor, configure appId 'ph.kayamo.app', appName 'KayaMo'.
   Add android and ios platforms.
2. Static export or server-hosted webDir — pick one and justify it in a
   comment. Live-update from a remote URL is convenient but interacts
   badly with App Store review; prefer bundling the build.
3. Native plugins to install and wire behind a capability-detecting
   abstraction in apps/mobile/src/native/ (so the same code paths work in the
   plain PWA):
   - @capacitor/camera (better photo capture than getUserMedia)
   - @capacitor-mlkit/barcode-scanning (much better than the web fallback)
   - @capacitor/push-notifications (real APNs/FCM, not Web Push)
   - @capacitor/haptics, @capacitor/status-bar, @capacitor/splash-screen,
     @capacitor/preferences, @capacitor/share
   - @capacitor/local-notifications for the rest timer
4. Deep links: kayamo:// and https://kayamo.ph app links / universal links.
5. Keep every native call behind the abstraction. The web build must
   continue to work unchanged.
```

---

## Chapter 31 — Health data sync

**Effort:** high

This is the payoff for wrapping. HealthKit and Health Connect are OS frameworks — a browser cannot touch them, which is precisely why this chapter comes after Capacitor. Note that Google Fit is deprecated; target Health Connect on Android.

### Prompt

```
Effort: high.

Add health platform sync via Capacitor.

1. Install @capgo/capacitor-health (or the current best-maintained
   equivalent — check first). Configure HealthKit entitlements on iOS
   and Health Connect permissions on Android.
2. READ these types: steps, active energy, workouts, body weight,
   heart rate, sleep duration.
3. WRITE back: body weight (from our manual log), nutrition
   (energy + macros) so other apps see it. Write is opt-in per type.
4. Import rules — this matters:
   - Weight from Health syncs into weight_logs with source='health_sync'.
     Dedupe against manual entries on the same day (manual wins).
   - Workouts import as sessions but do NOT overwrite logged sets.
   - Active energy is displayed as CONTEXT ONLY. It never enters the
     adaptive TDEE calculation (Chapter 18). Add a code comment and a
     test asserting this.
   - Sleep and resting HR feed the readiness/fatigue proxies only.
5. Permission UX: explain what each type is used for at the moment of
   the ask, and function fully if the user grants nothing.
6. iOS requires NSHealthShareUsageDescription and
   NSHealthUpdateUsageDescription strings that describe actual use —
   vague strings get rejected.
```

**Watch out:** Health Connect permission flows differ across Android versions. Test on Android 13 and 14+.

---

## Chapter 32 — Store submission

**Effort:** medium

A thin webview wrapper is a real rejection risk under Apple's guideline 4.2 (minimum functionality). Chapters 30 and 31 are what earn approval — make sure the review notes point at them.

### Prompt

```
Effort: medium.

Prepare both store submissions.

ANDROID (Play Console):
- Signed AAB, versionCode/versionName strategy documented in AGENTS.md
  (follow the KitaMo pattern: freeze a versionCode per internal test build)
- Data safety form: declare health/fitness data collection, encryption in
  transit and at rest, and the deletion path
- Health Connect declaration form — required, and rejections here are
  common; describe the exact data types and use
- Internal testing track first, then closed, then production

iOS (App Store Connect):
- Privacy nutrition labels covering health + fitness data
- Health app usage descriptions
- Review notes that explicitly list native functionality: health sync,
  ML Kit barcode scanning, native camera, local + push notifications,
  offline logging, haptics — this is the guideline 4.2 defense
- Demo account with seeded data for the reviewer
- Age rating and a "not a medical device" statement

BOTH:
- Screenshots at required sizes from the real app (use the browser tool
  to generate consistent framing)
- Store copy that makes NO accuracy claims about photo estimation and NO
  health outcome promises
- Privacy policy + terms hosted at kayamo.ph, referenced from in-app
- Account deletion flow reachable in-app (both stores now require it)
```

---
