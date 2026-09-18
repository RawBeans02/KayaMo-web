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
      push 0018, 0021 and 0022. The Sep 15 QA found `mus_context_permissions`
      (0018) missing from the deployed database; 0021 and 0022 have no
      application record at all. Confirm `GET /api/mus/permissions` returns 200.
      Record the applied set under `docs/releases/`. Until this is done, Lis
      permissions and profile return 500 in production.
- [ ] **Decide the production branch.** Production runs `e7326d8`, which is on
      `origin/main`. `origin/HEAD` points at `origin/feat/web`, 20 commits
      behind. Align Vercel, the default branch and the PR base.
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
- [ ] **Restrict `agent_runs` writes.** Users can update any column of their own
      rows, including `cost_usd`, so the per-user spend ceiling can be zeroed.
      Revoke UPDATE and grant only `scrubbed_at`. Add an RLS test that tries to
      write the cost.
- [ ] **Close the auth gaps.** `authCallbackNextPath` accepts `//evil.example`;
      delete `/auth/set-session`, which logs the browser into any tokens in the
      URL fragment; add `/settings` to the proxy matcher.
- [ ] **Add security headers.** No CSP, frame-ancestors, Referrer-Policy or
      Permissions-Policy is configured.
- [ ] **Add an error boundary and a 404.** There is no `error.tsx`,
      `global-error.tsx`, `not-found.tsx` or `loading.tsx` anywhere.
- [ ] **Add `/privacy`, `/terms` and `/accessibility` routes** and link them.
      Nothing in the app links to any policy today.
- [ ] **Fix the export claim.** The landing promises data export; Settings says
      it is unavailable; the draft privacy notice forbids implying it exists.
- [ ] **Fix the safety classifier.** The eating-disorder patterns match "haven't
      eaten yet" and "stopped eating rice", and the classifier is English-only
      while the persona invites Taglish.
- [ ] **Fix the undo race.** Deleting a food entry pushes the tombstone
      immediately, and server tombstones are irreversible, so the eight-second
      undo fails whenever sync is fast.
- [ ] **Fix the week statistics.** `listLocalFoodHistory` drops every entry
      without a catalog `food_id`, so worldwide-search and personal foods vanish
      from the week average, strip and presence grid.
- [ ] **Fix the log sheet handoff.** The meal route dispatches a string while the
      palette listener reads `detail.query`, so the palette never opens.
- [ ] **Fix the Verify provenance rewrite.** The overlay rewrites cached rows to
      confidence 1.00 under source `ph_core`, so later entries claim server
      provenance for numbers that exist only in one browser.
- [ ] **Audit cached USDA branded rows.** Rows cached before the per-100g fix
      hold values divided by serving size, and `cacheOnFirstHit` returns an
      existing row forever, so they will not self-correct.
- [ ] **Run e2e against a production build.** CI only ever serves `next dev`.
      Note the guest cookie is `Secure` under `NODE_ENV=production`, so a
      plain-HTTP localhost run fails the demo; the job needs HTTPS or an
      accommodation.
- [ ] **Add preview smoke, Lighthouse and a bundle budget.** No production bundle
      has ever been measured.
- [ ] **Add `pnpm check:copy` to CI.** The banned-vocabulary rule is enforced
      only by a script nobody runs.
- [ ] **Settle the migration runners.** Two exist with divergent bookkeeping and
      the Drizzle journal stops at 0019 with no snapshots.
- [ ] **Take Gym and Todos off the rail and the Life hub** per the v1 scope
      decision. `src/shell/desktop-shell.tsx` still lists `/gym` in `RAIL` and
      both routes in `LIFE_ROUTES`.

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
