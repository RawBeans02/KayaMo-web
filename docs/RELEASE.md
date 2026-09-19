# Release checklist — kayamo.fit

The single checklist. Gates used to live in `design-qa.md`,
`docs/design/botanical/release-candidate.md`, `docs/tutorial-application.md`,
`docs/security-remediation-2026-09-15.md`, the archived `09-launch.md` and the
September audits, none of them complete and none agreeing. Those files stay as
dated records. This file is the one that decides whether we ship.

**Status: BLOCKED.** Last reviewed 2026-09-18.

Evidence lives in `docs/audits/2026-09-18-codebase-review.md` (12-area review, 27
independently verified findings) and `docs/audits/2026-09-18-build-sot-audit.md`
(audit against the owner's Build SOT).

---

## Owner actions

Things only the owner can do. Most of the release is waiting on these.

- [x] **Apply the pending migrations.** Done 2026-09-19: ten migrations
      (0013–0019, 0021–0023) pushed with the Supabase CLI after backups and a
      history repair; every object verified present read-only. Record:
      `docs/releases/2026-09-19-hosted-migrations.md`. Still to confirm from a
      signed-in session: `GET /api/mus/permissions` returns 200 on the hosted app.
- [x] **Production branch is `main`.** Decided 2026-09-18. Vercel builds `main`,
      and GitHub's default branch is already `main`. `origin/feat/web` is stale
      at 2026-09-01; do not target it. **A merge to `main` deploys**, so nothing
      merges while this checklist reads BLOCKED.
- [x] **Stop pointing local development at production.** Done 2026-09-19:
      `npx supabase start` (Docker Desktop) runs the stack locally, all 23
      migrations applied by `db reset`, `scripts/seed.ts` seeded it, and
      `.env.local` now carries the local URL, keys and `DATABASE_URL` with the
      hosted lines kept commented beside them. Verified: the local skip-login
      creates `local@kayamo.test` in the *local* Auth, sync reports `synced`,
      and `GET /api/mus/permissions` returns 200 with the five domains. The owner
      deleted `local@kayamo.test` from the hosted Auth the same day; the
      `ON DELETE CASCADE` on every `user_id` took its rows with it, and a
      read-only sweep found zero `E2E *` rows and zero orphaned rows across the
      user tables afterwards. Three real accounts remain.
- [ ] **Fix the USDA key.** The configured `USDA_FDC_API_KEY` returns 403.
      Replace it locally and in Vercel, verify one lookup, then run the cached
      `usda_fdc` audit below.
- [ ] **Set the full server environment in Vercel.** `SUPABASE_SERVICE_ROLE_KEY`,
      `OPENAI_API_KEY`, the `MODEL_*` names, the budget knobs, `USDA_FDC_API_KEY`,
      `OFF_USER_AGENT`. Every AI route returns 503 without the service-role key.
- [ ] **Approve the legal texts and the operator identity.** Legal name,
      jurisdiction, and a monitored support address. The drafts in `docs/legal/`
      are drafts, and the retention and deletion policies in them are proposals,
      not implemented behaviour.
- [ ] **Decide the regulatory scope.** `docs/compliance.md` covers RA 10173 only
      and predates the global direction. There is no GDPR, UK GDPR or CCPA
      assessment for a health-data product. This needs professional review.
- [ ] **Confirm backups and recovery.** Supabase plan, point-in-time recovery or
      daily backups, retention of tombstoned rows and AI logs, and an acceptable
      data-loss and recovery-time target.
- [ ] **Confirm hosted auth limits.** Magic-link OTP rate limits, and captcha if
      needed, before a public URL is promoted.
- [ ] **Choose an error-monitoring sink.** Nothing observes production failures
      today.
- [ ] **Verify `kayamo.fit` in Search Console** and submit the sitemap after
      deployment.
- [ ] **Confirm rollback.** Check the recorded deployment is still retained in
      Vercel and rehearse restoring it.
- [ ] **Approve the preview** after the hosted smoke below.

## Code actions

- [x] Production build passes. Fixed 2026-09-18; the CSS module that broke
      `next build --webpack` is now a global stylesheet.
- [x] No committed file imports something git does not track. Verified by
      building the repair commit in isolation.
- [x] Dependency remediation applied and gated in CI. Zero production advisories.
- [x] Writable database connections refuse a non-loopback host without
      `KAYAMO_ALLOW_REMOTE_DB=1`.
- [x] **Restrict `agent_runs` writes.** Migration 0023 revokes table-wide UPDATE
      and grants only `scrubbed_at`; the RLS suite asserts a `cost_usd` write
      fails with 42501. Written 2026-09-18; the owner still has to apply it.
- [x] **Close the auth gaps.** The `next` guard rejects protocol-relative and
      backslash paths and the callback re-checks the origin; `/auth/set-session`
      and `/auth/complete` are gone; `/settings` is gated, and a test pins the
      shell directory to the protected list. 2026-09-18.
- [x] **Add security headers.** frame-ancestors, X-Frame-Options, nosniff,
      Referrer-Policy, Permissions-Policy on every response; HSTS in production.
      2026-09-18. **Follow-up:** a `script-src` policy needs per-request nonces
      for the two inline boot scripts and the JSON-LD; ship it Report-Only first.
- [x] **Add an error boundary and a 404.** `not-found.tsx`, `error.tsx` and
      `global-error.tsx` on the glass materials; the error page shows only the
      digest. 2026-09-18.
- [x] **Add `/privacy`, `/terms` and `/accessibility` routes** and link them.
      Done 2026-09-19 from the drafts with the owner's facts; linked from the
      landing, login and Settings; in the sitemap. They carry a "Draft, under
      review" note until the owner sets `LEGAL_APPROVED_ON` in `src/lib/legal.ts`
      after professional review (still an owner action under legal texts above).
- [x] **Fix the export claim.** The landing promised data export while Settings
      says it is unavailable and the draft privacy notice forbids implying it
      exists. The claim now says the diary is readable offline. 2026-09-19.
- [x] **Fix the safety classifier.** Eating patterns need totality or a span of
      days; Filipino and Taglish banks for all four categories; household abuse
      covered. 2026-09-18. The Filipino bank was written from everyday usage and
      asks for a Filipino-speaking reviewer.
- [x] **Fix the undo race.** The tombstone is held for `FOOD_ENTRY_UNDO_MS`, a
      restore inside the window supersedes it, and the diary and the queue share
      the constant. 2026-09-18.
- [x] **Fix the week statistics.** The diary reads a new `listLocalFoodLedger`;
      the catalog-only history stays for the six re-logging consumers. 2026-09-18.
- [x] **Fix the log sheet handoff.** One factory and one reader for the prefill
      event; a guest-safe e2e proves the draft reaches the palette. 2026-09-18.
- [x] **Fix the Verify provenance rewrite.** A local verification keeps the base
      confidence, and an overlaid row logs `resolved_via: 'user'`. One test that
      pinned the 1.00 was corrected as a stated product decision. 2026-09-18.
- [ ] **Audit cached USDA branded rows.** Rows cached before the per-100g fix
      hold values divided by serving size, and `cacheOnFirstHit` returns an
      existing row forever, so they will not self-correct.
- [x] **Run e2e against a production build.** Done 2026-09-19: a
      `production-e2e` CI job builds with `next build --webpack`, serves it with
      `next start`, and runs the whole suite on three engines
      (`PLAYWRIGHT_WEB_SERVER=start`). The guest cookie is now `Secure` when the
      request arrived over HTTPS (Vercel's `x-forwarded-proto`, or an `https:`
      URL) instead of whenever `NODE_ENV=production`, so the demo works on
      plain-HTTP localhost in that job and is still `Secure` in production.
      Authenticated specs self-skip there (the local skip-login is a
      development-only route). Still owed: no e2e exercises the AI routes
      authenticated.
- [ ] **Add preview smoke, Lighthouse and a bundle budget.** No production bundle
      has ever been measured.
- [x] **Add `pnpm check:copy` to CI.** Also: a concurrency group, a read-only
      token, one retry in CI so traces record, and the report kept on failure.
      2026-09-18.
- [x] **Settle the migration runners.** Done 2026-09-19: the Supabase CLI
      history is the only record (seeded by the repair; see the release note),
      and the Drizzle runner is gone from the repository: `drizzle-kit`, its
      config, the `generate`/`migrate`/`db:generate` scripts and the stale
      `supabase/migrations/meta/` journal. `packages/db/README.md` documents
      `db push --linked` as the deploy step.
- [x] **Take Gym and Todos off the rail and the Life hub** per the v1 scope
      decision. 2026-09-19. Home's deep links (Open planner, View all tasks,
      the Movement glance, a workout Next-up) and the log sheet's Workout kind
      were removed the same day on the owner's word; both routes still resolve.

## Design-system work deferred out of Phase 4

- **Retire the `--color-*` alias bridge.** glass.css maps the legacy names onto
  glass tokens. Phase 5 converted 220 reads (the food modules, command-log,
  provenance, worldwide search, the shared ProposalCard, login, the Lis modules).
  What remains: `src/shell/shell.module.css` (60 reads, the theme toggle and
  sign-out button; the rest of that file is dead since the glass shell) and the
  `--km-*` half of the bridge, which only the Lis modules' comments mention.
  The bridge cannot go until the Tailwind primitives below are on glass, because
  tokens.css defines the same names as the cream palette and the bridge is what
  makes Toast and Button render glass today.
- ~~GoalFlow's own module~~ done 2026-09-19: `botanical/goal-editor.tsx` with its
  own module; `journey/` and `screens/kayamo-app.module.css` deleted.
- ~~Desk stylesheet split by owner~~ done 2026-09-19: `food/diary.module.css`,
  `food/catalog.module.css`, `desk/desk.module.css`, pixel-identical.
- **tokens.css's cream `@theme` palette.** It remains the Tailwind theme source for
  the `@kayamo/ui` primitives still in use on the web (Toast, Button) and is pinned
  by tokens.test.ts; the glass bridge overrides its runtime values. Restyle those
  two on glass tokens, then retire tokens.css's palette and the bridge together.

## Design work deferred out of Phase 5

- ~~Home's deep links into Gym and Todos and the log sheet's Workout kind~~
  removed 2026-09-19 (owner decision).
- **`/settings`:** the export and delete rows are inert placeholders that say so;
  demo guests see a companion editor whose save always fails. Both need a product
  decision (ship export, or remove the row) before the route is finished.
- **`/today`:** the review's four items (Next-up ordering, `en-PH` formatting in
  four places, `<a href>` hard navigations, 5 s polling) are untouched.
- **`shell.module.css`** still styles only the theme toggle and sign-out button;
  the other 570 lines are the pre-glass shell and can go with the bridge.
- **Grove** is text-only on the web by decision (2026-09-19); a tree illustration
  is not planned for v1.
- **Lis `happy` face** has no trigger on the web; the rule (a milestone the person
  chose) is kept in mus-faces.ts for when Goals renders Lis.
- **Guest 401s.** In the demo, the Lis screen and the dev gallery log repeated
  401 responses from the API in the console (permission and conversation reads
  for a guest). Harmless, pre-existing, noisy; gate those fetches on a signed-in
  user.

## Structural work deferred out of Phase 3

Recorded so the refactor's remaining shape is knowable. None blocks the ship.

- **Server LWW consolidation.** The update-if-older → insert → re-read sequence is
  copied about sixteen times across `packages/db/src/queries/*` with three competing
  generics and one behavioural divergence (a live-unique conflict returns `row: null`
  and the offline push silently drops the write). Consolidating it changes server
  write semantics and is guarded only by CI's live integration suite, so it is its own
  gated slice, not a side effect of a refactor pass.
- **`packages/offline/src/db.ts` split** (1,074 lines: row types, Dexie schema,
  connection lifecycle, scope transitions, legacy migration). The push manifest
  removed the worst of the hand-maintained lists; the split is now churn without a
  behaviour change and can follow when a schema change needs it.
- **`packages/ai/src/contracts.ts` split** (761 lines, five concerns). No ship impact.
- **Desk stylesheet split by owner.** The usage map is in commit 2ced47a: 56 classes
  belong to the diary alone, 63 to the two catalog tables, 65 to the todos surface,
  62 to the gym, 15 shared. Each surface takes its own module when it is restyled in
  Phase 4, under the new CSS-reference test.
- **Desk decomposition** (todos-desk 1,116 lines, gym-desk 946). Both surfaces are off
  the v1 rail; decompose them when they are converted, not before.
- **Lis thread split** (mus-thread 937 lines) with its own module. Design-phase work.

## Follow-ups opened by Phase 2

- `script-src` Content-Security-Policy with per-request nonces, Report-Only first.
- The other authenticated specs still use fixed titles (`E2E Palette Kanin` and
  friends) across three engines sharing one account; the todos spec was isolated
  after a collision, the rest need the same in the e2e fixture consolidation.
- CI run three failed once on `WebKit encountered an internal error` in
  `page.goto`, a browser crash. With one retry in CI it will report as flaky
  with a trace rather than fail the job; watch whether it recurs.
- The vestigial `LlmEstimate` hook in `packages/food/src/resolve.ts` has no
  caller and contradicts the constitution; remove it in the structural refactor.

## Verification before promotion

- [ ] Typecheck, lint, unit tests, `test:security`, production build, `pnpm audit --prod`
- [ ] Full Playwright suite, three engines, against a production build
- [ ] Database integration suite against a disposable Supabase
- [ ] Lighthouse mobile and desktop on the preview: performance, accessibility,
      best practices, SEO, LCP, INP, CLS, TBT, bundle sizes
- [ ] Manual screen-reader pass and native browser zoom to 200%
- [ ] Hosted smoke: sign-in, demo, log a food, Lis replies, sign out
- [ ] Apex and www redirect, HTTPS, and the production canonical

## Out of scope for v1

Recorded so nobody treats them as missing work.

- Gym and Todos. They function but render the legacy desk skin, so they are
  off the rail and the Life hub for v1 (done 2026-09-19). Home's deep links and
  the log sheet's Workout kind still reach them; see the code action above.
- Native iOS and Android. `../kayamo-mobile` owns that.
- Circles, and any social surface.
- Billing. There is no paywall, so the monetization items in the Build SOT are
  future experiments, not gates.
- Push notifications. VAPID keys exist in the environment but nothing reads them.
