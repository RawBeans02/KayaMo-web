# KayaMo desktop: whole-repository review

Review completed: 8 September 2026. Repository: /Users/rovs/Documents/KayaMo/kayamo-web. Base commit: 84cd856, plus the existing uncommitted and untracked work. This is a review and proposal, not an implementation pass.

## Verdict

**This project is not finished. I would not approve the current tree for a public release.** It has substantial reusable engineering and a recognizable visual identity, but its most important promises—trustworthy numbers, consent, continuity, and offline usefulness—are not consistently upheld by the composed desktop experience.

The problem is not simply that it needs more features. It needs fewer incomplete journeys, an enforceable definition of done, and a much stronger connection between what the interface promises and what the application actually does. More screens, more AI buttons, or another styling pass will not resolve that.

The strongest reasons are concrete:

- The current production build and typecheck fail.
- Desktop AI privacy controls promise distinctions that the server does not enforce.
- The server-paid AI budget depends on a client-selected date and user-editable accounting rows.
- Account creation promises demo-data continuity without implementing the transfer.
- Task editing can be reset every four seconds by background refreshes.
- Saved workout results can display planned numbers instead of actual recorded numbers after remount.
- Workout lifecycle state is inconsistent across the page, global timer, and logical-day boundary.
- The first-run demo reached a local-data error during this review.
- Settings, recovery, export, and account controls are not reachable as a coherent desktop journey.

This is a credible work-in-progress with serious integration gaps, not disposable work. Keep the good domain logic, resolver separation, offline primitives, schema validation, and design language. Fix the seams between them.

## Scope and evidence limits

The review covered the repository structure, desktop routes and composition, shared feature/domain/food/AI/offline/database/UI packages, migrations and policies, tests and CI, build scripts, product/design/build documentation, public assets and reference bundles. The tracked inventory contains 742 files. Critical state, privacy, persistence, and AI call paths received deeper code tracing. A read-only comparison against the prescribed shared source in kayamo-mobile was also performed.

“Whole-repository review” does not mean every generated file, dependency, image pixel, or line received equal-depth inspection. Dependencies and generated artifacts were not treated as first-party source. This is not a penetration test, clinical validation, legal opinion, full accessibility certification, or production deployment audit.

Evidence labels used below:

- **Reproduced:** command output or a visible browser state observed during this review.
- **Source-confirmed:** behavior follows from the current code path; not necessarily reproduced against a live account.
- **Product gap:** missing or intentionally limited experience that should change before the proposed release.
- **Recommendation:** proposed improvement, not an assertion that an existing implementation is defective.

The working tree was already heavily modified. Findings apply to that tree, not just HEAD. Earlier passing checks in this same review preceded recent edits and are not current release evidence. No production data, permissions, accounts, or deployments were changed. Shared source files were not edited.

## Verification results

| Check | Result | Meaning |
| --- | --- | --- |
| Production build, 8 Sep | FAIL | Two TS2532 errors in build-demo-catalog.ts, lines 33 and 34. Bundling completed, but the production build did not. |
| Typecheck, current-tree review | FAIL | Same unchecked buffer accesses. |
| Root unit tests, 8 Sep | 5 passed | Two root test files. |
| All shared-package tests, 8 Sep, no-bail run | 599 passed, 3 failed | UI 13, core 73, DB 10, offline 130, AI 53, features 137 passed; food 83 passed and 3 failed. |
| Combined unit tests | 604 passed, 3 failed | A substantial suite, but not a green release. |
| Lint | PASS on reviewed revision | Does not establish runtime correctness. |
| Earlier browser suite | 11 passed on an earlier revision | Not rerun as a full current-tree release suite. |
| Fresh demo browser check, 8 Sep | Local data error visible | Landing → demo worked, but diary showed local storage error and PH core still loading. |
| Live DB integration locally | Not run | CI defines a disposable Supabase migration/RLS integration lane; its current remote result was not inspected. |
| Live AI, cross-device, account upgrade, offline cold start | Not end-to-end verified | Source findings and required acceptance tests are listed below. |

The build also reported an AI SDK dynamic-dependency warning. Local tests reported a Node 20 deprecation warning from Supabase; CI uses Node 22. These are secondary to the actual failing gates, not evidence of a known exploitable dependency vulnerability.

## Priority definitions

- **P1 — release blocker:** privacy/consent, accounting integrity, data continuity, misleading saved results, or inability to build/use the promised primary journey.
- **P2 — required for a dependable daily-use release:** correctness at boundaries, recovery, navigation, accessibility, operational readiness.
- **P3 — improvement:** polish, maintainability, broader capability, or optimization after correctness.

Priority is not a claim about exploit prevalence. Source-confirmed security findings were not exercised against a deployed database.

## Release blockers and correctness findings

### 1. P1 — The current tree cannot produce a successful production build

**Reproduced.** [build-demo-catalog.ts:33](/Users/rovs/Documents/KayaMo/kayamo-web/scripts/build-demo-catalog.ts:33) performs bitwise operations on indexed buffer values that strict TypeScript treats as potentially undefined. Both the standalone typecheck and production build reject lines 33–34.

**Change:** use a correctly typed, validated deterministic UUID implementation, or explicitly prove the buffer/index invariant. Keep strict checking enabled. Add tests for deterministic IDs, valid UUID shape/version, collisions across foods/servings, and stable relationships across regeneration.

**Acceptance:** install from the lockfile in a clean checkout, regenerate required assets, and pass typecheck, lint, unit tests, and production build. A dev server rendering a page does not satisfy this gate.

### 2. P1 — “Food log: never” does not reliably exclude food-derived AI context

**Source-confirmed.** [perm-levels.ts:4](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/mus/perm-levels.ts:4) maps Today/food, Foods, Verify, and Gym onto one physical_self domain. [Line 79](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/mus/perm-levels.ts:79) enables that domain if any mapped module is readable. [server-context.ts:85](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/mus/server-context.ts:85) loads food, weight, workouts, targets, and expenditure together.

Consequently, leaving Gym readable while setting the food log to never can still permit food/weight-derived model context. The provider receives derived summaries, not all raw food descriptions or numeric weight records; that distinction matters, but does not make the control truthful.

**Change:** make the permission model match the UI's actual granularity, with server-side field/domain filtering and explicit scope descriptions. Alternatively, expose one accurately named physical-data permission until finer controls genuinely exist. Do not silently make an unrelated permission change authorize more health context.

**Acceptance:** deny food while allowing gym; assert that all food-derived fields are absent from the provider request. Repeat every mixed permission combination and account/device transition.

### 3. P1 — Permission updates can appear successful when persistence failed

**Source-confirmed.** [mus-rail.tsx:90](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/mus-rail.tsx:90) changes local state immediately and discards server-write failures. The rail initializes from local storage, rather than reconciling acknowledged server permissions. Its readable-module count can therefore disagree with actual server state.

The server's permission defaults are correctly false and its gateway fails closed. The defect is the desktop's representation and update flow, not an absence of server authorization.

**Change:** load authoritative state, represent loading/pending/failed/saved states, await revocation, and retain the restrictive effective setting during uncertainty. Explain scope and consent without ambiguous “suggest/edit/edit with approval” levels whose behavior overlaps. Keep confirmation as the default for writes.

**Acceptance:** failed grant, failed revoke, offline toggle, refresh, second browser, stale local storage, and mid-request revocation all have explicit, tested behavior. Never announce a successful revoke that the server has not acknowledged.

### 4. P1 — The AI daily spending boundary is user-controllable

**Source-confirmed.** [respond/route.ts:14](/Users/rovs/Documents/KayaMo/kayamo-web/src/app/api/mus/respond/route.ts:14) accepts a client-supplied logicalDate. The budget query in [agent.ts:48](/Users/rovs/Documents/KayaMo/kayamo-web/packages/db/src/queries/agent.ts:48) sums that date's rows. Planning and gym consultation use the same pattern. A content date is not a trusted billing window.

Separately, [0001_core_schema.sql:860](/Users/rovs/Documents/KayaMo/kayamo-web/supabase/migrations/0001_core_schema.sql:860) permits authenticated users to insert/update their own agent_runs; table privileges are granted at line 886. Later migrations do not remove those rights. The cost field also lacks a nonnegative constraint. RLS still isolates accounts, but user-editable rows cannot enforce server-paid quota.

**Change:** introduce a server-owned immutable usage ledger, derive the billing window from server time independently of the requested content date, reserve quota atomically, and make request IDs idempotent. Restrict privacy scrubbing to a narrow operation that cannot modify billing facts.

**Acceptance:** changing content dates, editing owned telemetry, parallel requests, duplicate retries, or negative client cost values cannot increase the available allowance. Verify against disposable Supabase, not only mocked query objects.

### 5. P1/P2 — Failed/retried AI requests are not accounted for reliably

**Source-confirmed with configuration-dependent impact.** [coco-router.ts:281](/Users/rovs/Documents/KayaMo/kayamo-web/packages/ai/src/coco-router.ts:281) checks the budget once before retries. Usage is recorded after successful validation; exhausted failures are recorded with zero cost at line 334. Telemetry insertion failure can also lose accounting. [openai-provider.ts:17](/Users/rovs/Documents/KayaMo/kayamo-web/packages/ai/src/openai-provider.ts:17) defaults missing rate/estimate configuration to zero; the route's fallback estimate is not forwarded into this provider.

The older Coco router's timeout does not abort the provider call. The generic router does use AbortController, so this is not a universal missing-cancellation defect.

**Change:** consolidate the two governance paths, record/reserve cost per provider attempt independently of output validity, validate cost configuration, reconcile actual usage, and implement cancellation end-to-end where supported. Timeouts are not proof a billable request stopped.

**Acceptance:** malformed output, provider timeout, retried request, telemetry outage, and simultaneous calls cannot disappear from spend accounting. Monitor usage without logging health content.

### 6. P1 — Signup promises to preserve demo data, but transfer is not implemented

**Source-confirmed.** [login-view.tsx:29](/Users/rovs/Documents/KayaMo/kayamo-web/src/app/login/login-view.tsx:29) says creating an account makes the demo follow the user to other browsers and their phone. The authenticated shell instead switches to the real user scope. [db.ts:842](/Users/rovs/Documents/KayaMo/kayamo-web/packages/offline/src/db.ts:842) migrates matching-owner signed-out/legacy rows, not guest-owned rows; the callback has no guest transfer.

Ordinary return visits with a valid guest cookie do resume the demo. Do not describe every revisit as data loss. The real gaps are account conversion, cookie expiry, and identity rotation: [demo/route.ts:10](/Users/rovs/Documents/KayaMo/kayamo-web/src/app/api/demo/route.ts:10) always issues a new ID when posted to, and [guest.ts:16](/Users/rovs/Documents/KayaMo/kayamo-web/src/lib/guest.ts:16) expires the cookie after 30 days. Old rows may remain on disk but become inaccessible.

**Change:** implement an explicit resumable guest-to-account import, remap owners and food/reference IDs safely, resolve collisions with existing account data, verify counts and relationships, and preserve the original scope until verified. Until then, remove the continuity promise and offer an honest export/recovery option.

**Acceptance:** new signup, existing-account login, expired cookie, interrupted transfer, retry, canonical catalog ID reconciliation, and arrival on another device. Never clear the old scope merely because authentication succeeded.

### 7. P1 — The demo's first meaningful task is not reliably ready

**Reproduced state; root cause not fully established.** On a new local demo entry the diary displayed “Local data error” and “PH core still loading.” The food palette opened; a successful search→log→reload journey was not established. A later browser-session interruption prevented completion of that search check. Local server output also contained stale auth refresh-token warnings; their relationship to the storage error was not isolated. This is not evidence that every deployed demo fails, a clean-auth-profile result, or proof of one specific IndexedDB cause.

The error handling is independently weak: [demo-seed.ts:58](/Users/rovs/Documents/KayaMo/kayamo-web/src/shell/demo-seed.ts:58) treats any cached food as complete seeding, casts unvalidated JSON, writes food-by-food, and swallows failure. An interrupted partial seed can be treated as complete on retry. [offline-root.tsx:33](/Users/rovs/Documents/KayaMo/kayamo-web/src/shell/offline-root.tsx:33) begins initialization asynchronously while children already mount.

**Change:** provide explicit storage/catalog readiness before dependent interactions, Zod-validate the generated catalog, version the seed, seed atomically or resumably with a completion manifest, and show a useful retry/recovery state. Avoid treating “some rows exist” as successful installation. Recovery must preserve user entries.

**Acceptance:** clean browser, strict-effect remounts, interrupted seed, stale cache, blocked storage, storage quota failure, and scope switch all recover or show an actionable explanation. Log a food, edit it, reload, and verify the same values.

### 8. P1/P2 — “Nothing sent to a server” is too broad for the demo implementation

**Source-confirmed mismatch; no live sensitive payload was submitted.** The landing and demo banner make this absolute promise, but the guest shell composes shared API-backed features. [mus-thread.tsx:275](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/screens/mus-thread.tsx:275) posts the entered message without a guest-mode capability guard. A server rejecting that request as unauthenticated does not mean its request body was never transmitted. Guest sync being parked is a different claim.

**Change:** choose a genuine local-only demo, with network-backed actions disabled or locally simulated and clearly labeled, or disclose precisely which actions contact the server and require informed opt-in. Separate API capabilities by session mode instead of relying on a missing access token to make the UI safe.

**Acceptance:** inspect requests during all guest actions—chat, photo attachment, planning, gym consultation, food parse, profile reads. The visible privacy claim must match the observed data flow. Do not imply that regular demo sync has been shown to upload food records; that was not found.

### 9. P1 — Task editing is vulnerable to four-second resets

**Source-confirmed.** [todos-inspector.tsx:66](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/todos-inspector.tsx:66) reinitializes all fields when block/meta/task object references change. [todos-desk.tsx:213](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/todos-desk.tsx:213) reloads fresh objects, and line 261 repeats that every four seconds. There is no dirty-draft guard.

**Change:** maintain an editor draft keyed by entity ID and version. Same-entity background refreshes must not erase local edits. Merge untouched fields or surface a real conflict; do not silently replace the whole draft. Use reactive, scoped queries rather than repeatedly rebuilding the entire screen state.

**Acceptance:** edit title, notes, duration and dependencies for at least 12 seconds without saving; refresh another task; verify the draft survives. Then test a genuine concurrent edit, switching selection, cancel, save failure, and successful save.

### 10. P1 — A saved workout row can show the plan instead of the performed result

**Source-confirmed.** [gym-desk.tsx:635](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/gym-desk.tsx:635) defaults empty in-memory actuals to target values. The saved indicator comes from performed_set_id, but the saved text renders those defaults rather than loading the linked performed set.

Example: plan 50 kg × 8, record 40 kg × 6, then remount. The underlying performed row can remain 40 × 6 while the UI says the saved result is 50 × 8. This is incorrect displayed history, not demonstrated corruption of stored workout data.

**Change:** join to the owned performed set and render saved actuals exclusively from that record. Planned values may remain visible, but must be clearly separate.

**Acceptance:** target and actual must intentionally differ in tests. Verify navigate away/back, reload, offline hydration, undo, and remote sync all preserve the actual displayed result.

### 11. P1/P2 — Asking for workout suggestions immediately persists the generated plan

**Source-confirmed.** [gym-desk.tsx:310](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/gym-desk.tsx:310) shows the consultation result and immediately writes the generated gym session items and planned sets. There is no review/accept stage.

The user does press “Ask Mus to fill gaps,” and this affects a persistent draft, not completed workout sets. Nevertheless, generation is being treated as permission to apply unseen choices, contrary to the explicit project rule that Mus proposes and the user confirms writes.

**Change:** preview editable/selectable exercise suggestions, their constraints and source, then apply only accepted items in a transaction. Cancelling should leave no persistent plan changes. Check equipment, duplicate exercises, time allowance, and user restrictions before acceptance.

**Acceptance:** generation and cancellation write zero plan rows; explicit acceptance writes exactly the selected valid items once; retries do not duplicate them.

### 12. P1/P2 — An active workout can disappear when the logical day changes

**Source-confirmed.** [gym-desk.tsx:124](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/gym-desk.tsx:124) filters to today's workouts before selecting the active session. [gym-session-provider.tsx:64](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/gym-session-provider.tsx:64) intentionally falls back to any active session. These surfaces disagree after the custom day boundary. [training.ts:45](/Users/rovs/Documents/KayaMo/kayamo-web/packages/offline/src/training.ts:45) can create another active row without a single-active guard.

**Change:** model the active workout independently of calendar filtering. Define one authoritative session lifecycle and a policy for multiple active sessions. The page, timer, navigation badge and resume action must use the same selection.

**Acceptance:** workout spanning midnight/custom boundary, browser suspension, next-day resume, timezone change, double Start, and concurrent tabs. Never strand an unfinished session behind today's filter.

### 13. P2 — Copy-last targets a hidden draft during an active workout

**Source-confirmed.** The copy button remains enabled during an active workout, but [gym-desk.tsx:245](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/gym-desk.tsx:245) and line 263 always target draftId. The visible page shows the active session's items. Cloning also replaces existing draft items.

**Change:** disable the action while active, explicitly label it “prepare next session,” or offer clear append/replace behavior for the current workout. Preview or make draft replacement undoable.

**Acceptance:** destination is explicit, the changed items are discoverable, existing draft contents are not unexpectedly replaced, and copying never silently affects the wrong session.

### 14. P2 — Workout notes and pause state are not a durable session model

**Source-confirmed.** Pre-start notes are saved at [gym-desk.tsx:209](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/gym-desk.tsx:209). Changes after Start only update React state; persisted notes are not rehydrated. Pause and pause offsets are also page-local state, while the global timer calculates from the original start timestamp.

**Change:** persist session notes and pause intervals, establish exactly what pause changes, and derive all elapsed/rest displays from one shared source. Debounced saves need visible unsaved/error state and must survive navigation.

**Acceptance:** write notes after Start, pause, navigate, reload, resume and finish. The note and elapsed-time interpretation must remain consistent everywhere.

### 15. P2 — Planning “now” uses the whole day rather than actual remaining time

**Source-confirmed.** [todos-desk.tsx:402](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/todos-desk.tsx:402) places work in the first window from the fixed day start, even on today's date after that window has passed. [Line 534](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/todos-desk.tsx:534) computes “What now?” availability from the first whole-day opening, clamps it to at least 15 minutes, and hardcodes location to home.

**Change:** distinguish planning a future/past day from choosing an action now. Clip today's windows to current local time, apply working hours and locked blocks, use the actual next viable gap, and ask or remember location only with appropriate user control. Do not invent 15 available minutes when fewer remain.

**Acceptance:** evening with an empty morning, five minutes before a meeting, full day, night shift, away-from-home context, and future-day planning all return plausible placements or an honest no-fit result.

### 16. P2 — The live conversational food parser is unreachable

**Source-confirmed.** [foods/parse/route.ts:39](/Users/rovs/Documents/KayaMo/kayamo-web/src/app/api/foods/parse/route.ts:39) calls parseFoodMessage without dependencies. [food-parse.ts:43](/Users/rovs/Documents/KayaMo/kayamo-web/packages/ai/src/food-parse.ts:43) invokes completeObject without a budget. [router.ts:154](/Users/rovs/Documents/KayaMo/kayamo-web/packages/ai/src/router.ts:154) refuses that live call, and the parser catches the exception and silently returns its heuristic. Configuring an API key does not resolve this path.

**Change:** inject governed provider/budget dependencies at the route, preserve deterministic nutrition resolution, and expose parser mode/fallback reason safely. A fallback is useful; hiding a permanently disconnected integration is not.

**Acceptance:** a route-level injected-provider test proves invocation when configured, proves fallback when unavailable, and verifies the model cannot introduce authoritative nutrition values.

### 17. P2 — Mus looks conversational but does not receive prior chat turns

**Source-confirmed.** [mus-thread.tsx:275](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/screens/mus-thread.tsx:275) sends current message/mode/date/entry/requestId, not conversation ID or history. The server schema accepts neither. [openai-provider.ts:53](/Users/rovs/Documents/KayaMo/kayamo-web/packages/ai/src/openai-provider.ts:53) constructs input from the current message and authorized product context. Explicit memories are separate; they do not provide the visible transcript.

“Use the second option you just suggested” therefore cannot reliably refer to the preceding response. Persisting and displaying a conversation is not the same as giving the assistant conversational context.

**Change:** load bounded, authorized active-thread history server-side with ownership checks and token limits. Keep temporary conversation context distinct from opt-in long-term memory. Provide cancel/retry/error handling and clarify what context was used. Rename the remaining “You are Coco” system prompt to Mus.

**Acceptance:** follow-up references work, separate chats cannot read one another by accident, deleted/revoked context stays excluded, and retries cannot duplicate confirmed actions.

### 18. P2 — Locale behavior changed globally without reconciling its contract

**Reproduced.** [meal-slot.ts:13](/Users/rovs/Documents/KayaMo/kayamo-web/packages/food/src/meal-slot.ts:13) now defaults to English. Three [quick-log tests](/Users/rovs/Documents/KayaMo/kayamo-web/packages/food/src/quick-log.test.ts:51) still require the established Filipino/Taglish fallback. This is a shared package change motivated by the desktop, so it can also affect other surfaces when synced.

**Change:** decide the intended default explicitly. If only desktop should initially use English, pass that preference at its boundary instead of silently changing the shared fallback. If the global product contract changes, document it and update tests because the approved behavior changed—not merely to get a green run. Finish translation coverage and persistent preference handling.

**Acceptance:** English, Filipino, Taglish, missing/unknown locale, offline reload, and cross-surface use all follow an explicit contract. Language metadata must match translated content.

## Product, architecture and readiness gaps

### 19. P1/P2 — Shared-source drift makes the current work unsafe to maintain

**Source-confirmed.** The repository instructions say packages, supabase and data are owned by kayamo-mobile. A read-only directory comparison found many differences and web-only shared files, including AI food parsing, Mus rail, gym-session provider, localization, and conversational logging work. [sync-packages.sh:13](/Users/rovs/Documents/KayaMo/sync-packages.sh:13) protects only uncommitted destination changes; line 24 then uses rsync with deletion.

Committing the web copy does not reconcile ownership. Once clean, the next prescribed sync can overwrite or delete web-only work.

**Change:** reconcile shared changes into the declared source of truth first. Record the source commit and checksums in a sync manifest, make destructive deltas reviewable, and add drift checks to CI. Consider a real workspace or versioned package distribution if copied repositories repeatedly diverge. That is a deliberate architecture decision, not a reason to rewrite the app immediately.

**Acceptance:** a dry-run sync after reconciliation shows only intended changes. Never run the existing sync blindly, and do not “fix” ownership by discarding either repository's work.

### 20. P2 — “Finished” has no single product definition

**Product gap.** The [canonical product rules](/Users/rovs/Documents/KayaMo/kayamo-web/.cursor/rules/010-mus-sot.mdc:5) require Home, Goals, Life, Grove and Mus. The [desktop handoff](/Users/rovs/Documents/KayaMo/kayamo-web/docs/design/desktop-handoff/README.md:19) deliberately defines a narrower food/training/planning desk, preserves separate Today and diary routes, and leaves several product areas phone-first.

Those missing desktop areas are not all accidental bugs. But finishing a design tranche is not finishing the entire product. Shared inventory marked SHIPPED can describe a local or phone slice, not a reachable, synced desktop workflow.

**Change:** approve one surface-specific release contract. For every promised capability, track: implemented, desktop-reachable, persisted, synced, tested, recoverable, and intentionally deferred. Record any desktop exception as an explicit owner override rather than silently letting the handoff supersede the canonical product.

**Recommendation:** finish a narrow daily-use desktop first. Keep wider Growth OS parity as a separately accepted phase. Do not add every feature in this document to the immediate release.

### 21. P2 — The desktop lacks reachable settings and account self-service

**Product gap.** There is no coherent desktop settings/onboarding/privacy/export route. [The legacy settings path](/Users/rovs/Documents/KayaMo/kayamo-web/src/app/app/[[...slug]]/page.tsx:6) redirects to Today. The shell exposes theme, locale and sign-out/signup. The dashboard says “No calorie target yet” without a nearby setup path.

**Change:** add an account/settings destination with optional profile/target setup, timezone/custom boundary, language, units, AI permissions, data export/import, device storage, account deletion, support and policy links. These can live under account navigation; they do not require inventing another primary tab. Reuse existing domain logic rather than duplicating it in root routes.

**Acceptance:** a desktop-only user can understand defaults, configure relevant preferences, recover their data, revoke AI access, and leave the service without borrowing another device. Target setup must remain optional and explain its assumptions and limits.

### 22. P2 — Local persistence is being confused with full offline and cross-device continuity

**Source-confirmed scope gap.** [sync.ts:707](/Users/rovs/Documents/KayaMo/kayamo-web/packages/offline/src/sync.ts:707) syncs many core tables, but not several desktop planning/session tables, including time_blocks, task_meta, gym_session_items, gym_planned_sets and rest_timers. Local-only storage can be intentional; it must not be mistaken for a complete cross-device session or plan.

No desktop service-worker/app-shell cold-start strategy was found. Authenticated root composition also relies on server-side auth. Offline writes in an already-loaded page do not prove that the app can open cold without a network. That cold-start behavior was not browser-tested here.

**Change:** publish a data ownership/sync matrix. Label local-only state, pending changes, conflicts and acknowledged sync accurately. Either synchronize the necessary session/planning state or scope the promise explicitly. Design and test offline boot, not only the mutation queue.

**Acceptance:** inspect the same user's data in two browser contexts; compare all promised fields and relationships, not just the task title or completed workout. Test cold offline start, reconnect, stale credentials, logout/login isolation and interrupted migrations.

### 23. P2 — Offline clock fallback can silently change a user's logical day

**Source-confirmed.** [use-desk-clock.ts:9](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/use-desk-clock.ts:9) initializes Manila/midnight, calls a remote profile loader, and keeps defaults on failure. [hydrate-food-history.ts:12](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/food/hydrate-food-history.ts:12) has no local profile cache.

For a night-shift user or someone in another timezone, offline reload can select a different logical date than their configured one. This undermines the custom-day-boundary promise before any calculation is wrong.

**Change:** cache confirmed clock preferences locally and share them across screens. Distinguish unknown, cached and refreshed settings. Do not silently use an unconfirmed default for date-sensitive writes when the user's real settings are unavailable.

**Acceptance:** non-midnight boundary, non-Manila timezone, offline reload immediately around the boundary, delayed profile response, and timezone change preserve consistent grouping and active-session ownership.

### 24. P2 — The app completely locks out narrower desktop windows

**Source-confirmed product restriction.** [shell.module.css:572](/Users/rovs/Documents/KayaMo/kayamo-web/src/shell/shell.module.css:572) hides the whole shell below 1280 CSS pixels. The fallback instructs people to use the phone app without an actual handoff link. This affects laptop split windows and browser zoom, not just phones.

**Change:** collapse the rail first, then navigation, adapt tables/inspectors, and preserve core tasks at narrower widths. “Desktop-first” should describe density and input style, not require a full-width window to see any data. If a temporary minimum remains, explain it before signup/demo and provide an actionable supported-device handoff.

**Acceptance:** test 1280 and 1279 boundary widths, common split-window widths, 200% zoom and small-height laptops. No data, save action or recovery path should vanish purely because the user enlarged text.

### 25. P2 — Navigation and assistant duplication make the product feel less coherent

**Source-confirmed/product judgment.** [desktop-shell.tsx:31](/Users/rovs/Documents/KayaMo/kayamo-web/src/shell/desktop-shell.tsx:31) marks Today active for both dashboard and diary, but the link goes only to the dashboard. The demo starts on the diary. Diary access then depends on a dashboard Calories card. The primary Verify area is catalog-curation work. Today also mounts a compact chat while the global Mus rail remains visible: [desk-home.tsx:209](/Users/rovs/Documents/KayaMo/kayamo-web/packages/features/src/desk/desk-home.tsx:209).

**Change:** make the route hierarchy legible within the approved navigation contract: dashboard versus food diary must have distinct labels or obvious subnavigation. Move specialist catalog curation to a secondary tools context unless it is truly a primary user job. Render one assistant with shared conversation/context and expandable presentation. Persist rail preference.

**Acceptance:** from any screen, a new user can find today's food entries, pending tasks and active workout without knowing route names. The same visible “Today” control should not appear to select two different destinations without explanation.

### 26. P2 — Accessibility and keyboard-first claims need actual coverage

**Source findings plus visual risks; not a full accessibility audit.** [desktop-shell.tsx:168](/Users/rovs/Documents/KayaMo/kayamo-web/src/shell/desktop-shell.tsx:168) uses a div for the primary content and no skip link was found. Translated UI changes a data attribute while root html remains lang=en. Essential provenance and status metadata is very small in the captured diary. The hard width cutoff further harms zoom/reflow.

The generic [Sheet.tsx:16](/Users/rovs/Documents/KayaMo/kayamo-web/packages/ui/src/components/Sheet.tsx:16) declares modal semantics but lacks focus initialization/trapping/restoration and background inertness; verify its desktop reachability when prioritizing. Do not apply that finding to the command palette, which uses a native modal dialog.

**Change:** implement landmarks and skip navigation, correct language metadata, clear labels and focus order, accessible error announcements, reliable modal behavior, keyboard alternatives to gestures, visible focus and non-color status cues. Increase critical source/confidence/status readability and offer a comfortable density option.

**Acceptance:** keyboard-only walkthroughs, screen-reader checks, zoom/reflow and measured contrast in both themes. Screenshot inspection cannot certify these behaviors.

### 27. P2 — Release tests do not exercise the promises being marketed

**Source-confirmed.** [.github/workflows/ci.yml:55](/Users/rovs/Documents/KayaMo/kayamo-web/.github/workflows/ci.yml:55) runs only the login smoke spec in its browser lane. Many broader desk tests skip for a hosted URL or absent local-login fixture. The configured browser project is Chromium only.

Credit the existing fresh-database migration replay, RLS/PostgREST coverage, and substantial offline regression suite. The missing layer is mandatory composed user journeys and adversarial lifecycle tests, not simply more test files.

**Change:** create a non-skippable release lane with isolated deterministic demo/auth fixtures. Cover every P1 acceptance test above. Test the served production build, not only development mode. Add browser/platform coverage proportionate to supported users and publish skip counts as an explicit failure for critical tests.

**Acceptance:** a release cannot be green if demo, data conversion, permission enforcement, saved-value rehydration or offline recovery never ran. Add copy-check and generated-data drift checks to CI too.

### 28. P2 — The landing page undermines its own provenance promise

**Reproduced and source-confirmed.** [landing.tsx:59](/Users/rovs/Documents/KayaMo/kayamo-web/src/app/landing/landing.tsx:59) displays 1,840 kcal, while the five displayed rows total 1,639 kcal: 260 + 90 + 285 + 640 + 364. The unexplained difference is 201 kcal. For a product selling confidence in numbers, that is an unusually damaging example to get wrong.

“Most calorie apps guess … and never admit it” is also an unsupported market-wide assertion. A source-checked reference recipe is not automatically a measured value for the user's actual plate; the measured/estimated binary can exaggerate certainty.

**Change:** derive illustrative totals from one fixture, test them, label sample data, remove the competitor generalization, and distinguish source-checked reference data, measured quantities, portion estimates and recipe uncertainty. Publish the catalog's actual verification method and assumptions. Match demo, AI and signup copy to implemented behavior.

**Acceptance:** every numerical illustration reconciles; every certainty/privacy/retention claim has a corresponding implementation and test or an explicit limitation.

### 29. P2 — Privacy, deletion and backup readiness are not user-facing yet

**Product gap.** [docs/legal/README.md](/Users/rovs/Documents/KayaMo/kayamo-web/docs/legal/README.md) refers to policies and terms, but the folder contains only that placeholder. [docs/compliance.md](/Users/rovs/Documents/KayaMo/kayamo-web/docs/compliance.md) explicitly describes draft/prelaunch work and open items. An existing PersonalArchive focuses on life-story/Grove/goals data; it is not a complete export of food, training and planning records.

**Change:** provide accurate public-facing policies and contact details, a retention/deletion map, AI-recipient disclosures, account/device deletion controls, and a versioned complete export/import path. Test restore and deletion behavior, including offline queues, guest scopes, attachments and backups. Have qualified local counsel review launch obligations; this review does not validate the legal conclusions in existing drafts.

**Acceptance:** users can see what is stored where, what AI reads, how to revoke access, how to recover data and how to leave. A successful export means the artifact can be restored correctly, not merely downloaded.

### 30. P2/P3 — The code's orchestration and operational surfaces need simplification

**Source-confirmed maintainability risk.** TodosDesk is 1,073 lines; GymDesk 917; app-screens 1,059; major shared CSS files are 4,817 and 3,547 lines. The problem is not a numerical line limit: data access, timers, proposal application, drafts and view composition are tightly interwoven. Their divergent state handling is already producing defects.

The global gym provider reloads workout history every two seconds; multiple desks reload every four seconds. Several paths suppress errors and wait for the next poll. No route-specific loading/error/not-found boundaries were found under src/app.

**Change:** extract domain commands, lifecycle state and focused reactive queries before splitting markup cosmetically. Give each operation explicit loading/error/retry semantics. Query active/recent records by index instead of repeatedly scanning history; profile realistic large accounts before optimizing further. Centralize clock, session and consent state. Add sanitized operational telemetry, request IDs, release smoke/rollback/restore procedures and a pinned supported Node runtime.

**Acceptance:** navigation preserves state, idle pages do bounded work, failure is distinguishable from empty data, and faults can be diagnosed without collecting meal text, chat content or other health data.

## Captured product experience

The Product Design audit workflow was used to ground the visual portion in saved, inspected screenshots instead of imagined screens. Capture was limited to the landing and demo entry; the demo error and subsequent browser-session interruption prevented claiming a complete successful logging flow. Remaining screen-level interaction findings above are source-confirmed, not invented visual observations.

1. **Landing — visually coherent, factually inconsistent.** The forest/mustard palette, serif headline and food example establish a recognizable identity. The CTA is easy to find. The sample total is wrong and the copy overpromises certainty/privacy. At 1280 × 720, secondary content begins below the fold, which is normal; the concern is the truthfulness of the first screen, not that it scrolls.

![Step 1: Landing page, captured during this review](/Users/rovs/Documents/KayaMo/kayamo-web/docs/audits/2026-09-08/01-landing.png)

2. **Enter demo → diary — degraded, not a successful first-use journey.** The shell renders and visually matches the brand, but “Local data error” appears in a tiny footer while the main canvas presents empty statistics and a loading catalog. The error is less prominent than secondary metrics. There is no obvious recovery action. The always-open assistant consumes 316px, leaving the central workflow substantially narrower. “Create an account to keep it” implies continuity not implemented in the inspected code.

![Step 2: Demo diary showing the observed local-data error](/Users/rovs/Documents/KayaMo/kayamo-web/docs/audits/2026-09-08/02-demo-diary.png)

3. **Open Log food → search kanin — incomplete verification.** The palette opened and accepted text, reaching SEARCHING. The next capture was interrupted when the browser session became unavailable. There is no accepted completed-search screenshot and no claim that logging succeeded or permanently failed. This remains a required release test.

The visual direction is not the main thing I would replace. I would revise hierarchy and state treatment: show one obvious first action, distinguish missing setup from zero data, surface blocking errors in the work area, reduce empty metrics before first use, make provenance legible, and let users reclaim the assistant's space. Do not spend the next milestone on new mascots or more decorative cards.

## Broader change and addition backlog

These are proposals to implement, improve, expose on desktop, or explicitly defer after a reachability check. They are not a claim that every capability below is absent from all shared/mobile code. Reuse existing implementations first. The list is deliberately broad because the request asked for an unrestrained review; it is not an instruction to ship everything at once.

### First use, navigation and account

- Offer a short optional setup: “What do you want to do today?” with logging, training and planning entry points. Avoid a long mandatory health questionnaire.
- Let new users choose a clearly labeled sample walkthrough versus their own empty day; never silently mix sample health records into real history.
- Show one dominant next action on empty screens. Replace unexplained dashes with “No target set,” “No records yet,” or a real loading/error message.
- Add a resume-first home state for active workouts, unsaved task work, pending confirmations and interrupted imports.
- Make phone-only destinations actionable through a genuine handoff or remove them from prominent navigation until useful.
- Add an account menu, settings search and a keyboard shortcut guide with platform-appropriate Ctrl/Command labels.
- Persist workspace preferences such as rail collapse, density, visible columns and date range without confusing them with server privacy settings.
- Provide contextual help, a support contact, app/version details and a safe diagnostic export that excludes user content.

### Food and provenance

- Complete the fastest repeat paths: recent foods, favorites, saved meals, repeat last meal/yesterday, editable portions and multi-item entry with undo.
- Make add, correction and deletion unambiguous in conversational logging. “Actually, half” should preview the affected entry, not silently create another one.
- Provide clear reconciliation for ambiguous dishes, branded variants, vague portions, mixed plates and missing catalog matches.
- Keep units explicit: grams, cooked/raw, edible portion, household serving and number of servings. Show the conversion assumption before committing.
- Preserve a versioned nutrient snapshot and its source on each entry so later catalog edits do not silently rewrite historical totals.
- Distinguish reference-food confidence from confidence in a particular logged portion. A verified source does not verify the user's plate size.
- Make source details accessible from every entry: recipe assumptions, source identifier/link, version, who checked it and what “verified” means.
- Add duplicate-food/alias curation, an audit trail for verification, checks on unreasonable units/values and a reversible correction flow.
- Test catalog generation for determinism, missing relationships, nutrient reconciliation, validation failures and canonical/demo ID compatibility.
- Keep curation controls separate from ordinary diary edits; ordinary users should not have to understand Atwater reconciliation to eat lunch.
- Treat estimates honestly in charts and summaries. Avoid precise-looking totals that hide unresolved portions or missing data.
- Add useful history views and export, but do not frame an unlogged day as zero intake or a behavioral failure.

### Training

- Complete one reliable workout lifecycle: draft → reviewed plan → active → paused/resumed → completed or discarded, with safe recovery at every transition.
- Make last actual performance and current targets visually distinct; explain any progression recommendation and allow rejection.
- Add or expose editable reusable templates, exercise substitution, equipment filters, warm-up/work-set distinction, rest defaults and reorder controls.
- Support relevant set types deliberately—bodyweight, assisted, timed, distance and unilateral—rather than forcing all activities into weight × reps.
- Prevent double logging, duplicate active sessions and accidental destructive template replacement; provide undo and session summaries.
- Ensure history, volume and personal-record displays derive from performed sets only, with clear treatment of partial sessions.
- Review generated guidance and the gym knowledge base for traceable sources, contraindication handling and explicit limits; keep clinical judgments outside autonomous assistance.
- Validate the session on a small-height laptop, keyboard-only, suspended browser, offline reload and a second device where continuity is promised.

### Tasks and daily planning

- Finish capture → clarify → estimate → schedule → execute → complete/reschedule as one coherent path.
- Preserve drafts and provide undo, predictable keyboard selection and bulk editing where it reduces repetitive work.
- Make hard deadlines, soft dates, duration, availability, energy, location and dependencies distinct rather than interchangeable metadata.
- Build truthful “What now?” around actual time and constraints. Explain why a suggestion fits and let the user adjust the assumed context.
- Handle collisions, locked blocks, travel/buffer time and overfilled days explicitly. Do not make an infeasible plan look neatly complete.
- Enable the existing timeline's drag/resize/keyboard interactions only once commit, lock, conflict and undo semantics are finished. It is currently composed read-only with no-op handlers at todos-desk.tsx:810.
- Make recurring work and exceptions understandable. A single skipped occurrence should not accidentally rewrite the entire routine.
- Offer a short end-of-day review with carry-forward choices and neutral language, not automatic overload tomorrow.

### Mus

- Fix consent and conversation context before adding more agent actions.
- Use one consistent proposal card: what changes, which records, assumptions, before/after, editable fields, confirm, cancel and undo where possible.
- Show the scope actually used for a response and the difference between available data, allowed data and selected context.
- Give users inspect/edit/delete controls for persistent memory, separate from normal chat history.
- Make unavailable, offline, budget-limited, cancelled and failed states distinct; provide retry without duplicate writes.
- Add evaluations for correction language, Taglish, ambiguous references, conflicting instructions, prompt injection from stored content and unsupported health requests.
- Test all structured outputs at the real route boundary, not only pure schemas or mock generators.
- Preserve the nutrition resolver boundary: models can extract intent and quantities, not originate authoritative nutrient numbers.
- Label deterministic fallback behavior honestly. Do not market a heuristic path as successful live AI.
- Do not let more expressive companion animation conceal missing context, unreliable memory or a failed action.

### Storage, security and operations

- Add a complete per-table ownership, sync, retention and deletion matrix; include local-only planning state, attachments and guest data.
- Test account A → sign out → account B isolation, pending queues at logout, multi-tab ownership changes and malformed legacy databases.
- Build recoverable migration/import checkpoints and transactional multi-record commands; test interruption between every important write.
- Provide a non-destructive storage repair flow with backup before reset, version checks, retry and clear consequences.
- Protect server-paid routes with input/body limits, authenticated ownership checks, rate limits, atomic budgets and idempotency; review each route rather than assuming a shared wrapper covers all.
- Test provider key isolation, request-origin/auth behavior, safe error serialization and sanitized logs. Do not expose service-role credentials in the desktop bundle.
- Validate the deployment environment at startup/build with useful non-secret diagnostics; make required versus optional integrations explicit.
- Define backup/restore drills, incident response ownership, staged rollout, rollback, migration compatibility and a release checklist tied to an exact commit.
- Track privacy-safe reliability measures: first successful task, catalog-ready rate, storage failures, pending sync age, confirmed proposal success, build/test failures and provider error/cost rates. Avoid collecting raw health or conversation content for convenience.

### Craft, architecture and repository hygiene

- Preserve the current visual identity but establish comfortable and compact density, readable provenance text, visible focus and consistent error/empty/loading components.
- Use real semantic tables/lists where appropriate and expose chart values without relying on color, hover or sight alone.
- Adapt navigation, rail and inspectors progressively; test long food names, large numbers, localization expansion and low-height layouts.
- Replace full-document internal links in shared compositions with an app-supplied navigation port where state-preserving navigation is intended; keep framework imports out of shared packages.
- Extract session state, task drafts, catalog readiness and permission reconciliation into explicit tested modules; split giant components along those ownership boundaries.
- Consolidate duplicate AI governance paths and repeated profile/clock loads; replace broad periodic polling with focused subscriptions where practical.
- Benchmark populated accounts and keep histories paginated/indexed. Set performance targets from observed user tasks, not arbitrary bundle-size vanity metrics.
- Pin the runtime, document clean setup and fixtures, validate generated catalogs/knowledge bases, and add an exact command-to-release-evidence table.
- Organize raw reference bundles, duplicate asset variants and old QA screenshots as clearly labeled source/archive material. Keep generated files traceable to their generator; do not delete user assets indiscriminately.
- Maintain a small set of canonical product, data, consent and release documents. Retire contradictory completion claims with a dated explanation, not another competing source of truth.

### Broader Growth OS, deliberately later

- Once the narrow product is dependable, implement or expose Home, Goals, Life, Grove and Mus on desktop according to the canonical five-tab model—or document an explicit owner-approved desktop exception.
- Make goals connect to achievable daily actions and review, not merely become another CRUD list. Respect the existing “Released” and non-decreasing XP rules.
- Bring continuity/archive features to desktop only with clear distinction between a reflective personal archive and a complete operational-data backup.
- Keep Circles private-first and separately scoped. Do not invent members, feeds, follower counts or sharing of sensitive life-area data to make a demo look populated.
- Defer additional life-area modules, external integrations and social features until the existing food/training/planning loop passes its reliability gates.

## What I would remove, reduce or stop doing

- Stop calling design tranches or feature inventories evidence that the whole product is finished.
- Remove signup continuity and local-only privacy claims until they are true.
- Remove or redesign privacy levels that cannot be enforced at their displayed granularity.
- Stop treating generated suggestions as confirmed persistent plans.
- Reduce duplicated assistant surfaces, prominent curation statistics and phone-only dead ends in everyday workflows.
- Stop using silent catches and periodic polling as the default recovery strategy.
- Stop editing copied shared code without reconciling the declared source of truth.
- Avoid a framework migration, database rewrite or visual rebrand as the first response. The observed failures have more focused remedies.
- Do not weaken tests or strictness to declare success. Resolve behavior contracts and add the missing integration tests.
- Do not start another broad module while the first-run demo, data retention and saved values remain unreliable.

## Recommended delivery sequence

| Stage | Work | Exit evidence |
| --- | --- | --- |
| 0. Establish a release baseline | Reconcile source ownership; approve narrow desktop scope; fix build/locale contract; pin the exact revision. | Clean install and all required static/unit/build gates pass; safe reviewed sync delta. |
| 1. Make promises true | Permissions, AI ledger, demo readiness/transfer/privacy, task draft preservation, saved actuals, active-session lifecycle and logical clock. | Automated reproductions fail before fixes and pass afterward; no silent data/consent failures. |
| 2. Complete daily use | Settings/onboarding, clear navigation, one assistant, accurate planning, durable notes/pause, recovery and full export/restore. | New-user and returning-user journeys complete on the served production build, including offline/reload boundaries. |
| 3. Earn release confidence | Mandatory browser flows, disposable DB policy tests, sync/upgrade/migration testing, accessibility/reflow, provider evals, sanitized operational monitoring. | No skipped critical tests; explicit supported-browser evidence; tested rollback/restore. |
| 4. Improve craft | Readability, responsive density, input efficiency, populated-history performance, contextual help and copy. | Measured completion of representative tasks with few avoidable errors or dead ends. |
| 5. Expand the product | Approved Growth OS parity and selected integrations. | New capabilities meet the same persisted/synced/recoverable/tested definition of done. |

These are dependency-ordered milestones, not promised calendar estimates. Exact effort depends on source reconciliation and what the owner chooses to include in the narrow desktop release.

## Minimum acceptance scenario before calling the desktop finished

Using isolated test accounts and synthetic data:

1. A new visitor understands the product, enters demo, waits for explicit readiness and logs a realistic multi-item meal.
2. They correct a portion, navigate, reload and see exactly the same persisted values and provenance.
3. They create an account, deliberately import the demo, and verify the promised data on another browser without duplicates or missing references.
4. They change timezone/day boundary, go offline, reopen where supported, and record under the correct logical day.
5. They spend more than twelve seconds editing a task, schedule it into a real future gap, and retain the draft through unrelated refreshes.
6. They accept only selected workout suggestions, log actual values different from targets, pause, navigate, cross the day boundary and resume the same session.
7. They finish the workout and see the correct actuals in history after reload and sync.
8. They deny food context while permitting gym context; the provider request contains exactly the permitted fields. A failed revoke is shown as failed, not saved.
9. They ask a follow-up in chat and receive a response grounded in that conversation, without unrelated chat or revoked data.
10. Storage, network, provider and quota failures show recoverable states and do not duplicate confirmed writes.
11. They export and restore their full data, then exercise account/device deletion with clear consequences and no residual queue resurrection.
12. They complete the core tasks with keyboard navigation and at supported zoom/window sizes.

Until that sequence is demonstrably dependable, the honest status is **unfinished desktop product**, even if many component tests pass and the screenshots look polished.

## Handoff and changes made by this review

Only this review document and its two screenshots were deliberately added. No application fixes, shared-package changes, policy mutations, data deletion or deployment was performed. Verification commands produced ordinary generated build/type artifacts; Next.js may refresh next-env.d.ts between development and production type paths. Existing user changes were preserved.

The next implementation milestone should be Stage 0 followed by Stage 1, with shared-code fixes made in kayamo-mobile and deliberately synced back. The success criterion is trustworthy end-to-end behavior, not closing the largest number of checklist items.
