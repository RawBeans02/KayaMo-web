# Reference

Not a coding chapter — no Done when, no `ch99:` commit. Schedule, the six
Cursor rules (full starters), prompt patterns, the recovery playbook, costs,
monorepo layout, and the claims this guide deliberately does not make.

---

# Appendix A — The eight-week schedule

| Week | Chapters | Milestone |
|---|---|---|
| 1 | 0–5 | Rules, design system, auth, schema, offline layer |
| 2 | 6–9 | Food data layer + your PH core seeded |
| 3 | 10–13 | You can log food four ways and see your trend |
| 4 | 14–17 | Taglish chat + photo logging + cost guard |
| 5 | 18–21 | Adaptive TDEE, targets, weekly check-in |
| 6 | 22–24 | Gym logging + progression, wired to nutrition |
| 7 | 25–28 | Coco: tools, RAG, planner, nudges |
| 8 | 29–36 | PWA hardening, Capacitor, health sync, safety, compliance |

**Dogfood rule:** from the end of Week 3 you log every meal in KayaMo and nothing else. Every bug you hit as a user jumps the queue ahead of the roadmap. A tracker that you personally abandon in week 2 will not survive contact with anyone else.

---

# Appendix B — Rules file starter content

`kayamo-scaffold.sh` writes all six. Do not rewrite them mid-build. Each
`description` is a search query — Grok 4.6 retrieves rules by description, so
"Nutrition domain rules: resolver cascade order, PH food data, portions,
Taglish aliases" beats "Nutrition rules."

`.cursor/rules/000-project.mdc` — `alwaysApply: true`

```markdown
---
name: project-constitution
description: KayaMo core rules — monorepo layout, hard constraints, naming, and conventions. Applies to all work in this repo.
alwaysApply: true
---

KayaMo is a Filipino-first calorie and gym tracker. PWA first, Capacitor wrap
for Android/iOS. Solo developer. Users are in the Philippines.
Bundle ID `ph.kayamo.app`. AI companion is named Coco.

## Monorepo layout — put code in the right place
- `apps/pwa`    — user-facing Next.js app. Routes, screens, thin glue only.
- `apps/admin`  — internal tools, auth-gated, never public.
- `apps/mobile` — Capacitor shell. Native code only, zero business logic.
- `packages/db` `core` `food` `ai` `offline` `ui` — all shared logic.

Packages never import from apps. Apps never duplicate package logic.
If a formula or a resolver appears inside `apps/`, that is a bug.

## Non-negotiable
- Never call an LLM without a Zod schema on the output.
- Never write nutrition data without `source` and `confidence`.
- The LLM extracts text and quantities. Nutrition numbers come from the
  resolver cascade in @kayamo/food, never from the model.
- Every AI-created entry is editable by the user.
- Offline first: writes go to IndexedDB via @kayamo/offline, then sync.
- Store UTC, render in the user's timezone. Respect their custom day
  boundary (night shift) — never assume midnight.
- All money in PHP.
- Calorie floors (1200F / 1500M) are enforced in code, not prompts.
- Banned vocabulary anywhere in prompts or UI copy: cheat, guilty, earned,
  burn it off, bad food, sinful.
- Health data never appears in logs or error reports.
- Never modify a test to make it pass. Fix the code, or tell me the test
  is wrong and why.

## Conventions
- pnpm workspaces + turbo. TypeScript strict. No `any`.
- The service-role Supabase client is never imported into a "use client" file.
- All LLM calls route through @kayamo/ai `router.ts`.
- One chapter per commit, prefixed `chNN:`.
```

`.cursor/rules/100-stack.mdc`

```markdown
---
name: stack-and-tooling
description: KayaMo tech stack, build commands, dependency rules, Next.js and Supabase conventions, turbo and pnpm workspace usage.
---

Next.js 15 App Router · TypeScript strict · Tailwind v4 · Supabase
(Postgres, Auth, Storage, Edge Functions) · Drizzle ORM · Dexie ·
Vercel AI SDK · Zod · Vitest · Playwright · Capacitor · pnpm + turbo.

Do not substitute a library without asking.

Commands: `pnpm dev:pwa`, `pnpm dev:admin`, `pnpm build`, `pnpm test`,
`pnpm typecheck`, `pnpm db:migrate`, `pnpm ph-core:build`.

- Server Components by default; "use client" only where interaction requires it.
- Route handlers validate input with Zod at the boundary.
- Migrations are generated, reviewed, and committed — never applied ad hoc.
- Add a dependency to the package that uses it, not to the root.
```

`.cursor/rules/200-data-model.mdc`

```markdown
---
name: data-model-and-rls
description: KayaMo database schema rules — tables, denormalization, row-level security, offline sync keys, and migration conventions.
---

- RLS on every table. Users read only their own rows. Exception: `foods` and
  `servings` where source != 'user' are globally readable.
- `food_entries` stores a DENORMALIZED nutrient snapshot. Never replace it
  with a join. Correcting a food in 2027 must not silently rewrite 2026 history.
- Every user-owned row uses a client-generated UUID primary key plus
  `updated_at`, so offline sync can do last-write-wins.
- Targets and expenditure estimates are versioned rows (`effective_from`),
  never updated in place.
- User-created foods are private by default, with an explicit opt-in to share.
- Every table carries created_at / updated_at.
```

`.cursor/rules/300-ai-agents.mdc`

```markdown
---
name: ai-agents-and-coco
description: KayaMo AI rules — Coco's persona, agent architecture, tool design, model tier routing, memory, cost control, and numeric grounding.
---

## Coco
KayaMo's companion (the sibling of KitaMo's Lis). A training partner, not a
nutritionist and not a hype account. Speaks Taglish naturally, matching the
user's register. Never moralizes about food. Never says "guilty", "cheat meal",
"earned it", or "burn it off". Reports numbers plainly and asks before advising.
Defined once in @kayamo/ai `persona.ts`.

## Architecture
ONE tool-using agent plus scheduled and event-triggered runs. No supervisor
hierarchy, no agent-to-agent delegation, unless explicitly requested.

- The structured DB is the source of truth. Every number Coco states must come
  from a tool result — enforce with the numeric-grounding check, and reject
  any output containing an unreferenced figure.
- Coco proposes; the user disposes. Write actions require UI confirmation.
- Long-term profile is updated by an explicit tool, never by silent inference.

## Model routing
Every call goes through `router.ts`. Tiers: NANO (classification), SMALL
(extraction, OCR), VISION (photo), COACH (weekly narrative only). Check the
embedding cache before any model call. Enforce the per-user daily budget.
Log model, tokens, latency, and cost_usd to `agent_runs` on every call.
```

`.cursor/rules/400-nutrition-domain.mdc`

```markdown
---
name: nutrition-domain
description: KayaMo nutrition and food data rules — resolver cascade order, Philippine food data sourcing, portions, Taglish aliases, licensing constraints.
---

## Resolver cascade (@kayamo/food `resolve.ts`) — order is fixed
1. My Foods (user's own confirmed foods)
2. PH core (`source='ph_core'`, matched on name AND name_tl aliases)
3. Local cache
4. Open Food Facts — jumps to FIRST when a barcode is present
5. USDA FoodData Central
6. LLM estimate — last resort, confidence capped at 0.5, always UI-flagged

Never collapse the cascade into a single LLM call.
Always return a ranked candidate list, never a bare answer.

## Licensing — hard constraints
- Do NOT scrape FNRI PhilFCT or any FNRI endpoint. No open licence exists.
  PH core values come from ingredient decomposition of CC0 USDA data, with
  the assumption recorded in `source_note`.
- Open Food Facts is ODbL: store the attribution with every imported record
  and surface it in the About screen. Send a proper User-Agent.
- USDA FoodData Central is CC0 — free to use.

## Portions
PH-native units come first in every picker: tasa, piraso, order, hiwa,
kutsara, bowl. Grams are the fallback, not the default.
Vague sizes (malaki / sakto / maliit) map to portion multipliers, never ignored.
```

`.cursor/rules/500-safety-privacy.mdc`

```markdown
---
name: safety-and-privacy
description: KayaMo safety guardrails and Philippine data privacy rules — calorie floors, disordered eating red flags, banned copy, RA 10173 compliance, health data handling.
---

## Safety — enforced in code, not prompts
- Calorie floors 1200 (female) / 1500 (male). No override, no advanced mode.
- Max weekly loss target 1% bodyweight. Max deficit 25% below TDEE.
- Clamp any request that breaches a floor and surface `clamped: true` honestly.
- Red-flag detection on input: extreme restriction, purging, appetite
  suppression, "how little can I eat", BMI-below-17.5 goals, body-image
  distress. When flagged: do not provide the plan, respond warmly and briefly,
  surface PH support resources from the config file, do not lecture, do not
  end the conversation.
- Never comment on appearance. Never use guilt framing.
- If a medical condition is mentioned (diabetes, PCOS, kidney, pregnancy,
  ED history), defer to their clinician and do not generate a plan.
- KayaMo is not a medical device. No diagnosis, treatment, or prescription.

## Privacy — RA 10173 (Data Privacy Act of 2012)
Health data is SENSITIVE personal information — the highest-risk category.
- Granular, versioned, opt-in consent per purpose. Nothing pre-ticked.
- Photos deleted from storage after analysis unless the user saves them.
- Calendar event titles are never sent to a model. Only derived time blocks.
- No health data in application logs, analytics, or error reports.
  Analytics track EVENTS, never content.
- Export and hard-delete must both work in-app.
- Breach notification to the NPC within 72 hours (see docs/breach-response.md).
- NPC registration is triggered at 1,000 users processing sensitive personal
  information — see docs/compliance.md.
```

---

# Appendix C — Prompt patterns that work with Grok 4.6

**Plan-then-implement, on every xhigh chapter.** Ask for the plan, read it, push back, *then* say "implement the approved plan." Grok 4.6 is strong at long-horizon agentic work and will happily build the wrong architecture very efficiently if you skip this.

**State the constraint before the task.** Constraints placed after the task get weaker adherence than constraints placed before it.

**Name the anti-pattern.** "Do not collapse the cascade into a single LLM call" prevents the exact shortcut it will otherwise take. Every chapter above has a "Watch out" for this reason — fold it into the prompt.

**Use the browser tool for anything visual.** End UI prompts with "then open the browser, screenshot at 390px, and fix what looks wrong." A screenshot closes the loop that prose cannot.

**Let it ask.** Grok 4.6 can ask clarifying questions while continuing to work. Answer them rather than pre-empting every detail — you will write shorter prompts and get better results.

**Give it the test as the spec.** "Write tests for these 30 Taglish phrases, then make them pass" is a stronger instruction than any amount of description.

---

# Appendix D — When it goes wrong

| Symptom | Fix |
|---|---|
| Agent drifts mid-chapter, starts refactoring unrelated files | Context bloat. `git reset --hard`, new chat, narrower prompt. |
| Same bug survives three fix attempts | Stop iterating. New chat, xhigh, paste the failing test and the relevant file only. Fresh context beats a long argument. |
| It "fixes" a test by weakening the assertion | Add to 000-project.mdc: never modify a test to make it pass; fix the code or tell me the test is wrong. |
| Costs spiking | Check the context meter — you are probably past 200K where Grok's rates double. Restart the chat. |
| Output looks like every other tracker app | Re-paste the Chapter 2 design brief and say so directly. Ask for a screenshot first. |
| It invents nutrition numbers | The numeric-grounding check from Chapter 25 is missing or bypassed. That is a bug, not a prompt problem. |

---

# Appendix E — Running cost at your scale

| Line item | Just you | 100–1,000 users |
|---|---|---|
| Vercel | Free (hobby) | ~$20/mo |
| Supabase | Free | ~$25/mo (Pro) |
| USDA FDC + Open Food Facts | Free | Free |
| LLM (chat + photo + weekly coach) | ~$0.10–0.50/mo | ~$10–500/mo depending on photo volume |
| Push (Web Push / FCM / APNs) | Free | Free (~$99/yr Apple dev) |
| **Total** | **~$0–1/mo** | **~$55–550/mo** |

Photo analysis is the cost lever. If it runs hot, tighten the daily rate limit and downscale images harder before pushing model tiers up.

---

# Appendix F — What this guide deliberately does not claim

- **Photo calorie estimation is not accurate enough to trust unedited.** Validation work puts multimodal-LLM energy estimation around 36% mean absolute percentage error on standardized single foods, with systematic underestimation that worsens on larger portions, and roughly double the error on mixed meals versus single items. Filipino composite dishes are the worst case. Build it as a draft tool and say so in the product.
- **MEV/MAV/MRV are heuristics, not measurements.** Present them as adjustable bands.
- **Your PH core values are estimates until you verify them.** Ingredient decomposition from USDA data is a defensible starting point, not authoritative Philippine composition data. If you want authoritative numbers, request a data-use agreement from DOST-FNRI in writing.
- **The generated privacy policy is a draft.** You process sensitive personal information under RA 10173. Get it reviewed.

---

# Appendix G — Monorepo layout

Run `kayamo-scaffold.sh` before Chapter 1. It creates this:

```
kayamo/
├── apps/
│   ├── pwa/            the product — Next.js, installable PWA
│   ├── admin/          internal tools, auth-gated, never public
│   └── mobile/         Capacitor shell for Android + iOS
├── packages/
│   ├── db/             schema, migrations, RLS, typed queries
│   ├── core/           TDEE, targets, trend, progression  (pure, no I/O)
│   ├── food/           resolver cascade + USDA/OFF adapters
│   ├── ai/             Coco: router, tools, agent, safety, memory
│   ├── offline/        Dexie + sync queue
│   ├── ui/             design tokens + primitives
│   └── config/         shared eslint / ts / tailwind presets
├── data/ph-core/       foods.yaml, prices.yaml — your moat
├── supabase/           migrations + edge functions
├── docs/               compliance, breach runbook, legal drafts
├── scripts/
└── .cursor/rules/      six rules files, pre-written
```

### Where each chapter's code lands

| Chapters | Package or app |
|---|---|
| 2 | `packages/ui` |
| 3, 4 | `packages/db` + `apps/pwa` (auth routes) |
| 5 | `packages/offline` |
| 6, 7, 8, 9 | `packages/food` + `data/ph-core` |
| 10, 11, 12, 13 | `apps/pwa` (screens) |
| 14, 15, 16, 17 | `packages/ai` |
| 18, 19, 23, 24 | `packages/core` |
| 20, 21, 28 | `supabase/functions` + `packages/core` |
| 22 | `apps/pwa` + `data/exercises` |
| 25, 26, 27, 33 | `packages/ai` |
| 29 | `apps/pwa` |
| 30, 31, 32 | `apps/mobile` |
| 34 | `docs/` |
| 35 | `apps/admin` |

### Why three apps instead of one

**`admin` is separate so it can never ship to users.** It carries service-role
database access, cost dashboards, and the safety review queue. Keeping it in its
own deploy target means there is no code path where an internal tool leaks into
the user bundle — a boundary that is very hard to re-establish later if you
start with everything in one app.

**`mobile` is a shell, not a port.** Capacitor embeds the `apps/pwa` build
verbatim. It holds `capacitor.config.ts`, the generated `android/` and `ios/`
projects, and native plugin wiring — nothing else. If you catch yourself writing
a screen in there, it belongs in the PWA.

### Adding a fourth surface later

New surfaces go in `apps/` and consume `packages/`. A Messenger bot for logging
via chat, a watch app, or a second product that reuses the food resolver should
require **zero** changes to `packages/`. If adding one forces you to modify a
package, the boundary was drawn in the wrong place — fix the boundary rather
than special-casing the new app.

The same applies across products. If KitaMo and KayaMo eventually need shared
Filipino food and pricing data, `packages/food` and `data/ph-core` are the two
things designed to lift out into a shared org-level package. Everything else is
product-specific by intent.

### The one rule that keeps this clean

**Packages never import from apps.** Enforce it — add a dependency-cruiser or
ESLint boundary rule in Chapter 35. The day a package reaches into an app is the
day the monorepo becomes a single tangled app with extra folders.
