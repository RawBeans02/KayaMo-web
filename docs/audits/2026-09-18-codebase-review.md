# KayaMo web — whole-codebase review, 2026-09-18

Purpose: the baseline for three pieces of work the owner is starting now: a refactor,
finishing the visual design, and shipping the website. This document is the synthesis.
Every individual finding, with file:line, fix and verifier note, is in
`2026-09-18-codebase-review-findings.md` (442 lines, greppable).

Method: 12 area reviewers read the whole tree in parallel (root app, API routes, food
features, shell/desks, botanical/journey/todo/gym, AI + Lis, offline/sync, db + migrations,
food/core domain, design system + CSS, tests/CI/tooling/release, cross-cutting dead code and
boundaries). Their 290 findings were deduplicated (54 P0/P1 → 37) and every factual P0/P1
was re-checked in code by an independent verifier (27 checked, 27 confirmed, 0 refuted,
4 downgraded to P2). Ten structural P1s (refactor/design/docs) are reviewer judgment.
A completeness critic then looked for gaps and contradictions; its corrections are folded
in below. P2/P3 findings (236) were not re-checked. Baseline commands were run directly.

## Verdict

- **The branch cannot be deployed today.** `pnpm build` fails on an untracked CSS module,
  and the committed HEAD imports 11 files git has never tracked, so a clean checkout fails
  typecheck, build and test collection. Everything else green (typecheck, lint, 713 unit
  tests, 14/14 Chromium smoke, zero dependency advisories) runs only against this working tree.
- **The hosted database is behind the migrations.** Migration 0018 (`mus_context_permissions`)
  was recorded missing on Sep 15 and the e2e run today still logs `PGRST205` from the
  permissions route. 0021 and 0022 have no application record. Lis permission and profile
  features return 500 in production until this is fixed.
- **The "packages are synced copies" rule is already a fork.** 158 package entries differ from
  `../kayamo-mobile`, 47 files exist only here, and the sync script uses `rsync --delete`.
  Running it would erase the Lis persona, the respond handler, the desk and botanical screens,
  the offline closed-DB recovery, the Lis schema and migrations 0021/0022. Ownership must be
  decided before any file inside `packages/` is moved.
- **The architecture underneath is sound.** RLS covers all 46 tables, the service-role client
  is isolated, every LLM output is Zod-parsed, nutrition numbers never come from a model,
  writes go through the offline outbox with source and confidence, the package graph is
  acyclic with no root-app imports, and there are zero `any`, zero `@ts-ignore`, zero TODOs.
  The problems are repository state, duplication, three stacked styling systems, and ship
  plumbing (no error boundary, no monitoring, no production-build test, no legal routes).
- **The design is Liquid Glass on four routes and legacy desk on six.** Home, Life, Grove,
  Settings and Landing are on the glass system. Goals renders the 390px mobile editor inside
  a glass dialog via CSS substring overrides. Calories, Foods, Verify, Gym, Todos and Login
  still render the older desk or `--color-*` layer with zero glass primitives.

## Ground truth measured in this session

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass, 1 warning (unused eslint-disable in `packages/ai/src/evals/live.test.ts`) |
| `pnpm test` | 713 passed, 30 skipped (live-DB and live-eval suites) |
| `pnpm build` | **failed** at audit time: `src/app/glass-materials.module.css:27` `:global(.kgSurface)` is not a pure CSS-module selector. Fixed in Phase 0, see below |
| `pnpm audit --prod` | 0 advisories, 133 dependencies |
| Playwright smoke/shell/entry/metadata, Chromium | 14/14 against `next dev`; server logged `Lis permission read failed (PGRST205)` twice |
| Untracked files imported by tracked code | 11 (`git ls-files` empty; importers tracked) |
| Package divergence vs `../kayamo-mobile` (`diff -rq`) | features 90, ai 25, ui 14, food 13, db 8, offline 6, core 2, config 0, migrations 2 |
| Git | 89 uncommitted entries; PR base `origin/feat/web` is 20 commits behind HEAD; production commit `e7326d8` is on `origin/main`, not on `feat/web` |
| `.env.local` | points `NEXT_PUBLIC_SUPABASE_URL` and `DATABASE_URL` at the production project; local dev and local e2e run against production |

## Ship blockers

These stop a deploy of this branch regardless of design or refactor decisions.

1. **Build failure.** `src/app/glass-materials.module.css` uses `:global(...)` selectors with
   no local class, which webpack's CSS-module loader rejects. Dev (Turbopack) tolerates it,
   which is why it went unnoticed. Fix: make the selectors local, or move the rules into
   `glass.css`. The file header claims the globals pipeline strips `backdrop-filter`; verify
   that with a real `next build` and grep of `.next/static/css` before choosing. Effort S.
2. **Untracked source imported by committed code.** `src/app/glass.css`,
   `glass-materials.module.css`, `src/shell/glass-shell.module.css`, `src/lib/site-metadata.ts`,
   `packages/ui/src/web-motion.css`, `packages/ui/src/use-web-sheet-motion.ts`,
   `packages/features/src/food/worldwide-food-search.tsx`, `worldwide-search-server.ts`,
   `default-clock.ts`, `packages/features/src/botanical/dialog-motion.ts`,
   `packages/features/src/todo/timeline-physics.ts`, plus `packages/ai/src/evals/load-root-env.ts`
   and `scripts/check-security-dependencies.mjs` referenced by CI. Fix: commit them. Effort S.
3. **Hosted schema behind migrations, no ledger.** Owner action: link the hosted project,
   run `supabase migration list`, push 0018/0021/0022, record the applied set under
   `docs/releases/`. Code action: delete `supabase/migrations/meta/` and the drizzle-kit
   `generate`/`migrate` scripts so there is one runner (the Supabase CLI, as CI already uses).
4. **Three nutrition-correctness fixes are uncommitted in both repos** (per-100g USDA branded
   values, no fabricated zero macros, independent providers). Production runs the old code.
   The corrected tests are correct, not weakened. Commit them. Cached `usda_fdc` branded rows
   written under the old adapter hold wrong per-100g values and need an audit script.
5. **Branch model.** Production is `origin/main` (`e7326d8`), the PR default is `feat/web`
   (last commit Sep 1), CI has never run on this branch. Owner decides which branch Vercel
   builds; then either fast-forward `feat/web` to `main` or retarget PRs to `main`.
6. **Scripts that write to production.** `scripts/web-ai-allowance.mjs` only runs against the
   production host; `seed.ts`, `build-ph-core.ts` and `ph-core.ts` write to whatever
   `DATABASE_URL` names, and `.env.local` names production. Delete the allowance script (0020
   is applied) and add a hostname guard in `packages/db/src/drizzle.ts` that requires an
   explicit opt-in for any non-loopback database.

## Decisions the owner must make before the refactor starts

The reviewers converge on four decisions. Each changes what the refactor does.

1. **Fork or keep syncing `packages/`.** Facts: mobile's last package commit is Sep 5; mobile's
   working tree has ~45 uncommitted package edits (material tokens, spring motion, rail faces)
   that web lacks; web has 10 commits touching 142 package files since. Recommendation: fork.
   Remove `kayamo-web` from `TARGETS` in `../sync-packages.sh`, rewrite the AGENTS.md boundary
   section, and port anything mobile needs deliberately. If syncing must continue, add an
   exclude list and drop `--delete` first; do not run the script as it stands.
2. **One visual system and its name.** The code renders Liquid Glass everywhere; the branch,
   docs and module names say botanical; mobile's `tokens.css` moved to a `--material-*` tier
   system web does not have. Recommendation: pick glass as the shipped system, move its tokens
   and `kg*` materials into `packages/ui`, and treat botanical as the palette source only.
3. **Naming freeze.** Copy says Lis; routes, tables, env vars and rules say Mus/Coco; the staged
   mascot artwork contradicts the e2e assertion that Lis has no character and the icons
   comment. Recommendation: freeze "Lis" in user-facing copy, freeze `mus`/`coco` identifiers
   at DB/route/env level, record the map in AGENTS.md, and decide mascot yes/no so
   `mus-faces.ts` and the `.webp` assets are either wired or deleted.
4. **What ships in v1.** Gym and Todos are on the legacy skin and absent from the design plan.
   Verify filters to `ph_core` only and reads like a curator tool. Either convert them (L each)
   or hide them from the rail and Life hub for the first release. Also: Taglish in chrome
   (the only toggle is dead), Grove's streak concept and tree visual, and whether the goal
   editor is rewritten before ship (L) or shipped patched.

## Confirmed defects to fix before shipping

All independently verified in code. Effort S unless noted.

| Area | Defect | Where |
| --- | --- | --- |
| Auth | Open redirect: `next` guard only checks a leading slash, so `//evil.example` passes | `packages/features/src/auth/paths.ts:16` |
| Auth | `/auth/set-session` sets a session from any tokens in the URL hash; unreferenced on web | `src/app/auth/set-session/page.tsx` |
| Auth | `/settings` is outside the proxy matcher and protected set | `src/proxy.ts:5` |
| Headers | No CSP, frame-ancestors, Referrer-Policy or Permissions-Policy | `next.config.ts` |
| Safety | Eating-disorder regexes match "stopped eating rice" and "haven't eaten yet" and block the model | `packages/ai/src/safety.ts:54` |
| Safety | Crisis classifier is English-only while the persona invites Taglish (M) | `packages/ai/src/safety.ts:30` |
| Food | Week average, strip and presence grid drop entries without a catalog `food_id`; root cause is the shared history query, so the fix touches seven consumers | `packages/offline/src/writes.ts:259` |
| Food | Log sheet "Meal" handoff dispatches a string while the palette listener reads `detail.query`; palette never opens | `src/shell/desktop-shell.tsx:101` |
| Food | Verify overlay rewrites cached rows to confidence 1.00 under source `ph_core`; later entries claim server provenance for browser-local numbers (M) | `packages/features/src/food/verify-model.ts:106` |
| Offline | Delete pushes the tombstone immediately; server tombstones are irreversible, so the 8-second Undo fails whenever sync is fast (M) | `packages/offline/src/writes.ts:213` |
| Home | "Next up" hero is the first block of the day regardless of time or completion | `packages/features/src/botanical/home.tsx:86` |
| Routing | Legacy `/app/*` redirect map points at wrong destinations now that goals/life/grove/settings exist | `src/app/app/[[...slug]]/page.tsx:3` |
| CSS | Global `:focus-visible` sets `border-radius: 4px`, so pills and cards snap square on keyboard focus | `src/app/glass.css:281` |
| CSS | Press feedback fires twice; `glass.css` and `web-motion.css` both own `:active` at equal specificity | `src/app/glass.css:434` |
| Deps | `packages/config` pins Next 16.3.1, so the lockfile carries two Next versions and the vulnerable sharp 0.35.3 beside the patched one | `packages/config/package.json:27` |
| Legal | Landing promises data export; Settings says export and delete are unavailable; no privacy, terms or support link anywhere; the draft privacy notice forbids implying an export tool (M) | `src/app/landing/landing.tsx:85` |
| Env | `.env.example` documents 3 of ~28 variables and says the service-role key is not needed, while every AI route 503s without it | `.env.example:4` |
| Runtime | No `error.tsx`, `global-error.tsx`, `not-found.tsx` or `loading.tsx` anywhere; no monitoring sink of any kind (M) | `src/app/` |
| Locale | Asia/Manila and en-PH are hard-coded as fallbacks in logical-date, features, e2e helpers and DB defaults against the global direction | `packages/offline/src/logical-date.ts:7` and 15 more sites |

Known before this review and still open: USDA key returns 403; legal texts are drafts;
hosted preview smoke, native zoom and screen-reader review, and rollback retention are pending.

## Refactor plan, in sequence

The order matters. Several reviewers recommend moving files inside `packages/`; doing that
before the fork decision widens the blast radius of the sync script.

**Phase 0 — make the tree buildable (1 day).** Fix the CSS-module selector. Commit the 13
untracked source files. Split the 89-entry working tree into self-contained commits:
security dependency remediation; global food search; launch metadata and robots/sitemap;
legal drafts and direction docs; botanical/glass redesign. Gitignore or delete
`conversational_calorie_tracker_v1/`, `gym_knowledge_base_v1/`, `kayamo-build-prompts/`,
`.claude/launch.json` (port 3012 vs 3002), untrack `next-env.d.ts`, drop the 1.9 MB
`comparison-v5.png` from the staged set. Delete `scripts/web-ai-allowance.mjs` and
`scripts/run-disposable-db-tests.mjs` (bound to a dated temp project). Add the database
hostname guard. Push CI green once.

**Phase 1 — settle ownership and truth (1 day).** Fork `packages/` (decision 1). Rewrite
`.cursor/rules/000-project.mdc`, `010-mus-sot.mdc` and `100-stack.mdc` for this repository:
root Next 16 app at `src/`, no `apps/*`, no turbo, Lis, global market, English default,
timezone from profile with device fallback. Track `docs/global-product-direction.md`.
Archive the Coco/PWA/monorepo-era docs. Write `docs/RELEASE.md` as the only checklist.

**Phase 2 — safety and correctness quick wins (2–3 days).** The confirmed-defects table
above, plus: reserve the AI allowance after body parsing in the five routes that still burn
a slot on a 400; classify permanent server rejections in the sync queue; delay tombstone
pushes by the undo window; add `pnpm check:copy` to CI; add a production-build Playwright
project (`pnpm build && pnpm start`) for the nine hosted-safe specs; set `retries: 1` so
traces are captured; add a `concurrency` group and `permissions` block to CI.

**Phase 3 — structural refactor (1–2 weeks, parallel with Phase 4).**
- *Barrels.* Give `@kayamo/features` a web-safe entry and stop importing the main barrel
  from `src/`; six root client files currently pull the phone screens and the 4,817-line
  `kayamo-app.module.css` into every route's client graph. Move `getServiceSupabaseEnv` and
  the drizzle `pgTable` off the `@kayamo/db` root barrel. Then prune dead exports with
  ts-prune or knip (regex upper bounds: features 66/73 unused, offline 152/315, core 134/172).
- *API.* A route kit in `src/lib/api` (`requireUser`, `noStore`, `jsonError`) and one AI gate
  module in `packages/features/src/mus`; the auth preamble is copied in 9 routes, the
  telemetry insert in 5, the env-number parser in 3. Move the gym consult prompt out of the
  route file. Fix `/api/foods/parse`, which has silently never reached the model since Sep 8.
- *DB.* One `lwwUpsert` and one `tombstone` in `queries/lww.ts` driven by the sync contract;
  the sequence is hand-copied about sixteen times with three competing generics. Type the
  Supabase client factories. Reconcile Drizzle schema with SQL (~35 constraints drift) or
  demote Drizzle to a drift check.
- *Offline.* Split `db.ts` (1,074 lines) into types, schema, scope, legacy migration, ids.
  Replace the four hand-maintained table lists and the 26-case push switch with one manifest
  a test asserts complete. Let domain writers emit an event instead of importing the sync
  orchestrator (55 `drainQueue` call sites; 12 of 23 test files mock it). Delete the 26
  legacy `mergeRemote*` functions and `useLocalAppSnapshot`. Assert account scope on every
  local write, not only in `goal-plan.ts`.
- *Food features.* Split `desk.module.css` (3,689 lines, 14 consumers across food/ and desk/)
  by owner: shell primitives, diary, catalog/inspector, planner, movement, Lis thread. Collapse
  five copies of catalog hydration and four history mappers into `@kayamo/offline` and one
  provenance module. Move `LogSheet` and `CompanionSettings` from `src/shell` into packages.
  Delete `ConversationalLog`, `conversational-ledger`, `personal-food-memory` (never rendered).
- *Desks.* Decompose `todos-desk.tsx` (1,116 lines, seven responsibilities), `gym-desk.tsx`
  (946) and `mus-thread.tsx` (937, web-only but filed under mobile `screens/`). Replace the
  three overlapping poll loops (2 s, 4 s, 4 s with N+1 Dexie reads) with live queries. Give
  the gym session one source of truth. Delete `DeskHome`, `desk-charts`, `GymPicker`,
  `use-nav-counts`, `mus-rail-mount`, `placeholder`, `locale-toggle`, `perm-levels`,
  `MusProposalCard`, `tools.ts`, `phrase-cache` (all orphaned or vestigial).
- *AI.* Collapse the two model entry points (`openai-provider.ts` bypasses `router.ts` and the
  nutrition-key guard). Split `contracts.ts` (761 lines). Add a numeric post-filter on model
  messages so the nutrition rule is enforced on output, not only schema keys. Add unit tests
  for `apply-proposal.ts` (503 lines, every Lis write path, zero tests) before touching it.

**Phase 4 — design-system consolidation (parallel with Phase 3).** Today there are 25 CSS
files, 15,567 lines, six token sources redefining the same concepts, 30+ radii, 6 focus-ring
variants, 17 font stacks. Sequence: (1) one token file in `packages/ui/src/tokens.css` with
the glass values; (2) delete `botanical.css`'s palette block now (glass re-declares every
property on the same selector, so it is dead); (3) migrate its 48 `[class*=]` substring
overrides into the owning modules for `/goals`, `/verify` and `/mus`, then delete the file;
(4) make `web-motion.css` the sole interaction contract and fix the focus-radius and double
`:active` bugs; (5) move `kg*` materials into `packages/ui` so package CSS stops depending on
root-app globals (315 references today); (6) switch px type to rem so the 200% text test
stops passing vacuously; (7) add forced-colors handling (glass draws edges with box-shadow and
`border: 0`); (8) collapse the three reduced-motion/transparency/contrast declarations into
one. Retire `tokens.test.ts`, which pins values nothing renders.

**Phase 5 — finish the design per route.**

| Route | Today | To finish |
| --- | --- | --- |
| `/` landing | glass, complete | none |
| `/login` | legacy `--color-*` layer, system font | glass pass (S–M) |
| `/today` | glass, complete | Next-up bug, `en-PH` ×4, `<a href>` hard navigations, 5 s polling |
| `/goals` | glass list; editor is the 390px mobile `GoalFlow` inside a glass dialog, patched by substring selectors | rewrite as `botanical/goal-editor.tsx` on glass primitives (L), or ship patched |
| `/life` | glass hub | remove roadmap copy shown to users |
| `/grove` | glass layout | raw enum keys, contradictory streak copy ("never dies" beside "not a streak"), no tree visual, unpopulatable Life Story panel |
| `/mus` | glass desk, legacy ProposalCard, ~60 lines of overrides | ProposalCard on glass; decide `/lis` slug |
| `/calories` `/foods` `/verify` | legacy desk, zero glass primitives | glass pass on `desk.module.css` after the split |
| `/gym` `/todos` | legacy desk, zero glass primitives, absent from design docs | convert (L each) or hide for v1 |
| `/settings` | glass | export/delete rows are placeholders; demo guests see a companion editor that always fails |

Also: the phone tab bar's centre "+" contradicts the five-tabs rule; the desktop rail has
seven items. The design docs describe an opaque textured botanical UI while the code renders
glass; record the glass pass or the docs stay wrong.

**Phase 6 — ship gates.** See the checklist below.

## Release checklist

Owner actions:
1. Apply migrations 0018, 0021, 0022 to the hosted project; confirm `GET /api/mus/permissions`
   returns 200; record the applied set in `docs/releases/`.
2. Decide the production branch; align Vercel, `origin/HEAD` and the PR base.
3. Stop pointing local dev and e2e at production. Use a local Supabase or a dev project. The
   skip-login flow currently creates `local@kayamo.test` in production Auth via the service role.
4. Replace `USDA_FDC_API_KEY` locally and in Vercel; verify one lookup; then run the cached
   `usda_fdc` audit.
5. Set the full server environment in Vercel (service-role key, OpenAI key, model ids, budgets,
   USDA key, OFF user agent). Rewrite `.env.example` to list all of them.
6. Approve legal copy, operator name and support address. The compliance analysis covers only
   RA 10173; there is no GDPR, UK GDPR or CCPA assessment for a now-global health-data app.
   Add `/privacy`, `/terms` and `/accessibility` routes and footer links.
7. Confirm Supabase backups (PITR vs daily), retention of tombstoned rows and AI logs, and auth
   rate limits or captcha for magic-link OTP before a public URL is promoted.
8. Choose an error-monitoring sink. Nothing observes production failures today.
9. Preview approval, screen-reader and native zoom review, rollback retention (already known).

Code actions: everything in Ship blockers, the confirmed-defects table, and Phase 2.

## Per-area health

- **Root app.** Thin in the right way: every shell page is a five-line composition. Guest demo
  is isolated by construction. Defects are auth edges, three stacked theme generations, six
  dead shell files, and product UI (`log-sheet`, `companion-settings`) that belongs in packages.
- **API routes.** Every route except the cookie-only demo authenticates first; bodies are
  strict Zod except worldwide search; no upstream errors leak; four `console.error` calls, none
  with content. Correction from the critic: ten client files import the `@kayamo/db` root barrel
  for the browser client; none import `/service`. Plumbing is copy-pasted; `/api/foods/parse`
  is defective; the worldwide route is untracked.
- **Food features.** Two products in one directory: the live desk (TodayTable, FoodsTable,
  VerifyTable, CommandLog, WorldwideFoodSearch) and never-rendered mobile components. Writes
  go through the outbox with provenance. Nine web-only modules do not exist in mobile.
- **Shell and desks.** Mobile-origin `screens/` layer is dead on web except `GoalFlow`, which
  uses 38 of 253 classes in `kayamo-app.module.css`. Web desks diverge from mobile by hundreds
  of lines each. No unit tests in the area.
- **Botanical, journey, todo, gym.** Domain code is tested and honours propose/confirm and
  reduced motion. Screens are less finished than the docs claim (see route table). The 316 KB
  gym knowledge base and O(n²) relationship inference run at module load in the client bundle.
- **AI and Lis.** Governance is strong: Zod on every call, permissions enforced at data
  assembly, no auto-apply path. Edges are weak: over-broad eating-disorder regexes,
  English-only crisis detection, PH-only crisis footer, two model entry points, no
  `apply-proposal` tests, three generations of naming.
- **Offline and sync.** One of the healthiest packages: per-account databases, commit-ordered
  cursor, tombstones win, 23 test files including adversarial repair. Defects: undo race,
  four hand-maintained table lists plus a 26-case switch, `db.ts` size, Manila default,
  ~140 unused barrel exports, no device-local data deletion path.
- **DB and migrations.** All 46 tables have RLS; calorie floors are a database trigger. Problems
  are operational: hosted schema behind, two migration runners, Drizzle drift, sixteen LWW
  copies, scripts that can write to production, Philippines-first column defaults.
- **Food and core domain.** Resolver cascade always carries source and confidence; LLM schemas
  are number-free; TDEE floors and caps are correct with `clamped: true`. But the target engine
  has zero web callers (no guidance route), the USDA HTTP layer retries 403s, `parseFoodQuery`
  treats multi-number text as a barcode, and the package barrel ships server-only fetchers
  into client components.
- **Design system and CSS.** Five-deep token cascade; glass wins everywhere it is loaded.
  Six modules have zero unreferenced classes. Tailwind is effectively preflight plus utilities
  for six primitives. Package CSS depends on root-app globals 315 times.
- **Tests, CI, tooling, release.** 19 Playwright specs across three engines with axe on every
  route, disposable Supabase in CI. Missing: production-build e2e, preview smoke, traces,
  bundle budget, `check:copy` in CI. Ten specs skip silently on hosted URLs; authenticated
  specs vanish if skip-login is absent. Docs hold four different unit-test totals.
- **Cross-cutting.** Import graph is acyclic and boundary-clean; zero `any`, zero TODOs. Nine
  orphan files. The sync rule is dead in practice. Barrel APIs are 4–10× larger than consumers use.

## Corrections and limits

- Zero verified findings were refuted. Four were downgraded from P1 to P2 (set-session page,
  Next-up hero, production `DATABASE_URL` scripts, target engine with no web caller). The two
  reviewer P0s (untracked imports, hosted schema) were rated P1 by verifiers; this report keeps
  them as blockers because they stop a deploy.
- The critic corrected three reviewer claims: the "no client file imports `@kayamo/db`" statement
  (ten do, via the root barrel); the week-stats `food_id` drop lives in
  `packages/offline/src/writes.ts:259`, not the diary; the "Set up targets" copy is in a mobile
  screen the web never renders, though the zero-callers fact stands.
- `botanical.css` is partly dead (palette) and partly live (48 overrides); the two must be
  removed in that order.
- Bundle-size claims come from dev chunks; no production build has been measured or budgeted.
- Hosted database state is inferred from the Sep 15 QA audit and today's `PGRST205` log line,
  not from querying the project.
- Not covered in depth: most of `packages/core` beyond targets/TDEE/progression, `packages/config`
  as a unit, the smaller `packages/ui` primitives, `vercel.json` headers/regions, the `data/`
  corpora and binary knowledge bases tracked in git, Supabase hosted auth configuration.

## Consolidated open questions for the owner

1. Fork `packages/` from mobile, or keep syncing with an exclude list?
2. Is the shipped system called glass or botanical, and which token file is canonical?
3. Is "Lis" final for copy? Does the mascot ship? Does the route become `/lis`?
4. Do Gym and Todos ship on the legacy skin, get converted, or hide for v1?
5. Is `/verify` an end-user surface or a curator tool to gate?
6. Is the eight-second Undo a requirement? If yes, tombstone pushes must be delayed.
7. Should the goal editor be rewritten before ship or shipped patched?
8. Taglish: retire from chrome entirely, or resurface as a Settings language row?
9. Grove: keep the streak concept? Is a tree visual in scope? Is Life Story a web feature?
10. Should the web compute nutrition targets itself (port mobile's guidance route) or depend on
    the mobile app having written them? Web-only accounts can never receive a target today.
11. Which branch does Vercel build, and which branch should PRs target?
12. Were any `usda_fdc` branded rows cached in production under the old conversion?
13. Which jurisdictions' privacy law applies to the global launch, and who reviews the drafts?
14. Is `contact@kayamo.ph` (Open Food Facts user agent) and `kayamo.ph` (API origin allow-list)
    still owned?

## Phase 0 outcome — 2026-09-18

Phase 0 ran on this branch. Eight commits, `d29b30c` through `789a233`.

Resolved:

- **Build failure.** `glass-materials.module.css` became `glass-materials.css`, a
  plain global stylesheet imported last from `globals.css`. The premise behind the
  module was tested and disproved: `backdrop-filter` survives the Tailwind pipeline,
  and all five material tiers ship intact in `.next/static/css`. Verified in the
  browser against the production server, including the reduced-transparency toggle.
- **Untracked imports.** Fourteen files plus three one-line export additions
  (`@kayamo/ui` exports map, `@kayamo/food/search-ui`, `@kayamo/offline`) are tracked.
  Proved by stashing everything else and running the suite on the bare commit:
  typecheck, lint, build and 713 unit tests all pass.
- **Working tree.** 89 entries became eight self-contained commits: build repair,
  dependency remediation, nutrition correctness, global-direction tests, motion,
  e2e specs, design docs, project docs, repository hygiene.
- **Scripts that could write to production.** `requireDatabaseUrl` now refuses a
  non-loopback host unless `KAYAMO_ALLOW_REMOTE_DB=1`. `web-ai-allowance.mjs` and
  `run-disposable-db-tests.mjs` are gone.
- **Repository hygiene.** `next-env.d.ts` untracked; raw drops and tooling output
  ignored; `.claude/launch.json` corrected from port 3012 to 3002.

Verification on the final tree: typecheck, lint, 713 unit tests, `test:security`,
production build and `pnpm audit --prod` all pass. 36 guest-safe Playwright tests
pass on Chromium.

Two things Phase 0 found that the review did not:

- **The e2e suite cannot run against a production build.** A leftover `next start`
  on port 3002 was reused by Playwright and 16 of 22 tests failed. The cause is
  `src/app/api/demo/route.ts:24`, `secure: process.env.NODE_ENV === 'production'`:
  over plain HTTP the guest cookie is rejected, so the demo never reaches `/today`.
  Correct on real HTTPS, but the production-build e2e job planned for Phase 2 needs
  HTTPS or a cookie accommodation. Set `reuseExistingServer: false`, or stop stray
  servers, before trusting a local run.
- **`gym_knowledge_base_v1/` at the repo root is not a duplicate of `data/gym/`.**
  It is newer and richer: its `BUILD_SUMMARY.json` carries `app_workflow_steps`,
  `app_builder_actions`, `app_ai_session_rules` and `app_rest_timer_rules`, and
  exercise flags differ. The build scripts read `data/gym/csv`, so nothing consumes
  it. The path is ignored, not deleted. Promoting it is a content decision.

Not done in Phase 0, deliberately: nothing is pushed, and the two migration runners
are untouched because that interacts with the hosted-schema and package-ownership
decisions in Phase 1.

## Phase 2 outcome — 2026-09-18

Fourteen commits, `b053805` through `81952f2`, on Fable 5.1 at high effort. Every
fix was written test-first where a unit test could express it, and several were
also proved red against the old code in the browser before being proved green.

Resolved, all from the confirmed-defects table:

- **Auth.** The `next` guard rejects protocol-relative and backslash paths and
  the callback re-checks the origin; `/auth/set-session` and `/auth/complete`
  removed; `/settings` gated. A first draft derived the proxy matcher from the
  shared list and broke every request, because Next parses the matcher at
  compile time; a running server caught it before push, and a test now pins the
  literal to the list.
- **Headers.** Baseline set on every response, HSTS in production, pinned by a
  unit test and an e2e. A `script-src` policy is deliberately absent and pinned
  absent until the inline boot scripts carry nonces.
- **Safety classifier.** Meal talk no longer trips the eating-disorder path;
  Filipino and Taglish banks for all four categories; household abuse covered.
  27 tests written first, all now pass.
- **Log sheet.** One factory and one reader for the prefill event; a new e2e
  fails on the old shell and passes on the fix, on all three engines.
- **Week statistics.** A ledger query for totals beside the catalog-only history
  for re-logging.
- **Undo.** The tombstone is held for the undo window and a restore supersedes it.
- **Verify provenance.** Base confidence survives a local verification and an
  overlaid row logs `resolved_via: 'user'`. One existing test had pinned the 1.00
  and was corrected as a stated product decision.
- **Recovery pages.** 404, route error boundary and global error page.
- **Allowance.** All five AI routes reserve after the body parses, with the first
  tests those handlers have had.
- **`agent_runs` column grant.** Migration 0023 plus an RLS test that expects
  42501 on a `cost_usd` write. Verified by CI's disposable database, not locally.
- **CI.** Concurrency group, read-only token, one retry so traces record, report
  kept on failure, banned-copy sweep in the pipeline.

CI on this branch, which had never run before Phase 0, went from four failures to
one across three runs. The Lis-rail mock was missing the fifth permission domain;
the entry-pages WebKit failure was typing before hydration; the todos WebKit
failure was three engines sharing one account. The remaining single failure in
run three was a WebKit internal error on `page.goto`, which the CI retry now
absorbs. The run that verifies migration 0023 is in flight as this is written.

Not done in Phase 2, and recorded in `docs/RELEASE.md`: legal routes, the landing
export claim, the cached USDA audit, e2e against a production build, preview
smoke and Lighthouse, the migration-runner decision, and taking Gym and Todos off
the rail. All belong to later phases.

## Phase 3 outcome — 2026-09-18

Seven commits, `8ac2efe` through `0347ca6`, on Fable 5.1 at high effort. Each slice
was committed independently green: typecheck, lint, the affected unit suites, and
where the change could show, a production build and the guest e2e specs.

- **Features entry boundary.** Root code imports `@kayamo/features/desktop` only; a
  test scans `src/` and fails on the main barrel. Measured on the production build,
  this bought 4 KB of JS and 2.4 KB of CSS, not the phone stylesheet the review
  attributed to it: webpack had already tree-shaken the phone screens, and
  `kayamo-app.module.css` ships because `journey/goal-flow.tsx` imports it directly.
  That is a goal-editor problem for Phase 4, and the review's attribution was wrong.
- **API route kit.** `requireUser`, `json`, `jsonError`, `errorCode` in `src/lib/api.ts`;
  nine routes migrated; every authenticated response now `private, no-store`.
  Consolidating the env-number parser surfaced a shared latent defect: `Number('')`
  is 0, so a blank budget variable would have zeroed the budget. Blank now means unset.
- **Dead code.** Thirty-one files and the resolver's model-estimate rung, each
  confirmed unreachable; the two name collisions the search produced were run down by
  hand. The rung contradicted the constitution and had no caller.
- **One SDK touchpoint.** `callOpenAIObject` in `router.ts` is the only import of the
  model SDK; the chat provider calls it and now runs the nutrition-key guard. Writing
  the provider's first unit test found that the guard threw on the chat schema's
  transform; it now reads the schema's input side, which is the right question.
- **Sync push manifest.** A 26-case switch and a 26-branch predicate became one
  `satisfies Record<SyncableTable, PushHandler>` manifest, exhaustive at compile time,
  with a test pinning it to the sync contract. 146 offline tests unchanged.
- **Desk stylesheet.** 114 rules whose every class was unused removed (3,689 → 2,939
  lines), plus a test that every `styles.<name>` reference across `packages/features`
  and `src` is defined in its module. It corrects one review finding: the sign-out
  button's class does exist.
- **Lis thread** moved from the phone `screens/` directory to `mus/`.

Deferred, with reasons, in `docs/RELEASE.md`: server LWW consolidation (server write
semantics, CI-only guard, its own gated slice), the `db.ts` and `contracts.ts` splits,
the desk stylesheet split by owner (per surface in Phase 4), and decomposing the two
desks that are off the v1 rail.

## Phase 4 outcome — 2026-09-18

Four commits, `756a31f` through `2a7534c`, on Fable 5.1 at high effort. Because
this phase changes how every route looks, eighteen full-page screenshots of every
demo route at 1440 and 390 were captured before the first change and every slice
was compared against them; all still match within 0.2% at the end.

- **Glass tokens and materials live in `packages/ui`** (`@kayamo/ui/glass.css`,
  `@kayamo/ui/glass-materials.css`). Package stylesheets no longer depend on files
  outside any package.
- **Two cascade bugs fixed at the source.** The focus ring no longer forces
  `border-radius: 4px`; a new e2e tabs to a pill and asserts it stays round on three
  engines, and fails on the old rule. Press feedback fires once: `web-motion.css`
  is the only press contract, `glass.css`'s duplicate is gone, thirteen component
  transforms are removed, and the rail and tab bar's richer presses are written as
  `scale` so they override the magnitude instead of compounding.
- **`botanical.css` is gone.** The review called its palette dead; the colours
  were, but its type and radius scale was live, and deleting the file whole would
  have swapped the body font. Those tokens moved to `glass.css`. Its 48 substring
  overrides moved into the modules that own the classes, as ordinary rules;
  eighteen targeted the phone thread's stylesheet or classes that no longer exist
  and were dropped. The two accessibility intents `glass.css` lacked were carried.
- **Type in rem, no root pin, forced colours.** 290 font sizes converted; the 200%
  text check now scales real type and still passes; Windows High Contrast gets real
  borders on every material tier.

Not done, and recorded in `docs/RELEASE.md`: retiring the `--color-*` bridge (per
surface in Phase 5), GoalFlow's own module, the desk stylesheet split, and merging
the Tailwind theme palette into glass.

One process note: the shell spec run during the final verification is
authenticated and used the local skip-login against the hosted project, which the
release checklist asks the owner to stop pointing local development at. The
account it used already existed from earlier runs; nothing new was created.

## Phase 5 outcome — 2026-09-19

Eight commits, `97bf106` through `8da9f52`, on Fable 5.1 at high effort. Per-route
finish, in the order the review's table listed the routes.

- **Rail and Life hub.** Gym and Todos are off both (owner decision). The Life hub
  lost its roadmap paragraph; the landing's export promise is replaced with what is
  true. Left as an owner call: Home still deep-links to both routes and the log
  sheet's Workout kind opens Gym.
- **Grove.** Stored keys are shown as words (Young tree, Milestone completed); the
  streak card and the total card now tell one story about quiet days; the Life Story
  panel, which nothing on the web could populate, is gone. Text-only by decision.
- **Login.** The last public entry page off the system: one kgSurface card over the
  landing's wash, Manrope titles, glass tokens throughout, and the shared form no
  longer draws a card the route has to undo.
- **Lis has a face.** The product decision changed and two committed assertions
  changed with it, stated in the commit: `e2e/mus.spec.ts` now asserts a neutral,
  decorative face is present, and `icons.tsx` no longer says there is no mascot.
  `LisFace` draws one of the four shipped expressions; `mus-faces.ts` decides which,
  reading the reply's tone and safety verdict that nothing had read before.
- **Goal editor rewritten** on glass with its own module. Every pinned string kept;
  the phone flow, its 4,817-line stylesheet and the dialog's substring bridge are
  deleted. One regression caught before commit: a bare `display: flex` on the
  dialog modifier overrode the UA's hidden state for closed dialogs.
- **Food surfaces.** The 3,055-line desk stylesheet is split by owner into diary,
  catalog and the legacy desk; 220 `--color-*` reads across the food modules, the
  shared ProposalCard and the Lis modules are converted to glass tokens. Both steps
  were checked as identity transformations against six full-page pixel baselines.
  The review's "zero glass primitives" line predates Phase 4's override migration;
  the surfaces already rendered the glass look, and now the stylesheets say so.
  The shared ProposalCard is restyled onto glass (radius, pills, inset strokes).

Not done, and recorded in `docs/RELEASE.md`: the `--color-*` bridge (blocked on
Toast and Button), `/settings` placeholders, the `/today` items, and the owner call
on Home's links into Gym and Todos.
