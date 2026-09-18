# Build SOT audit — kayamo-web, 2026-09-18

Source standard: the owner's `tutorial_compilation.md` "Build Source of Truth" (19 clips). The
earlier 14-clip version was applied on Sep 14 (`docs/tutorial-application.md`). This audit covers
the whole matrix, marks what the newer version adds, and reuses evidence from
`2026-09-18-codebase-review.md` (12-area review, 27 verified P0/P1). Statuses use the SOT legend:
✅ Verified · 🟡 Partial · ❌ Missing · ⭕ Not applicable · 🔍 Runtime verification required ·
🧪 Experiment.

```md
Project / Build: KayaMo web (kayamo.fit)
Platform: Web (Next.js 16 App Router, Supabase, Vercel), desktop-first with phone layout
Environment audited: local working tree + committed HEAD; hosted state inferred from docs and one e2e log
Branch / commit / release: codex/botanical-liquid-glass @ 9db7dc3 + 89 uncommitted entries
Audit date: 2026-09-18
Auditor: Claude (Fable 5.1), on evidence from the same-day codebase review

Blocking findings:
- [RESOLVED in Phase 0] Production build fails (CSS-module :global selector); committed HEAD imports untracked files
- Hosted database behind migrations 0018/0021/0022; Lis permission routes 500 in production
- No error boundary, no 404 page, no monitoring sink
- No privacy/terms/accessibility routes; landing promises an export that does not exist
- Lighthouse / Core Web Vitals never measured on a production build
- Sensitive-column write: users can UPDATE any column of agent_runs, including cost_usd

Phase 0 (2026-09-18, commits d29b30c..789a233) resolved the build blocker and the
untracked-import blocker, and closed the "scripts write to whatever DATABASE_URL names"
risk with a loopback guard. The remaining blocking findings stand.

Accepted exceptions / N/A rationale:
- Native iOS/Android sections: native is deferred; audited only where a rule also binds the web
- Monetization: no billing exists yet; treated as future experiments
- Newsletter, FAQ, print styles, UTM, floating contact, scroll progress, back-to-top: no product need today
```

What the 19-clip SOT adds over the Sep 14 application: the Website Quality Metrics matrix and
Lighthouse release gate; the mascot-as-retention rule; the "vibe-coded fingerprint" list; the App
Store rejection-cycle lessons; RLS sensitive-column rule; the production-readiness iceberg; two
monetization experiments; ideation and ECC/SimSlim notes. Everything below the SEO checklist is new.

## UI / UX Design

| Rule | Status | Evidence / gap |
| --- | --- | --- |
| Hick's Law: one primary action per screen, hidden secondary options | 🟡 | Home has one hero action, but the desktop rail carries 7 destinations and Settings shows inert Export/Delete rows plus a companion editor to demo guests that always fails. Foods offers alias/merge controls on rows it cannot write. Log sheet and ⌘K palette are two competing create surfaces (`src/shell/log-sheet.tsx` vs `packages/features/src/food/command-log.tsx`). |
| Jakob's Law: familiar patterns, ≤5 bottom tabs, Home left, Profile right, create centre | ✅ | `src/shell/desktop-shell.tsx:33-44`: phone bar is Home, Life, [+ Log], Lis, Profile. Note this conflicts with `.cursor/rules/010-mus-sot.mdc` "no sixth primary add tab"; the SOT's Jakob rule 3 explicitly endorses a centre create action. Record the deviation. Swipe-back and pull-to-refresh: ⭕ (desktop web; browser Back preserved). |
| Notification permission after value | ⭕ | No web push. VAPID keys exist in `.env.local` but nothing reads them. If push is added later, use a pre-permission screen. |
| Mascot with explicit personality | 🟡 | Four Lis expressions exist (`public/botanical/mus-*.webp`) and the voice is defined (`packages/ai/src/persona.ts`), but nothing renders the faces, `mus-faces.ts` is dead, `e2e/mus.spec.ts` asserts "no character", and `botanical/icons.tsx` says no mascot. The SOT favours a consistent character across onboarding, empty states, errors and nudges. This is the open product decision from the review; the SOT tips it toward keeping the mascot, with the non-shaming rules intact. |
| Home-screen widgets | ⭕ | Native only; deferred. |
| Vibe-coded fingerprint (20 tells) | 🟡 | Present: glassmorphism cards (the whole system, 72 `backdrop-filter` declarations), 43 em dashes in TSX copy, 19 gradients. Absent: Inter, Lucide, shadcn defaults, purple-blue gradients, emoji headings, badge-above-headline, cursor beams, hover-fade buttons, grain-over-gradient (1 texture, on the nav only). Low-contrast dark mode: 🔍 measure. Inconsistent spacing: ✅ present as a defect, 30+ radii, 6 focus-ring variants, 17 font stacks (design-system review). Action: finish the token consolidation (review Phase 4) and sweep em dashes in copy. |

## Website / SEO / Technical Launch Checklist

| Item | Status | Evidence |
| --- | --- | --- |
| sitemap.xml | ✅ | `src/app/sitemap.ts`, public home only, tested in `e2e/launch-metadata.spec.ts` |
| robots.txt | ✅ | `src/app/robots.ts`; disallows `/api/`, `/auth/`; previews disallow all |
| No unintended noindex | ✅ | Root defaults noindex; only `/` opts in for production. 🔍 confirm on the deployed URL |
| Meta titles / descriptions | 🟡 | Landing and login descriptive; no title template, `/settings` shows bare "Profile" |
| Canonical tags | 🟡 | Public canonical on `/`; `SITE_URL` hardcodes `www.kayamo.fit` while `ports.ts` reads env, so previews emit the production canonical |
| Heading hierarchy, one H1 | ✅ | e2e H1 check on public pages; shell pages 🔍 |
| Alt text | 🟡 | Decorative images handled; axe scans pass; manual screen-reader review still pending |
| Schema markup | ✅ | Factual WebSite JSON-LD on `/` |
| Internal links | ✅ | Rail + Life hub |
| Broken links | ❌ | Privacy, terms, support, accessibility links do not exist; legacy `/app/*` redirect map points at wrong routes |
| Compress images | ✅ | WebP for all UI assets; `public/` is 3.9 MB including 3.5 MB of unreferenced mascot PNGs to delete |
| Core Web Vitals | 🔍 | Never measured; no production build has succeeded on this tree |
| og:image | ✅ | Existing artwork, availability tested |
| URL slugs | 🟡 | `/mus` slug vs "Lis" label; `/calories` vs "Food" label |
| HTTPS | 🔍 | Vercel default; apex/www redirect unverified |
| Backlink strategy | ⭕ | Post-launch |
| Search Console | ❌ | Owner action, not started |
| Mobile responsiveness | ✅ | e2e at 320/390/768/1024/1440; shell overflow test |

## Website quality metrics

### Frontend / UX

| Metric | Status | Evidence / gap |
| --- | --- | --- |
| Dark mode | ✅ | Day/night toggle, boot script, axe in both schemes. Forced-colors: ❌ (glass draws edges with box-shadow and `border: 0`) |
| Sticky header | ✅ | Shell chrome; main scrolls inside the shell (e2e) |
| Mobile menu | ✅ | Phone tab bar; 'Ask Lis' button is 40px, below the promised 44px |
| Hover states | 🟡 | Press states defined in `web-motion.css`, but `glass.css:434` double-fires `:active`, and hover treatment is per-module, not systemic |
| Scroll progress / back-to-top / print / UTM / copy-to-clipboard / FAQ / newsletter / floating contact | ⭕ | No product need |
| Loading states | 🟡 | Foods shows an empty catalog while loading; Home clock starts from UTC before hydration; palette and worldwide search have proper pending/empty/error states |
| Search | ✅ | ⌘K palette with empty/no-result states; worldwide search has failure/empty states |
| Skip-to-content | ✅ | `desktop-shell.tsx:108` → `#main-content`; landing has `id="main-content"` |
| Password visibility toggle | ⭕ | Magic-link auth, no password input |
| Cookie / consent banner | ⭕ | Only first-party auth and guest cookies; no trackers. Revisit if analytics is added |
| Confirmation modal for destructive actions | 🟡 | 5 confirm/dialog sites; food delete uses undo instead, but the undo cannot survive a fast sync (verified). Goal "Release" and account actions: 🔍 |
| Real 404 page | ❌ | No `not-found.tsx`, `error.tsx`, `global-error.tsx` or `loading.tsx` anywhere under `src/app` |
| Last-updated dates | ❌ | No policy pages exist yet to carry them |

### Backend / performance

| Metric | Status | Evidence / gap |
| --- | --- | --- |
| Images optimized | ✅ | WebP; `next/image` usage 🔍 |
| Lazy-load non-critical images | 🔍 | Not audited per image |
| Code splitting | ❌ | Six root client files import the phone-app `@kayamo/features` barrel, pulling the mobile screens and the 4,817-line `kayamo-app.module.css` into every route; 316 KB gym knowledge base plus O(n²) inference runs at module load in the client. Fix is review Phase 3 (web-safe barrel entry) |
| Cache API responses | ✅ | Authenticated responses are `private, no-store` where set; 9 of 12 routes rely on Next's dynamic default rather than an explicit header |
| CDN | 🔍 | Vercel default; verify headers on the deployed domain |
| Minify JS/CSS | 🔍 | Production build currently fails, so unverifiable |
| Database indexes | ✅ | `(user_id, logged_at)`, `(user_id, logical_date)`, `server_updated_at` on food_entries/workouts/tasks; agent_runs indexed. Query plans not checked |
| Reduce re-renders | 🟡 | Three overlapping poll loops (2 s / 4 s / 4 s) with N+1 Dexie reads; `useLiveFoodHistory` mounted by seven components re-reads the whole table on every write |
| Debounce input handlers | 🟡 | No external calls on keystroke (good); local trigram search runs twice per keystroke over a growing catalog |
| Paginate / virtualize | 🟡 | Catalog hydration downloads the whole foods table on mount, twice on `/calories`; food history reads full tables |
| Remove unused dependencies | 🟡 | Two Next versions and two sharp versions in the lockfile via `packages/config` 16.3.1 pin; Tailwind is effectively preflight-only on web |
| Defer third-party scripts | ✅ | None exist; two inline boot scripts only |
| Loading skeleton | ⭕ | Not needed beyond the states above |
| Load balancer | ⭕ | Vercel serverless |
| Compress API payloads | ✅ | Vercel compression; response shapes are small and Zod-bounded |
| Connection pooling | ⭕ | Runtime uses supabase-js over PostgREST; direct Postgres only in scripts |
| Cache expensive queries | ⭕ | None identified |
| N+1 queries | 🟡 | Server: none found. Client: Dexie N+1 in TodosDesk and GymDesk polling |
| Server-side caching | ⭕ | User-scoped data; correctly not cached |
| Lighthouse audit | ❌ | Never run on a production build; no CI step, no budget |

### Lighthouse / performance release gate

All twelve items are unrecorded. Prerequisite: a passing `pnpm build`. Then run Lighthouse mobile and
desktop against a preview deployment for `/`, `/login` and `/today` (demo), record bundle sizes from the
build output, and add a preview-smoke workflow (review Phase 6). Treat the first run as the baseline.

## Legal / Accessibility

| Rule | Status | Evidence / gap |
| --- | --- | --- |
| Accessibility statement, findable in footer | ❌ | Draft exists at `docs/legal/accessibility-statement-draft.md`; no route, no footer link, contact email unconfirmed |
| Actual accessibility work | 🟡 | axe on every route in both schemes at 320px; keyboard tests for editors; skip link. Gaps: px-only type so the 200% test scales nothing; no forced-colors; Verify page hijacks Enter/j/k at window level; diary grid has no table semantics; manual screen-reader and native zoom review still pending |

## App Store review / compliance

⭕ for the web release, with two rules that bind the web too:

| Rule | Status | Evidence |
| --- | --- | --- |
| Account deletion flow | ❌ | Settings row says "Not available on the web yet"; no in-app or documented email path is live |
| No "coming soon" / placeholder screens in production | ❌ | Export/Delete placeholders on Settings; Life hub shows roadmap copy ("not on the web yet", "Circles are deferred"); Grove renders raw enum keys |
| Broken legal/support links | ❌ | None exist to be broken; they must be added |
| Test the release build, not debug | ❌ | e2e only runs against `next dev`; the production build fails and no one noticed |

## App Store growth, ideation, AI workflows

- Screenshots, localization, Search Ads research: ⭕ until native ships. The localization lesson does
  apply to web SEO later (the product is now global; `en-PH` is still hardcoded in ~16 sites).
- Public data / APIs: ✅ already the model (USDA, Open Food Facts, curated catalog). Licensing and
  attribution exist (`packages/food/src/licenses.ts`). OFF user agent still points at `contact@kayamo.ph`
  and the default limiter exceeds OFF's published rate.
- ECC harness repository, SimSlim: ⭕ tooling notes; this repo already has skills, hooks and CI.

## Development / security lessons

| Rule | Status | Evidence / gap |
| --- | --- | --- |
| RLS does not protect sensitive columns | 🟡 | Exactly this pattern exists: `agent_runs_update` (`0001_core_schema.sql:864`) lets a user update any column of their own rows, including `cost_usd`, so the per-user dollar budget can be zeroed; only the request-count allowance in the private schema is trusted. `profiles_update` is full-row but profiles carry no quota or role columns. Fix: `revoke update on public.agent_runs from authenticated; grant update (scrubbed_at) on public.agent_runs to authenticated;` and an RLS test that tries to write `cost_usd`. Also review `off_contribute_requests`, which grants UPDATE with no UPDATE policy |
| Production-readiness iceberg | see below | |

Iceberg items mapped to this build:

| Concern | Status | Note |
| --- | --- | --- |
| Input validation / abuse | ✅ | Strict Zod on 11 of 12 routes; worldwide search validates by hand |
| Roles and permissions | ✅ | RLS on all 46 tables; Lis read permissions enforced at data assembly |
| Credential / token expiry | ✅ | Supabase sessions; open-redirect and set-session page still open |
| HTTPS / TLS | 🔍 | Vercel; no security headers (CSP, frame-ancestors, Referrer-Policy) |
| Rate limiting | 🟡 | AI allowance fails closed ✅; worldwide search limiter is per-instance; hosted auth OTP limits unverified |
| Dependency security | ✅ | Zero production advisories; CI audit gate |
| Multi-tenancy / isolation | ✅ | Per-account IndexedDB, RLS, service-role isolated |
| PII handling | 🟡 | No health data in logs ✅; no device-local deletion; guest DB never removed |
| Retention / deletion | ❌ | No export, no delete, retention schedule unverified, compliance doc is RA 10173 only |
| Audit trails | 🟡 | `agent_runs` telemetry; no ledger of applied migrations |
| Integration tests | ✅ | RLS + sync + PostgREST suites on a disposable database in CI |
| Regression tests | ✅ | 19 Playwright specs, three engines; but never against a production build |
| Chaos / resilience | 🟡 | Adversarial sync-repair suite exists; no fault injection elsewhere |
| CI enforcement | 🟡 | typecheck/lint/test/audit/build ✅; `check:copy` not in CI; no preview smoke; CI never ran on this branch |
| Retry with backoff | ✅ | `packages/offline/src/backoff.ts`; permanent errors are not classified (12 retries over ~61 min) |
| Circuit breakers | ❌ | USDA 403 is retried on every search |
| Fallback behaviour | ✅ | AI routes return fixed copy on provider failure |
| Race conditions | 🟡 | Undo/tombstone race verified; queue drains children before parents in the same millisecond |
| Cache invalidation | 🟡 | Full-table catalog re-download per mount; eviction is a full scan per cached food |
| RPO / disaster recovery | ❌ | Backup tier, PITR and rollback rehearsal unverified |
| Accessibility | 🟡 | See above |
| Architecture diagrams / docs | ❌ | `.cursor/rules` describe a monorepo, market and assistant name that no longer exist |
| API contracts | ✅ | Zod schemas; sync contract; `write-schemas.ts` covers 2 of 26 tables |

## Monetization

⭕ today: no billing, no paywall, no entitlements. When pricing starts, both SOT items (preference
framing, pay-first) are 🧪 experiments to measure, not requirements. Note the sensitive-column rule
above will matter more once entitlements exist.

## Master build audit

| Domain | Status | Evidence / blockers |
| --- | --- | --- |
| Core UX / decision friction | 🟡 | 7-item rail, placeholder rows, two create surfaces |
| Familiar interaction patterns | ✅ | Phone bar matches Jakob's Law; record the centre-create deviation from the Mus SoT |
| Responsive / mobile behaviour | ✅ | e2e at five widths |
| Accessibility | 🟡 | axe green; px type, forced-colors, key hijack, manual review pending |
| Website technical SEO | 🟡 | Metadata done; legal links, Search Console, canonical on previews open |
| Frontend quality metrics | 🟡 | No 404/error boundary; loading gaps |
| Performance / Lighthouse | ❌ | Never measured; build fails |
| Authentication / authorization | 🟡 | RLS strong; open redirect, set-session page, `/settings` outside proxy, no security headers |
| Data integrity / sensitive fields | 🟡 | `agent_runs.cost_usd` user-writable; Verify overlay rewrites confidence to 1.00 |
| API / caching / DB performance | ✅ | Indexed, no-store where it matters, small payloads |
| Privacy / retention / deletion | ❌ | No export/delete, RA 10173-only analysis for a global product |
| Reliability / retries / failure handling | 🟡 | Backoff ✅; unclassified errors, no circuit breaker |
| Tests / CI / regression coverage | 🟡 | Strong suites; no production-build or preview test; CI unrun on branch |
| Release-build verification | ❌ | `pnpm build` fails; HEAD imports untracked files |
| App Store / platform compliance | ⭕ | Native deferred; account deletion and placeholder rules still bind |
| Billing / subscriptions | ⭕ | None |
| Legal links / policies / support | ❌ | Drafts untracked; no routes |
| Analytics / attribution / consent | ⭕ | No analytics; no consent needed yet; no error monitoring either (❌ under readiness) |
| Growth / store assets / localization | ⭕ | Post-launch |
| Monetization experiments | ⭕ | Later |
| Production-readiness review | 🟡 | This document plus the same-day codebase review |

```md
Release status: BLOCKED
Blocking items:
- Fix the CSS-module build failure and commit the 11 untracked imported files
- Apply migrations 0018/0021/0022 to the hosted project and record them
- Add error.tsx / global-error.tsx / not-found.tsx and an error-monitoring sink
- Add /privacy, /terms, /accessibility routes and footer links; fix the landing export claim
- Restrict agent_runs UPDATE to scrubbed_at; harden the /auth/callback next guard; delete /auth/set-session
- Run Lighthouse on a production preview and record the baseline

Accepted risks / deferred work:
- Native/App Store sections until the native shell ships
- Monetization experiments until billing exists
- Gym/Todos legacy skin, pending the owner's v1 scope decision

Post-release metrics to watch:
- LCP / INP / CLS on /, /login, /today; route bundle sizes
- 5xx rate on /api/mus/* and /api/foods/worldwide; AI allowance 503s
- Sync queue dead-letters and undo failures
- Safety-classifier false positives on ordinary food talk
```
