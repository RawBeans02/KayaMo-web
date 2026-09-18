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

- [ ] **Apply the pending migrations.** `supabase migration list --linked`, then
      push 0018, 0021, 0022 and 0023 (the agent_runs column grant, added in
      Phase 2). The Sep 15 QA found `mus_context_permissions`
      (0018) missing from the deployed database; 0021 and 0022 have no
      application record at all. Confirm `GET /api/mus/permissions` returns 200.
      Record the applied set under `docs/releases/`. Until this is done, Lis
      permissions and profile return 500 in production.
- [x] **Production branch is `main`.** Decided 2026-09-18. Vercel builds `main`,
      and GitHub's default branch is already `main`. `origin/feat/web` is stale
      at 2026-09-01; do not target it. **A merge to `main` deploys**, so nothing
      merges while this checklist reads BLOCKED.
- [ ] **Stop pointing local development at production.** `.env.local` aims both
      `NEXT_PUBLIC_SUPABASE_URL` and `DATABASE_URL` at the hosted project, so
      local e2e creates `local@kayamo.test` in production Auth through the
      service role and UI-driven tests write to production tables. Use a local
      Supabase or a separate development project, then purge the test account
      and any `E2E *` rows.
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
- [ ] **Add `/privacy`, `/terms` and `/accessibility` routes** and link them.
      Nothing in the app links to any policy today.
- [ ] **Fix the export claim.** The landing promises data export; Settings says
      it is unavailable; the draft privacy notice forbids implying it exists.
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
- [ ] **Run e2e against a production build.** CI only ever serves `next dev`.
      Also owed: the AI routes' allowance is now reserved after the body parses
      in every route (done 2026-09-18), but no e2e exercises them authenticated.
      Note the guest cookie is `Secure` under `NODE_ENV=production`, so a
      plain-HTTP localhost run fails the demo; the job needs HTTPS or an
      accommodation.
- [ ] **Add preview smoke, Lighthouse and a bundle budget.** No production bundle
      has ever been measured.
- [x] **Add `pnpm check:copy` to CI.** Also: a concurrency group, a read-only
      token, one retry in CI so traces record, and the report kept on failure.
      2026-09-18.
- [ ] **Settle the migration runners.** Two exist with divergent bookkeeping and
      the Drizzle journal stops at 0019 with no snapshots.
- [ ] **Take Gym and Todos off the rail and the Life hub** per the v1 scope
      decision. `src/shell/desktop-shell.tsx` still lists `/gym` in `RAIL` and
      both routes in `LIFE_ROUTES`.

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

- Gym and Todos. They function but render the legacy desk skin, so they come
  off the rail and the Life hub for v1. Not yet implemented; see the code action
  below.
- Native iOS and Android. `../kayamo-mobile` owns that.
- Circles, and any social surface.
- Billing. There is no paywall, so the monetization items in the Build SOT are
  future experiments, not gates.
- Push notifications. VAPID keys exist in the environment but nothing reads them.
