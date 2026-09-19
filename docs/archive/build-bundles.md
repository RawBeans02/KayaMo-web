# KayaMo AI Companion — nine-bundle roadmap

> KayaMo is an AI companion that helps adults rebuild consistency by turning
> tasks, health, focus, faith, and long-term goals into one supportive daily
> relationship.

Coco is the relationship layer. Product records provide confirmed context, not
permission for Coco to control the user. Coco may propose actions, but every write
or commitment requires user confirmation. Missed days never punish Coco or the
user.

## Product contract

- Primary navigation is **Home**, **Today**, **Health**, and **Journey**, with a
  floating Coco entry point.
- Home is Coco's habitat and presents one recommended next action. Today combines
  tasks, routines, planning, and focus. Health contains food, weight, and training.
  Journey contains goals, achievements, growth, and optional faith features.
- English is the first complete experience. Taglish follows without removing the
  Filipino food dataset.
- Diary, venting, prayer-journal, and reflection text stays local by default. Only
  content explicitly marked **Remember this** becomes synced memory.
- Every new syncable record follows the cursor/LWW/tombstone contract. Every new
  user-owned table has own-row RLS and cross-user isolation tests.
- Faith mode is explicit opt-in, always available, and never gamified. Generated
  text is never presented as Scripture or theological authority.
- Progress rewards completion, consistency, recovery, and honest logging. It never
  rewards restriction, weight-loss magnitude, exercising through pain, or perfect
  streaks.

## Definition of done

Every bundle passes root lint, typecheck, tests, the relevant builds and database
tests, offline-sync tests, and mobile-width accessibility checks. External gates
such as hardware, provider credentials, native entitlements, signing, billing, and
store review remain recorded separately.

## Bundle 0 — Foundation

**Status:** Code complete; real-device barcode verification remains open.

Preserve the current database, RLS, offline-sync, migration, and barcode work.
Retain trigger-owned sync cursors, bounded client timestamps, tombstones, stable
logical dates, snapshots, corrected expenditure revisions, and stored Brzycki
e1RM.

## Bundle 1 — Coco-first product reset

**Status:** In progress — backend foundation implemented; visual alignment and UI
remain open.

- Replace the tracker positioning, information architecture, onboarding, metadata,
  and empty Coco chat.
- Select one of exactly three mobile visual directions before changing application
  UI. The selected system uses blue-white day mode, purple-green night mode, and
  restrained Apple Liquid Glass principles.
- Build the four-tab shell and seed-to-tree Coco habitat.
- Add tasks, routines, deterministic daily context, and one recommended next action.
- Let Coco acknowledge only confirmed task, routine, food, and workout activity,
  including offline activity.

**Implemented backend slice (2026-08-22):** Drizzle schema and migration for tasks,
routines, and routine completions; own-row RLS; typed queries; optional planning
seed fixtures; Dexie v3 tables and queue handlers; task/routine tombstones; stale
round-trip tests; cross-user fixtures; and pure deterministic daily context in
`@kayamo/core`. No application UI was changed.

## Bundle 2 — Governed Coco intelligence

**Status:** Backend code complete; live provider smoke test, live Supabase RLS run,
and designed UI remain open.

Add typed context, response, proposal, tool, memory, citation, and safety contracts;
the centralized AI router; Zod validation; budgets; retries; content-free telemetry;
fallbacks; conversations; explicit memories; deletion; diary/vent mode; and local
journals. Coco reads only permitted context and cannot mutate without confirmation.

**Implemented backend slice (2026-08-22):** Server-only OpenAI Responses adapter;
validated Coco router with authorization, safety interception, budget enforcement,
retry/timeout behavior, and deterministic fallbacks; content-free agent telemetry;
syncable conversations and explicit memories; local-only diary, vent, and prayer
journals; own-row RLS and tombstones; offline queue/merge support; and tests for
invalid output, invented citations, unconfirmed actions, private journal isolation,
cross-user isolation, and stale resurrection prevention. No application UI was
changed and no paid provider call was made.

## Bundle 3 — Nutrition and personal guidance

**Status:** Backend code complete; designed trend/target UI, live Supabase RLS run,
and real-device barcode verification remain open.

Complete food logging, barcode/search/manual entry, weight history, trends,
expenditure revisions, targets, macro guidance, timezone, and day-boundary settings.
All nutrition numbers remain resolver- or code-derived with source and confidence.

**Implemented backend slice (2026-08-22):** Time-aware EWMA weight trend;
Mifflin-St Jeor/Katch-McArdle cold start; completeness-weighted adaptive expenditure
with confidence intervals and a four-persona 12-week simulation; immutable
backfill revisions; code-derived day-type calorie/macro targets; application and
database enforcement of the 1200/1500 kcal floors, 1% weekly-loss ceiling, 25%
deficit ceiling, and 0.5 g/kg fat floor; source/confidence provenance; IANA timezone
validation; explicit local/server logical-date recompute; offline weight backfill,
tombstone, and stale-resurrection tests; and authenticated expenditure/target API
routes. Coco receives only stored guidance and may explain it with grounded
citations—it does not calculate nutrition values. No application UI was changed.

## Bundle 4 — Fitness helper

**Status:** Backend code complete; designed training UI, reviewed form-media assets,
and live Supabase RLS/trigger execution remain open.

Add the exercise library, plans, form-reference media, active workout logging, rest
timer, history, progression suggestions, fatigue signals, and deload rules. Persist
Brzycki e1RM at write time and recalculate only when its source set changes. Camera
form analysis remains outside v1.

**Implemented backend slice (2026-08-22):** Canonical exercise seed library with
aliases, muscle/equipment/pattern metadata, rep ranges, form cues, and common
mistakes; syncable user exercises, workout plans, plan exercises, active workouts,
and completed sets; own-row RLS and irreversible tombstones; exercise-name
snapshots; supersets, drop sets, rest prescriptions, and persisted force-close-safe
rest timers; trigger-derived ownership and stored Epley/Brzycki estimates that only
recalculate when weight or reps change; double-progression, three-session stall,
fatigue, deload, hard-set volume, and Philippine plate-loading helpers; authenticated
history/progression queries; offline completion and deletion round-trip tests; and
Coco citations restricted to confirmed workout context. Licensed form-reference
media delivery remains an explicit content gate rather than shipping unreviewed
third-party assets. No application UI was changed.

## Bundle 5 — Goals, achievements, and companion growth

**Status:** Backend code complete; designed Journey/Coco-growth UI and live
Supabase RLS/trigger execution remain open.

Add confirmed goals, milestones, habits, campaigns, chapters, an idempotent
companion-event ledger, achievements, evolution stages, and cosmetics. Duplicate
events never award twice; recovery after a lapse is positive progress.

**Implemented backend slice (2026-08-22):** Syncable goals, short campaigns,
long-term chapters, milestones, habits, and habit completions; own-row RLS,
server-derived child ownership, tombstone cascades, and stale-resurrection tests;
an append-only companion ledger whose stable keys and server validation bind every
reward to a confirmed source action; deterministic, nonnegative reward rules that
exclude calorie restriction, weight change, performance magnitude, pain, and
perfect streaks; explicit recovery-return events; traceable achievement and
cosmetic unlock records; seed, sprout, sapling, young-tree, and flourishing-tree
stages; idempotent stage/achievement/cosmetic seeds; offline event reduction and
growth; and Coco context/proposals constrained to confirmed goals and earned
progress. No application UI was changed.

## Bundle 6 — Plan–focus–reflect, faith, and production PWA

**Status:** Functional code complete; live Supabase RLS run, HTTPS push delivery,
installability/device matrix, and final visual/accessibility QA remain open.

Add morning planning, one-next-action focus, evening reflection, quiet hours,
notifications, service worker, installation, offline recovery, and web-push fallback.
PWA focus never claims to block other apps. Add opt-in contextual Scripture,
reflection, gratitude, and a local prayer journal.

**Implemented slice (2026-08-22):** Syncable daily plans, explicit focus sessions,
and daily-loop preferences with server-only cursors, LWW timestamps, tombstones,
own-row RLS, cross-user fixtures, and Dexie v7 queue handlers; deterministic
morning/day/evening, overnight quiet-hour, notification-delivery, and persisted
focus-clock rules; local-only reflection, gratitude, and prayer records; opt-in
faith gating in local storage, query helpers, Coco context, and citation
authorization; a human-reviewed tagged `engwebp` catalog sourced from eBible.org's
[public-domain World English Bible](https://ebible.org/engwebp/copyright.htm);
manifest, install guidance, privacy-safe service worker, offline daily-loop resume,
in-app notification fallback, push-subscription registration, and a minimal
mobile-width daily-loop surface. The PWA explicitly describes focus as a timer and
nudge, not app blocking. Final visual styling remains deferred to the selected
design direction.

## Bundle 7 — Android native experience

Build the Capacitor shell, secure storage, camera, notifications, deep links, Health
Connect, and exact-alarm integration. Alarm sound can always be silenced. App
blocking ships only after a native feasibility and Google Play policy proof; the
fallback is a transparent best-effort focus intervention.

## Bundle 8 — iOS, trust, and release candidate

Build the Capacitor iOS shell, HealthKit, secure storage, deep links, notifications,
supported AlarmKit integration, and notification fallback. Family Controls and
Managed Settings require Apple's distribution entitlement. Finish privacy controls,
local-journal export/deletion, content-free analytics, security/RLS audit,
accessibility, store declarations, entitlement scaffolding, and staged release
checklists. Paid checkout stays disabled during retention beta.

## Critical release scenario

Wake → Coco morning mission → accept today's next action → complete a task → log
food → complete a workout → earn progress → receive a grounded Coco follow-up.
