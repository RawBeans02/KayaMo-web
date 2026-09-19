# Build SOT audit v2 — kayamo-web, 2026-09-19

Source standard: the owner's `tutorial_compilation (2).md` "Build Source of Truth", 29 clips.
The 19-clip version was audited on 2026-09-18 (`2026-09-18-build-sot-audit.md`). This audit
does two things: re-scores every item whose status changed in Phases 5–7, and scores the
nine sections the new version adds. Items not mentioned keep their 18 Sep status.
Legend: ✅ Verified · 🟡 Partial · ❌ Missing · ⭕ Not applicable · 🔍 Runtime verification
required · 🧪 Experiment.

```md
Project / Build: KayaMo web (kayamo.fit)
Platform: Web (Next.js 16 App Router, Supabase, Vercel), desktop-first with phone layout
Environment audited: branch phase-7/progress-and-motion at the commit that adds this file,
  run locally against a local Supabase; production build (next build --webpack + next start)
  for Lighthouse and the bundle figures; PR #1 (v1) open against main, not yet deployed
Branch / commit / release: phase-7/progress-and-motion (v1 = codex/botanical-liquid-glass, PR #1)
Audit date: 2026-09-19
Auditor: Claude (Fable 5.1), evidence from this session's runs

Blocking findings:
- None for the code. The release itself waits on owner actions (Vercel environment,
  legal review, Search Console, monitoring), listed in docs/RELEASE.md.

Accepted exceptions / N/A rationale:
- No billing, no subscriptions, no App Store presence: every monetization, storefront
  and App Review section is ⭕.
- Gym and Todos are off the v1 rail by decision; their legacy screens are not audited
  for design items.
```

---

## Changed since the 18 Sep audit

| Item | Was | Now | Evidence |
| --- | --- | --- | --- |
| Empty states as activation flows (Goals) | ❌ | ✅ | `botanical/goals.tsx` starter: three-line how-it-works, five suggestion chips that open the editor seeded, one primary action, Lis as the alternative; Home nudges to the first goal while none exists |
| One primary action per screen (Hick) | 🟡 | ✅ | Home's Movement glance and planner links removed; Goals starter has one accent button; Life and Grove have none |
| Familiar patterns: five tabs, create in the middle, Home left, Profile right | ✅ | ✅ | unchanged; phone header no longer duplicates Ask Lis (fix, 19 Sep) |
| Mascot with explicit personality | ❌ | ✅ | Lis's face (`mus/lis-face.tsx`), expression rules and tone reader in `mus-faces.ts`; concern never for a missed log |
| Accessibility statement, findable in the footer | ❌ | 🟡 | `/accessibility` live, linked from landing, login and Settings; carries a "Draft, under review" note until the owner sets `LEGAL_APPROVED_ON` |
| Privacy policy describes the actual system | ❌ | 🟡 | `/privacy` names Supabase, Vercel, OpenAI, USDA, Open Food Facts, Gmail; states no automatic deletion, no export, no age gate; professional review still owed |
| Legal links / policies / support | ❌ | 🟡 | `/privacy`, `/terms`, `/accessibility`; support address in one constant (`src/lib/legal.ts`) |
| Real 404 page | ✅ | ✅ | unchanged |
| Loading states for async work | 🟡 | 🟡 | Life/Grove show "–" and "Loading your history…"; the palette and tables keep their skeletons; error states with Retry |
| Lighthouse on the release build | ❌ | 🟡 | local production build: landing 98/100 mobile/desktop, privacy 96, Home 98 desktop / 77 mobile; on the hosted preview: 🔍, blocked by Vercel deployment protection until the bypass secret is set |
| Bundle budget / code splitting | ❌ | 🟡 | public pages on leaf entries (landing 465→197 KB gz); `e2e/bundle-budget.spec.ts` in the production CI job; Home still 467 KB (Lis thread and palette in the first load) |
| Release-build verification | ❌ | ✅ | `production-e2e` CI job runs the suite against `next start` on three engines; guest cookie Secure by protocol |
| Tests / CI / regression coverage | 🟡 | ✅ | three jobs green on the v1 head; 174 e2e tests; unit suites in every package; progress model unit-tested |
| Sitemap / robots / canonical / noindex | 🟡 | ✅ | sitemap lists `/`, `/privacy`, `/terms`, `/accessibility`; private routes noindex by design (Lighthouse SEO 63 there is that) |
| Data integrity / sensitive fields (RLS columns) | 🟡 | ✅ | `agent_runs` UPDATE limited to `scrubbed_at` (0023), applied to the hosted project 19 Sep and verified |
| Migration / database runbook | ❌ | ✅ | one runner (Supabase CLI), hosted history repaired, `docs/releases/2026-09-19-hosted-migrations.md` |
| Progress and achievements visible to the user | ❌ | ✅ | Life: readings and four charts; Grove: stage ring, milestones, records, month grid, trail by month (`progress-model.ts`) |
| Motion honours reduced motion | ✅ | ✅ | new sheet/toast exits, pops, count-ups and route transitions all fall back under `prefers-reduced-motion` |

## New in this version of the checklist

### Design empty states as activation flows (SHOULD)

| Criterion | Status | Evidence |
| --- | --- | --- |
| Every important empty state explains what is missing | ✅ | Home (plan, priorities), Goals starter, Life "Nothing recorded yet" line, Grove trail, Lis guest note |
| One obvious next step | ✅ | Goals: "Create your first goal"; Life/Grove: "Go to Home"; Home: the composer |
| Starter templates / examples | ✅ | five goal suggestions; the demo catalog for food |
| AI suggestions optional and reviewable, manual path kept | ✅ | "Talk it through with Lis" beside "Write it myself"; Lis proposes, the person confirms |
| CTA leads to the first useful object | ✅ | chip → seeded draft → "Make this my goal" → step on Home |
| Understandable without illustration | ✅ | text-only states; no image-only cues |
| Analytics measure empty state → first action → first value | ❌ | no product analytics is wired (a `POSTHOG_KEY` exists in the environment but nothing reads it); owner decision needed on analytics and consent |

### Ask for notification permission after value (WHEN APPLICABLE)

⭕ The web app sends no push notifications (VAPID keys exist, nothing reads them). Revisit if
push ships.

### Home-screen widgets (WHEN APPLICABLE)

⭕ Web. The PWA manifest exists; widgets are a native concern.

### Keep high-frequency actions in context (WHEN APPLICABLE)

🟡 The Lis photo attach uses the platform file picker (`<input type="file">`), which is the
right default on the web; capture is not a high-frequency core action here. Permission
denial and cancellation return to the composer with the draft intact (tested by hand, 19 Sep).

### Avoid the vibe-coded fingerprint

✅ One deliberate system (Liquid Glass, Manrope display, SF text, Phosphor icons, glass
tokens). Of the twenty tells: no gradient text, no emoji headings, no Inter, no coloured-border
cards, no cursor beams, no grain, no serif italic accents, no default shadcn. Glass cards are
the one listed pattern in use, and they are the system, not a default. Copy is reviewed by the
banned-copy sweep on every commit.

### Search discovery verification (MUST for indexable public sites)

| Criterion | Status | Evidence |
| --- | --- | --- |
| Production property in Search Console | ❌ | owner action, after the first deploy |
| Sitemap reachable and submitted | 🟡 | `/sitemap.xml` renders the four public URLs in production mode; submission is the owner's |
| Representative URLs inspected for indexing | 🔍 | needs the live domain |
| Deliberate titles and descriptions | ✅ | landing, login, legal pages; private routes noindex |

### Domain, app and email subdomains (MUST when sending production email)

| Criterion | Status | Evidence |
| --- | --- | --- |
| Domain architecture documented | 🟡 | apex → www redirect and `NEXT_PUBLIC_SITE_URL` are in `.env.example`; no separate app subdomain by design (one surface) |
| Transactional vs marketing email separated | ⭕ | no marketing email; the only mail is Supabase Auth's sign-in link |
| SPF / DKIM / DMARC on sending domains | 🔍 | sign-in mail goes through Supabase's default sender unless a custom SMTP is configured; owner to confirm in the Supabase Auth settings |
| DNS records documented | ❌ | not in the repository; owner to record |
| Email links resolve to product domains over HTTPS | ✅ | redirect URLs listed in `.env.example`; the callback re-checks the origin |
| Unsubscribe on marketing mail | ⭕ | none sent |

### Legal / compliance traps

| Criterion | Status | Evidence |
| --- | --- | --- |
| Cancellation without dark patterns | ⭕ | nothing to cancel; sign-out is one button |
| Account deletion covers the real lifecycle | 🟡 | manual by email today, stated honestly in `/privacy` and Settings; `ON DELETE CASCADE` on every `user_id` removes rows when the Auth user is deleted (verified 19 Sep on the hosted project); backups and AI provider logs are not covered by a documented schedule |
| Age / child-directed checks | 🟡 | intended for adults, stated; no verification, stated; no children's design |
| Marketing unsubscribe | ⭕ | none |
| Privacy policy describes the actual system | 🟡 | see above; professional review owed |

### Control runaway infrastructure and API spend (MUST)

| Criterion | Status | Evidence |
| --- | --- | --- |
| Provider budget alerts | 🔍 | owner: OpenAI, Supabase and Vercel dashboards |
| Hard caps / kill switch | 🟡 | per-user daily request allowance (`reserve_web_ai_request`, `WEB_AI_DAILY_REQUEST_LIMIT`, default 5) and a per-user USD budget knob; no operator kill switch beyond removing the key |
| Per-user rate limits on paid endpoints | ✅ | every Lis route and now `/api/foods/parse` reserve the allowance after the body parses (the parse route was the gap; fixed in this audit's commit); worldwide search has per-minute limiters and a 200-character query cap |
| Bounded retries | ✅ | `maxRetries: 0` on the model call; sync retries are explicit and user-driven |
| Circuit breakers | 🟡 | worldwide search has hourly limiters and timed fetches; the model call has none beyond zero retries |
| Bounded queries and lists | ✅ | catalog reads are per-user and scoped; the demo catalog is a static file |
| Bot / download abuse | 🔍 | Vercel's defaults; nothing product-specific |
| Cost telemetry by user / endpoint | 🟡 | `agent_runs` records tokens and `cost_usd` per run; no dashboard |
| Non-production cannot spend production budgets | ✅ | local development runs against a local Supabase since 19 Sep; the demo never calls a provider |

### Model / provider profiles and fallbacks (SHOULD)

🟡 One provider (OpenAI) through one touchpoint (`packages/ai/src/router.ts`), model names in
`MODEL_*` / `MUS_*` environment variables, keys outside the repository, Zod on every output,
provenance recorded in `agent_runs`. No fallback provider; a provider outage is a 503 with
manual tracking intact, which is the intended failure mode for a v1.

### Evaluate open-source components and external APIs (SHOULD)

🟡 The dependencies are named in `/privacy` and the vendor set is small and deliberate
(Supabase, Vercel, OpenAI, USDA FoodData Central, Open Food Facts). Licence and commercial
terms for the nutrition sources are recorded in `docs/` from earlier work; the model
provider's data-handling terms have not been reviewed against the health-data
classification, which the privacy notice says plainly.

### Agent-harness audit rules

| Criterion | Status | Evidence |
| --- | --- | --- |
| Version-controlled instructions and conventions | ✅ | `AGENTS.md`, `.cursor/rules/`, `docs/RELEASE.md` |
| Reusable commands for recurring tasks | ✅ | package scripts, CI jobs, the copy sweep, the CSS-reference test |
| Specialist review where it helps | ✅ | the 18 Sep review's verified findings; per-phase outcome sections |
| Repeatable security review before release | ✅ | `test:security`, `pnpm audit --prod` in CI, security headers spec |
| Context / memory management | ✅ | project memory outside the repository; phase gates |
| Learnings preserved without secrets | ✅ | `.env.local` gitignored; hosted values kept commented, never committed |
| Third-party harness reviewed | ⭕ | none adopted |

### Subscription, pricing, storefront, App Store sections

⭕ No billing, no subscriptions, no app store presence. Recorded so nobody treats them as
missing work.

## Master build audit — release summary

| Domain | Status | Evidence / blockers |
| --- | --- | --- |
| Core UX / decision friction | ✅ | one primary action per screen; rail trimmed to six |
| Empty-state / first-value activation | ✅ | Goals starter, Home nudge, Life and Grove first-value lines |
| System handoff / in-context flow | 🟡 | platform file picker for photos; acceptable on web |
| Familiar interaction patterns | ✅ | five-tab bar, centre create, Home left, Profile right |
| Responsive / mobile behaviour | ✅ | 320–1440 checked across routes; no horizontal scroll |
| Accessibility | 🟡 | automated audits on every route in three engines; screen-reader pass by a person still owed |
| Website technical SEO | 🟡 | metadata, sitemap, robots, canonical done; Search Console owner |
| Domain / DNS / email deliverability | 🔍 | owner to confirm Supabase mail sender and DNS |
| Frontend quality metrics | ✅ | dark mode, hover and focus states, loading and error states, skip link, 404 |
| Performance / Lighthouse | 🟡 | measured locally; Home mobile 77; hosted preview pending |
| Authentication / authorization | ✅ | magic link, callback origin re-check, RLS, protected-route list pinned by test |
| Data integrity / sensitive fields | ✅ | column grants on `agent_runs`; nutrition writes carry source and confidence |
| API / caching / database performance | 🟡 | scoped reads; no query-plan review yet |
| Infrastructure spend / abuse guardrails | 🟡 | allowances on every paid route; provider alerts owner |
| Privacy / retention / deletion | 🟡 | honest notice; no retention schedule; deletion manual |
| Cancellation / unsubscribe / dark patterns | ⭕ | nothing to cancel or unsubscribe |
| Child / age compliance | 🟡 | adults stated, not enforced |
| Reliability / retries / failure handling | ✅ | offline-first, bounded retries, error boundaries |
| Tests / CI / regression | ✅ | three CI jobs green; production-build e2e |
| Agent model routing & fallback | 🟡 | one provider, explicit config, no fallback |
| Release-build verification | ✅ | production e2e in CI; pre-deploy run on the built app |
| App Store / platform compliance | ⭕ | web only |
| Billing / subscriptions | ⭕ | none |
| Legal links / policies / support | 🟡 | live as drafts; review owed |
| Analytics / attribution / consent | ❌ | no analytics wired; no consent banner needed until then |
| Growth / store assets / localization | ⭕ | web; English with a frozen Taglish preference |
| Market prioritization | ⭕ | Philippines only, by decision |
| Monetization experiments | ⭕ | none |
| Production-readiness review | 🟡 | code gates done; owner gates open |
| Build-vs-buy due diligence | 🟡 | vendors deliberate; provider terms unreviewed for health data |

### Release decision

```md
Release status: PASS WITH ACCEPTED RISKS (code); the deploy waits on owner actions
Blocking items:
- Owner: Vercel environment, Supabase Auth URLs, protection-bypass secret for the hosted smoke
Accepted risks / deferred work:
- Legal texts live as drafts until professionally reviewed
- No analytics, so the empty-state funnel cannot be measured yet
- Home on mobile loads 467 KB of JavaScript (Lis thread and palette in the first load)
- No retention schedule; deletion by email
- Screen-reader pass by a person not yet done
Post-release metrics to watch:
- Lighthouse on the live domain, mobile Home LCP
- Daily AI allowance hits (429s) and agent_runs cost per user
- Sign-in link delivery failures
- Console errors and 4xx/5xx on the live domain once a monitoring sink exists
```
