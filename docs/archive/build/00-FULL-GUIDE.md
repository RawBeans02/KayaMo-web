# KayaMo — Complete Build Guide
### A Filipino-first AI calorie + gym tracker, built with Cursor & Grok 4.6 (Extra High)

> **KayaMo** — *kaya mo*, "you can do it." Sibling to KitaMo, same naming family.
> **Build order:** PWA → Android (TWA/Capacitor) → iOS (Capacitor).
> **Audience:** you, solo, ~8 weeks part-time alongside GCash + school.

### Naming conventions (mirrors KitaMo)

| Thing | Value |
|---|---|
| Repo | `kayamo-ph/kayamo-web` (then `kayamo-mobile` after the wrap) |
| Bundle ID | `ph.kayamo.app` |
| Domain | `kayamo.ph` (or `app.kayamo.ph`) |
| Supabase project | `kayamo-prod` / `kayamo-dev` |
| AI companion | **Coco** — the KayaMo equivalent of KitaMo's *Lis*. Defined once in `packages/ai/src/persona.ts` so it's a one-line change if you'd rather use Tala, Bes, or Kap. |

**Companion voice (put this in `persona.ts` and in the 300-agents rule):** Coco is a training partner, not a nutritionist and not a hype account. Speaks Taglish naturally, matching whatever register you use. Never moralizes about food. Never says "guilty," "cheat meal," "earned it," or "burn it off." Reports numbers plainly and asks before advising.

---

---

## How to use this document

Every chapter is a **single Cursor session**. Open a new chat per chapter, paste the prompt block, let the agent finish, verify the "Done when" list, commit, close the chat. Do not run two chapters in one context window — that is the #1 cause of Grok drifting mid-build.

Each chapter has:

| Field | Meaning |
|---|---|
| **Effort** | Which Grok 4.6 reasoning rung to set in the model picker |
| **Prompt** | Copy-paste verbatim into Cursor's agent |
| **Done when** | Your manual acceptance check before committing |
| **Watch out** | The specific failure mode for this chapter |

---

# PHASE 0 — Cursor & Grok 4.6 setup

## Chapter 0 — Configure the model correctly

Grok 4.6 in Cursor has **four effort rungs: low, medium, high (default), xhigh** ("Extra High"). Effort switching requires Pro or higher. The model has a **500K context window**, but token pricing (~$2/$6 per M in/out) **doubles past 200K context** — so a bloated chat is not just slower, it is literally 2× the cost.

It also has the full agent toolset: file search, grep, directory reads, web search, terminal execution, image reading, **browser control for screenshots and visual verification**, and rules retrieval.

### Effort routing table — use this for every chapter

| Effort | Use for | Chapters |
|---|---|---|
| **xhigh** | Architecture, schema design, algorithm work (adaptive TDEE), agent orchestration, debugging something you've already failed to fix twice | 1, 4, 8, 14, 18, 19, 26, 27 |
| **high** (default) | Normal feature implementation, multi-file edits, refactors | most chapters |
| **medium** | Boilerplate, CRUD screens, styling passes, test scaffolding, copy edits | 6, 11, 12, 24, 33 |
| **low** | Renames, formatting, one-line fixes | ad hoc |

**Rule of thumb:** if you cannot predict the shape of the answer, use xhigh. If you can, use high or below. Running everything on xhigh burns budget on work that does not need it; Cursor's own benchmarking shows xhigh and high land within ~1 point of each other on typical multi-file tasks.

### Session hygiene (non-negotiable)

1. **One chapter = one chat.** Start a new chat every chapter.
2. **Watch the context meter.** At ~150K, summarize and restart. Never let it cross 200K.
3. **Plan before code on xhigh chapters.** Ask for a plan, read it, approve it, *then* say "implement the approved plan."
4. **Let it use the browser.** For any UI chapter, end the prompt with "then open the browser, screenshot the result, and fix what looks wrong." Grok 4.6 has this tool — a screenshot is worth 1000 tokens of description.
5. **Commit after every chapter.** `git commit -m "ch04: adaptive TDEE engine"`. If a chapter goes sideways, `git reset --hard` is cheaper than arguing with the agent.
6. **Never paste secrets into chat.** Use `.env.local` and tell the agent the variable names only.

---

## Chapter 1 — Repo scaffold & rules files

**Effort:** xhigh (this sets the constitution for every later chapter)

Grok 4.6 has a rules-retrieval tool, so rules with good `description` fields get pulled in automatically when relevant. Write the descriptions like search queries.

### Step 1 — run the scaffold script (before you open Cursor)

The monorepo structure, workspace config, all six Cursor rules, the compliance
docs, and the PH core seed file are already written. Run:

```bash
bash kayamo-scaffold.sh kayamo
cd kayamo
pnpm create next-app@latest apps/pwa --ts --tailwind --app --src-dir --use-pnpm
cp .env.example .env.local
```

The script deliberately does **not** install app dependencies — `create-next-app`
pulls current versions instead of whatever was current when this guide was written.

### Step 2 — Cursor prompt

```
Effort: xhigh. Read AGENTS.md and .cursor/rules/000-project.mdc first —
the monorepo structure and constitution already exist. Do not restructure them.

PROJECT: "KayaMo" — a Filipino-first calorie + gym tracker with AI chat
logging. Solo developer. PWA first, Capacitor wrap later.

STACK (do not substitute):
- Next.js 15 App Router, TypeScript strict, Tailwind CSS v4
- Supabase (Postgres + Auth + Storage + Edge Functions)
- Drizzle ORM · Dexie.js · Vercel AI SDK · Zod
- Vitest + Playwright · pnpm workspaces + turbo

TASK — wire up the existing scaffold:
1. Rename apps/pwa's package.json to "@kayamo/pwa". Point its tsconfig at
   ../../tsconfig.base.json and verify the @kayamo/* path aliases resolve.
2. Create apps/admin as a second Next.js app named "@kayamo/admin", sharing
   the same presets. Minimal shell for now — auth gate only, no screens.
3. Build packages/config: shared eslint, prettier, tailwind, and tsconfig
   presets. Both apps consume them; neither redefines them.
4. Install the stack deps into the packages that actually use them
   (drizzle into @kayamo/db, dexie into @kayamo/offline, ai sdk into
   @kayamo/ai, and so on) — not into the root.
5. Set up Vitest at the workspace level and Playwright in apps/pwa.
6. Verify: pnpm typecheck, pnpm lint, and pnpm test all exit 0 across the
   whole workspace, and pnpm dev:pwa boots.
7. Commit as "ch01: workspace wiring".

Do NOT write feature code. Do NOT move or rewrite the existing rules files,
READMEs, or docs. Wiring only.
```

**Done when:** `pnpm dev:pwa` boots a blank page, `pnpm typecheck` / `pnpm lint` / `pnpm test` all exit 0 across the workspace, and `@kayamo/*` imports resolve from both apps.

**Watch out:** Grok will want to start building features, and it will want to "tidy" the folder structure into something it likes better. Stop it on both. The rules files are the highest-leverage thing in this entire build — everything downstream inherits them, and a mid-build restructure invalidates every path reference in the remaining 35 chapters.

---

## Chapter 2 — Design system

**Effort:** high

Pin the visual identity now so every later screen is consistent instead of accreting Tailwind defaults.

### Design brief to give it

The subject is a **gym logbook that lives in a canteen** — used sweaty at 6am and one-handed over a plate of rice at noon. Not a wellness app, not a clinical dashboard.

- **Palette:** deep ube base `#2A1B3D`, surface `#3A2A50`, calamansi accent `#C4E538` for progress/actions, rice `#F7F4ED` for text, `#E8734A` reserved *only* for over-target warnings, muted `#8B7BA8`.
- **Type:** a condensed grotesque for all numerals (weights, calories, macros — they should read like a scale display), a humanist sans for body, monospace for data tables.
- **Signature element:** the **trend ribbon** — a single continuous band on the home screen showing weight trend against target, replacing the standard bar-chart-plus-big-number layout. It is the one thing the app is remembered for.
- **Constraint:** dark-first, one-handed reachable, largest tap targets at the bottom third of the screen.

### Prompt

```
Effort: high. Read .cursor/rules/000-project.mdc first.

Build the design system for KayaMo as Tailwind v4 CSS variables + a small
set of primitives. Design brief:

[paste the palette / type / signature block above]

Deliver:
1. packages/ui/src/tokens.css with the token layer (colors, type scale, spacing,
   radii, motion durations). Every token named semantically
   (--color-surface, not --color-purple-800).
2. packages/ui/src/components/: Button, Card, Sheet (bottom sheet — this app is
   thumb-driven), NumberDisplay (the condensed-numeral component),
   TrendRibbon (the signature element, accepts a series of {date, weight,
   trend} and renders one continuous band with target overlay), Toast,
   EmptyState.
3. A /design-system route rendering every primitive in every state.
4. Respect prefers-reduced-motion. Visible keyboard focus everywhere.

Then open the browser, screenshot /design-system on a 390px viewport,
and fix anything that looks templated or cramped.
```

**Done when:** `/design-system` renders on a phone-width viewport and the trend ribbon reads clearly at a glance.

**Watch out:** the agent defaults to generic card-with-shadow layouts. If the screenshot looks like every other tracker app, tell it so directly and make it revise.

---

# PHASE 1 — Data foundation

## Chapter 3 — Supabase project & auth

**Effort:** high

### Prompt

```
Effort: high.

Set up Supabase for KayaMo.
1. supabase/ local dev config, migrations directory wired to Drizzle.
2. Auth: email magic link + Google OAuth. Session handling in Next.js
   App Router (server components read session; middleware protects
   /app/* routes).
3. packages/db/src/client.ts — typed Supabase client, one for browser
   (anon key, RLS enforced) and one for server (service role, used
   ONLY in route handlers and edge functions, never imported client-side).
   Add an ESLint rule or a comment guard preventing the service client
   from being imported into a "use client" file.
4. A minimal /login page and /app shell using the Chapter 2 primitives.

Do not create domain tables yet — that's the next chapter.
```

**Done when:** you can log in and hit a protected `/app` route; anon key never sees another user's rows.

---

## Chapter 4 — Core schema & RLS

**Effort:** xhigh

This is the chapter that determines whether the next 30 chapters are pleasant or miserable. Plan first, implement second.

### Prompt (step 1 — plan only)

```
Effort: xhigh. PLAN ONLY — do not write code yet.

Design the Postgres schema for KayaMo in Drizzle. Requirements:

FOOD SIDE
- foods: canonical food records from multiple sources. Must carry
  source ('ph_core' | 'usda_fdc' | 'off' | 'user' | 'llm'), source_id,
  name, name_tl (Tagalog/Taglish alias array), brand, barcode (nullable),
  per-100g nutrients (kcal, protein, carbs, fat, fiber, sugar, sodium),
  confidence (0-1), verified_by_user (bool), created_by (nullable user).
- servings: household measures per food ("1 tasa kanin", "1 hita",
  "1 order", "1 slice"), with grams_equivalent. A food has many servings.
  One is is_default.
- recipes + recipe_ingredients: composite Filipino dishes decomposed into
  ingredients so portions and cooking method can be varied. A recipe can
  be promoted into a food once the user confirms typical values.
- food_entries: the log. user_id, logged_at (timestamptz), meal_slot,
  food_id OR recipe_id, quantity, serving_id, resolved nutrients snapshot
  (denormalized — never recompute history when a food record changes),
  input_method ('search'|'chat'|'photo'|'barcode'|'quick'),
  confidence, photo_url (nullable), raw_input (nullable text).

TRAINING SIDE
- exercises (canonical + user-created), workouts, workout_sets
  (weight_kg, reps, rpe, rir, is_warmup), with computed e1RM.

USER SIDE
- profiles: sex, birth_year, height_cm, activity_baseline, goal,
  timezone, locale ('en'|'fil'|'taglish').
- weight_logs: user_id, date, weight_kg, source ('manual'|'health_sync').
- expenditure_estimates: the adaptive TDEE output — date, tdee_kcal,
  confidence_interval, method, inputs_hash.
- targets: effective_from, kcal, protein_g, carbs_g, fat_g, day_type
  ('training'|'rest'|'refeed'|'deload').

AGENT SIDE
- agent_runs: which agent, trigger, input, output, model, tokens, cost_usd.
- agent_memory: user_id, kind, content, embedding (pgvector), created_at.

CONSTRAINTS
- RLS on every table: users see only their own rows. EXCEPT `foods` and
  `servings` where source != 'user' — those are globally readable.
- User-contributed foods are private by default with an opt-in
  `shared` flag.
- Every table has created_at/updated_at.
- Design for offline sync: every user-owned row needs a client-generated
  UUID primary key and an `updated_at` for last-write-wins.

Output: the full schema as a written plan with column types, indexes,
and the RLS policy for each table, plus a short rationale for the three
decisions you found hardest. Then STOP and wait for my approval.
```

Read the plan. Push back on anything that looks wrong. Then:

```
Implement the approved plan. Generate the Drizzle schema, the SQL
migration, the RLS policies, and typed helpers in packages/db/src/queries/.
Add a seed script at scripts/seed.ts with 5 example foods and 1 recipe.
Write Vitest tests proving RLS blocks cross-user reads.
```

**Done when:** migrations apply cleanly, RLS tests pass, `scripts/seed.ts` runs.

**Watch out:** the denormalized nutrient snapshot on `food_entries` is the detail agents love to "optimize away" into a join. Do not let it. If you fix a food's calories in 2027, your 2026 history must not silently change.

---

## Chapter 5 — Offline layer

**Effort:** high

### Prompt

```
Effort: high.

Build the offline-first layer. A user logging lunch in a carinderia with
one bar of signal must never lose an entry.

1. packages/offline/src/db.ts — Dexie schema mirroring food_entries,
   weight_logs, workouts, workout_sets, plus a `sync_queue` table.
2. Optimistic writes: every mutation writes to Dexie immediately and
   enqueues a sync op. UI reads from Dexie, not the network.
3. packages/offline/src/sync.ts — background sync worker: drains the queue
   when online, last-write-wins on updated_at, exponential backoff,
   handles 401 by pausing not dropping.
4. A read-through cache for `foods`: any food fetched from the server
   is stored locally so repeat lookups are instant and offline-capable.
5. A visible sync status indicator in the app shell (synced / pending N /
   offline).
6. Playwright test: go offline, log a meal, come online, assert it
   appears server-side exactly once.

Note: iOS Safari does NOT support Background Sync. Sync must also fire
on visibilitychange and on app focus, not only via the service worker.
```

**Done when:** the Playwright offline test passes and the queue drains without duplicates.

**Watch out:** duplicate entries on retry. Insist on idempotency keys.

---

# PHASE 2 — The food data layer

## Chapter 6 — Source adapters (USDA + Open Food Facts)

**Effort:** medium

### Prompt

```
Effort: medium.

Build normalized adapters in packages/food/src/sources/.

usda.ts — USDA FoodData Central API.
  - Search + get-by-fdcId. Free API key from api.data.gov (env:
    USDA_FDC_API_KEY). Respect ~1000 req/hr; add a simple limiter.
  - Prefer Foundation > SR Legacy > Survey(FNDDS) > Branded when
    dedupling results. Data is CC0 public domain.

off.ts — Open Food Facts.
  - Barcode lookup + text search. No API key needed. Set a proper
    User-Agent identifying the app (their policy requires it).
  - License is ODbL: store the attribution string with every imported
    record and surface it in the app's About screen.

Both adapters must return the SAME normalized shape:
  { name, brand?, barcode?, per100g: {...}, servings: [...],
    source, sourceId, confidence }

Also build packages/food/src/normalize.ts:
  - unit conversion, per-serving → per-100g math
  - a dedupe key (normalized name + brand + barcode)
  - a `mergeCandidates()` that collapses near-duplicate results
Cache every fetched food into our own `foods` table on first hit so we
never pay the round trip twice.

Unit tests with recorded fixtures — no live API calls in CI.
```

**Done when:** searching "chicken breast" returns clean normalized results; scanning a real barcode from your kitchen resolves via OFF.

**Watch out:** OFF's PH catalogue is thin (~1–2k products). Expect misses on local SKUs — Chapter 9 handles that.

---

## Chapter 7 — The PH core dataset

**Effort:** high — but this chapter is **mostly your manual work**, not the agent's.

This is your moat. FNRI's PhilFCT is the authoritative Philippine source but has no API, no download, and no open license — so you cannot lawfully bulk-import it. You build your own curated table instead, using PhilFCT's public lookup only as a per-item spot check.

### Prompt

```
Effort: high.

Build the PH core food dataset pipeline.

1. data/ph-core/foods.yaml — a human-editable YAML file. Schema:
   - id, name, name_tl (array of Taglish aliases, e.g.
     ["kanin","rice","sinaing"]), category, per100g nutrients,
     servings (with grams), typical_prep notes, source_note
     (where the numbers came from), confidence.
2. scripts/build-ph-core.ts — validates the YAML with Zod, checks
   macro-to-kcal consistency within 5% (4/4/9 rule), flags outliers,
   and upserts into the `foods` table with source='ph_core'.
3. Seed the file with these 40 to start, using USDA FDC ingredient data
   decomposed into typical Filipino recipe proportions — and put your
   assumed recipe in the source_note field for each:
   kanin (white rice, cooked), sinangag, chicken adobo, pork adobo,
   sinigang na baboy, tinola, kare-kare, bistek, menudo, caldereta,
   lechon kawali, crispy pata, longganisa, tocino, tapa, hotdog,
   daing na bangus, pritong galunggong, tilapia, lumpiang shanghai,
   pancit canton, pancit bihon, palabok, sisig, dinuguan, bicol express,
   laing, ginisang monggo, chopsuey, pinakbet, ampalaya con carne,
   fried egg, itlog na maalat, tokwa't baboy, halo-halo, turon, banana cue,
   pandesal, taho, champorado.
4. A /admin/ph-core route (dev-only) to review, edit and confirm entries
   with a diff view.

CRITICAL: do not scrape FNRI PhilFCT or any FNRI web endpoint. Generate
values by ingredient decomposition from CC0 USDA data and record the
assumption in source_note. Mark every entry confidence <= 0.8 until I
personally verify it.
```

**Your job after:** eat normally for two weeks and correct every value that looks wrong. Verified entries become confidence 1.0. Separately, send DOST-FNRI a written data-use request — if they grant a licence, you can upgrade the whole table later.

**Done when:** 40 dishes seeded, kcal/macro consistency check passes, admin review screen works.

---

## Chapter 8 — The resolver cascade

**Effort:** xhigh

The single most important function in the app. Every logging surface calls it.

### Prompt

```
Effort: xhigh. PLAN FIRST.

Design and then build packages/food/src/resolve.ts — the food resolution
cascade. Signature roughly:

  resolveFood(query: FoodQuery, userId: string): Promise<FoodCandidate[]>

The cascade, in order, short-circuiting when confidence is high enough:
  1. My Foods   — user's own confirmed/recent foods (fuzzy + alias match)
  2. PH core    — source='ph_core', matching on name AND name_tl aliases
  3. Local cache— previously fetched foods in our DB
  4. Open Food Facts — if a barcode is present, this goes FIRST
  5. USDA FDC   — generic ingredients and international items
  6. LLM estimate — last resort only, confidence capped at 0.5,
     always flagged in the UI as an estimate

Requirements:
- Taglish matching: "kanin", "rice", "sinaing" must all hit the same food.
  Build an alias index; use trigram similarity in Postgres (pg_trgm) plus
  an explicit alias table. Handle common misspellings.
- Rank candidates by (source priority x match score x user affinity).
  User affinity = how often this user has logged this food.
- Return ALWAYS a ranked list, never a single answer. The UI decides
  whether to auto-pick (top candidate > 0.85 and 2x the runner-up) or ask.
- Every candidate carries: source, confidence, and why_matched (for
  debugging and for the UI's "why this?" affordance).
- Aggressive caching. A repeat query for the same user must not hit
  the network.

Write the plan, including the exact scoring formula and how you break
ties. Stop for approval before implementing.
```

Then: `Implement the approved plan with full Vitest coverage, including Taglish alias cases and a barcode-first case.`

**Done when:** `resolveFood({text: "2 tasa kanin"})` returns rice as top candidate from `ph_core` with high confidence, offline.

**Watch out:** don't let it collapse the cascade into "just ask the LLM." The LLM is rung 6 for cost and accuracy reasons.

---

## Chapter 9 — User contributions & label OCR

**Effort:** high

### Prompt

```
Effort: high.

Fill the PH barcode gap.

1. When a barcode scan misses in Open Food Facts, show an "Add this
   product" flow instead of a dead end.
2. Nutrition-label OCR: user photographs the nutrition facts panel;
   send to a multimodal model with a strict Zod schema
   (serving size, servings per pack, kcal, protein, carbs, fat, sodium,
   sugar) and pre-fill the form. User confirms before save.
   - Handle the PH label convention: values are often per serving, not
     per 100g, and sodium is in mg.
3. Save as source='user', private by default, with an opt-in
   "Share with other KayaMo users" toggle and a separate opt-in
   "Contribute to Open Food Facts" action.
4. Any user-created food auto-enters that user's My Foods.

Zod-validate the OCR output. If confidence is low or fields are missing,
show the field highlighted rather than guessing.
```

**Done when:** you can scan a Lucky Me pack that OFF doesn't have, photograph the label, and get a saved food in under 30 seconds.

---

# PHASE 3 — Logging surfaces

## Chapter 10 — Quick log & meal templates

**Effort:** high

Adherence is the whole ballgame. Roughly 60% of food-tracking app users quit within two weeks, and consistent logging in trials falls from ~68% in week 1 to ~21% by week 12. The fix is not motivation, it is friction.

### Prompt

```
Effort: high.

Build the fastest possible logging path. Target: repeat meal logged in
under 5 seconds, three taps maximum.

1. Home screen "Quick log" strip: the user's top 8 foods for the current
   meal slot, ranked by (frequency at this hour x recency). One tap logs
   the default serving; long-press opens quantity adjust.
2. Meal templates: save any combination of entries as a named template
   ("Baon", "Post-gym", "Jollibee 1-pc"). One tap logs the whole thing.
3. "Same as yesterday" and "Repeat last <meal_slot>" actions.
4. Bottom-sheet quantity editor with PH-native units first
   (tasa, piraso, order, hiwa, kutsara) before grams.
5. Undo toast on every log, 8-second window.
6. Everything writes through the Chapter 5 offline layer.

Then open the browser, screenshot at 390px, and verify the whole flow is
reachable one-handed in the bottom half of the screen.
```

**Done when:** you can log your usual breakfast in three taps without typing.

---

## Chapter 11 — Manual search UI

**Effort:** medium

### Prompt

```
Effort: medium.

Build the search screen on top of resolveFood().
- Debounced search, local-first results appear instantly, remote results
  stream in below with a source badge (PH / Brand / USDA / Yours).
- Each result shows kcal per default serving, not per 100g.
- Confidence indicator: verified foods get a check, LLM estimates get a
  clearly-labelled "estimate" tag.
- Recent + frequent tabs.
- Empty state offers "Add it yourself" and "Describe it in chat".
```

---

## Chapter 12 — Barcode scanning in the browser

**Effort:** medium

### Prompt

```
Effort: medium.

In-browser barcode scanning.
- Use the native BarcodeDetector API where available (Chrome/Android).
- Fall back to @zxing/browser on iOS Safari and anywhere BarcodeDetector
  is missing — feature-detect, do not user-agent sniff.
- Continuous scan mode with a torch toggle where supported.
- On hit: resolveFood with barcode → instant log sheet.
- On miss: hand off to the Chapter 9 "Add this product" flow.
- Handle camera permission denial with a real recovery instruction, not
  a generic error.
```

**Watch out:** iOS Safari's camera constraints differ. Test on a real iPhone, not the simulator.

---

## Chapter 13 — Weight, trend, and the home screen

**Effort:** high

### Prompt

```
Effort: high.

Build the home screen — the screen the user sees 6+ times a day.

1. Weight logging: one-tap entry, remembers last value as the default,
   accepts kg with one decimal.
2. Trend calculation in packages/core/src/trend.ts: exponentially weighted
   moving average over scale weight to strip out water/glycogen noise.
   Expose both raw and trend series. Include the weekly rate of change
   in kg/week and %BW/week.
3. Home layout:
   - TrendRibbon (Chapter 2 signature element) at the top
   - Today's remaining kcal + macro rings below it
   - Quick log strip
   - Today's entries, grouped by meal slot, each swipe-to-edit
4. Frame progress WEEKLY, not daily. The headline number is "this week's
   average vs target", not "you have 340 calories left today". A single
   over-target day must not read as failure.

Screenshot at 390px and verify the trend ribbon is legible at a glance.
```

**Done when:** the home screen answers "am I on track?" in under two seconds of looking.

---

# PHASE 4 — AI logging

## Chapter 14 — Taglish natural-language logging

**Effort:** xhigh

This is your single biggest differentiator. No US-built tracker parses *"2 tasa kanin, isang hita ng manok, tapos isang Coke sakto."*

### Prompt

```
Effort: xhigh. PLAN FIRST.

Build natural-language food logging with Taglish support.

INPUT examples that must work:
  "2 cups rice and fried chicken"
  "2 tasa kanin, isang hita ng manok, 1 can coke"
  "kumain ako ng sinigang na baboy, isang bowl, tapos 2 kanin"
  "adobo with rice, medyo malaki yung serving"
  "grande iced latte sa Starbucks"

PIPELINE:
1. Cheap-model extraction pass. Use a small fast model (env-configured;
   default to the cheapest capable tier). Vercel AI SDK generateObject
   with this Zod schema:
     items: [{ raw_text, food_name_guess, food_name_en, quantity,
               unit, meal_slot_guess, confidence }]
     ambiguities: [{ item_index, question, options[] }]
   System prompt must explicitly handle: Tagalog/Taglish code-switching,
   Filipino quantity words (isa/dalawa/tatlo, isang piraso, kalahati),
   vague sizes (malaki/maliit/sakto → mapped to portion multipliers),
   and Filipino meal names (almusal, tanghalian, hapunan, meryenda).
2. For each item, call resolveFood(). Never let the LLM invent nutrition
   numbers at this stage — it only extracts text and quantities.
3. Confidence gate:
   - all items > 0.85 → show a confirm sheet, pre-filled, one tap to save
   - any item ambiguous → ask ONE clarifying question inline (chips, not
     free text), then resolve
   - unresolvable item → offer search / add-new, never silently drop it
4. Every parse writes to agent_runs with token count and cost.
5. Learning loop: when the user corrects a resolution, store the mapping
   in their alias table so the same phrasing resolves correctly next time.

Write the plan including the exact system prompt, the portion-multiplier
table for vague sizes, and how you avoid asking more than one question.
Stop for approval.
```

Then implement, with a Vitest suite of at least 30 real Taglish phrases you actually say.

**Done when:** all 30 test phrases resolve correctly or ask exactly one sensible question.

**Watch out:** the agent will try to have the LLM output calorie numbers directly. Forbid it. The LLM extracts *text and quantity only*; nutrition comes from the resolver.

---

## Chapter 15 — Photo logging (honest version)

**Effort:** high

Be realistic about accuracy. Published validation work puts multimodal-LLM energy estimation around **36% mean absolute percentage error** on standardized single foods, with systematic *under*estimation that worsens as portions grow. Error roughly doubles for mixed meals versus single items — and Filipino saucy composite dishes (adobo, sinigang, kare-kare) are the hard case. Frame the feature as "fast draft, you confirm," never as measurement.

### Prompt

```
Effort: high.

Build photo meal logging using the two-step "nutritionist" approach,
which measurably outperforms single-shot estimation.

STEP 1 — decomposition. Send the photo to a multimodal model. Zod schema:
  dish_name_guess, is_composite, components: [{ name, name_tl,
  estimated_grams, visual_cues, confidence }], plate_reference (what
  the model used for scale), overall_confidence, warnings[]
Prompt it to reason about scale using visible references (plate rim,
utensil, hand, rice mound) and to state when it cannot.

STEP 2 — resolution. Each component goes through resolveFood(). Nutrition
comes from our database, NOT the vision model.

UI CONTRACT (non-negotiable):
- Present the result as an EDITABLE DRAFT, with portion sliders on every
  component, opened by default — not a saved entry with an edit option.
- Show a confidence band, e.g. "≈620 kcal (range 480–780)". Never a bare
  precise number.
- Copy must say "estimate — check the portions". Do not claim accuracy
  percentages anywhere in the product.
- If overall_confidence is low OR is_composite is true, require the user
  to touch at least one portion control before saving.
- Every correction feeds My Foods so the same plate is accurate next time.

COST + PRIVACY:
- Downscale to max 1024px before upload.
- Delete the photo from Supabase Storage after analysis unless the user
  explicitly saves it to their meal history.
- Rate limit: N photo analyses per user per day, configurable via env.
- Log tokens and cost_usd to agent_runs.
```

**Done when:** photographing a plate of adobo and rice gives a sensible draft with sliders, and the copy never overclaims.

**Watch out:** if the agent writes marketing copy like "AI-powered accurate calorie detection," delete it. You will regret the accuracy claim the first time it says a bowl of sinigang is 200 kcal.

---

## Chapter 16 — The chat surface

**Effort:** high

### Prompt

```
Effort: high.

Build the chat screen — one input that accepts text, voice, or photo,
routed to the right handler.

1. Intent router (cheap model, single classification call, Zod enum):
   LOG_FOOD | LOG_WORKOUT | LOG_WEIGHT | ASK_QUESTION | ADJUST_TARGETS |
   PLAN_MEALS | SMALL_TALK
2. Route LOG_* to the Chapter 14/15 pipelines (no extra LLM call).
3. ASK_QUESTION goes to the coach agent (Chapter 26) with RAG over the
   user's own logged history.
4. Streaming responses via Vercel AI SDK. Tool calls render as inline
   cards (a logged meal appears as an editable entry card, not as text).
5. Voice input via the Web Speech API where available, with a clear
   fallback. Tagalog and English both.
6. Conversation persisted, but the structured DB is always the source of
   truth — the chat log is never authoritative for what was eaten.
```

---

## Chapter 17 — Cost guard & model routing

**Effort:** high

Do this *before* you have users, not after a surprise bill.

### Prompt

```
Effort: high.

Build packages/ai/src/router.ts — centralized model selection and cost control.
Every LLM call in the codebase must go through it. Add an ESLint rule
banning direct provider imports outside packages/ai/src/.

TIERS (configure model IDs via env so they can be swapped without a deploy):
  - NANO: intent classification, unit parsing, simple extraction
  - SMALL: Taglish food extraction, OCR structuring
  - VISION: photo decomposition
  - COACH: weekly analysis and long-form advice only

CONTROLS:
- Per-user daily budget in USD, enforced before the call, with a
  graceful degrade message (not an error) when exceeded.
- Prompt caching for the long system prompts.
- Embedding-based lookup BEFORE any LLM call for repeat food phrases:
  if this user has said "2 tasa kanin" before, skip the model entirely.
- Every call logged to agent_runs with model, tokens, latency, cost_usd.
- A /admin/costs dashboard: cost per user per day, per feature, p50/p95
  latency, cache hit rate.

Target: under $0.50 per active user per month at typical usage
(daily chat logging, a few photos a week, one weekly coaching run).
```

**Done when:** the cost dashboard shows real numbers from your own usage and the embedding cache is hitting on repeat meals.

---

# PHASE 5 — The coaching engine

## Chapter 18 — Adaptive TDEE

**Effort:** xhigh

Static formulas drift. Metabolic adaptation is real, and formula-based TDEE error grows over a cut while an energy-balance back-calculation stays honest — this is exactly why MacroFactor outperforms formula-driven apps. Seed with a formula, then switch to your own data.

### Prompt (plan first)

```
Effort: xhigh. PLAN ONLY.

Design the adaptive expenditure engine in packages/core/src/tdee.ts.

COLD START (days 0-13):
- Mifflin-St Jeor from profile (sex, age, height, weight), or
  Katch-McArdle when body fat % is known.
- Activity multiplier from the onboarding question, but store it as an
  ADJUSTABLE prior, not a fixed truth.
- Mark these estimates method='formula', confidence low.

ADAPTIVE (day 14+):
- Back-calculate TDEE from energy balance: over a rolling window,
  TDEE ≈ mean daily intake − (Δ trend weight × energy density of tissue
  change / days). Use the TREND weight from Chapter 13, never raw scale
  weight.
- Weight the estimate by logging completeness. A week where the user
  logged 3 of 7 days should widen the confidence interval, not silently
  produce a confident wrong number.
- Blend formula prior → data estimate with a weight that shifts toward
  the data as the window fills (Bayesian-ish; you pick the exact form
  and justify it).
- Output: { tdee_kcal, ci_low, ci_high, method, completeness,
  days_of_data } written to expenditure_estimates.

EXPLICIT NON-GOALS:
- Do NOT feed wearable "calories burned" into this calculation. Device
  active-energy figures are noisy and double-count. Wearable data is
  context for the UI only.
- Do NOT recompute history. Each day's estimate is stored as of that day.

EDGE CASES you must handle and describe in the plan:
- User travels / gets sick and stops logging for 10 days
- A whoosh (sudden 1.5kg drop from water) mid-window
- Deliberate refeed week
- User is a beginner gaining muscle while losing fat (weight flat,
  composition changing) — the estimate must not spiral
- First two weeks of creatine

Write the plan with the exact math, the smoothing choice, and how each
edge case is neutralized. Stop for approval.
```

Then: `Implement with Vitest tests. Include a simulation harness in scripts/simulate-tdee.ts that generates 12 weeks of synthetic intake+weight data for four personas (cutting, bulking, maintaining, erratic logger) and asserts the estimate converges within a stated tolerance.`

**Done when:** the simulation converges for all four personas and does not blow up on the whoosh case.

**Watch out:** the agent will reach for a naive linear regression over raw weight. Raw weight is 80% noise at a weekly scale. Force it through the trend series.

---

## Chapter 19 — Macro targets & day types

**Effort:** xhigh

### Prompt

```
Effort: xhigh.

Build packages/core/src/targets.ts — target generation from goal + adaptive TDEE.

PROTEIN: 1.6-2.2 g/kg bodyweight. Evidence (Morton et al. 2018, BJSM,
49 studies) shows gains plateau around 1.62 g/kg, so default to 1.8 g/kg
for maintenance/bulk and 2.0-2.2 g/kg in a deficit to protect lean mass.
Use lean body mass instead of total weight when body fat % is known and
the user is over ~25% BF.

FAT: 0.6-1.0 g/kg floor for hormonal health. Never below 0.5 g/kg.
CARBS: the remainder. This is the lever that moves.

DEFICIT/SURPLUS RATES:
- Cut: 0.5-1.0% bodyweight per week. Cap the deficit at 25% below TDEE.
- Bulk: 0.25-0.5% per week.
- Recomp: maintenance ± 5%.

DAY TYPES (calorie cycling — same weekly total, redistributed):
- training day: carbs +20-30%
- rest day: carbs −20-30%, fat slightly up
- refeed: maintenance-level carbs, scheduled by the check-in agent
- deload week: training-day bump reduced
Day type is derived from the user's training schedule, and overridden
automatically when a workout is actually logged on an unplanned day.

HARD SAFETY FLOORS (encode in code, not just prompts — see Chapter 33):
- Never generate a target below 1200 kcal (female) / 1500 kcal (male),
  regardless of what the math or the user asks for.
- Never generate a weekly loss target above 1% bodyweight.
- If the user's requested goal would breach a floor, clamp it, and
  return a `clamped: true` flag the UI must surface honestly.

Targets are versioned rows (effective_from), never updated in place.
Vitest coverage on every floor and every clamp.
```

**Done when:** the floors are unbreachable from the API, not just hidden in the UI.

---

## Chapter 20 — The weekly check-in

**Effort:** high

Weekly framing is the adherence lever. One bad day should never read as failure.

### Prompt

```
Effort: high.

Build the weekly check-in — a scheduled Supabase Edge Function plus a
review screen.

TRIGGER: Sunday evening, Asia/Manila, via pg_cron → Edge Function.

PIPELINE (mostly deterministic; the LLM writes the narrative only):
1. Compute, in code: 7-day mean intake, logging completeness %, trend
   weight change, actual vs target rate, updated TDEE from Chapter 18,
   training volume and sessions completed, average protein hit rate.
2. Decide, in code, using explicit rules: hold targets / adjust kcal /
   suggest a diet break / suggest a deload. Never let the LLM make this
   call — it produces the EXPLANATION, not the DECISION.
3. LLM pass (COACH tier) generates a short Taglish-capable narrative
   from the computed facts, in Coco's voice. Zod schema:
   { headline, whats_working[], whats_off[], the_change, one_action }
   Hard cap: 150 words total.
4. Store as a check-in record. Push notification. Review screen with a
   single "Apply changes" button and an "Explain this" affordance.

Rules for the narrative prompt:
- Never invent a number. Every figure must come from the computed facts
  passed in, and the schema must reject unreferenced numerics.
- If completeness < 50%, the headline is about logging consistency, not
  about weight — and no target change is applied that week.
- Never comment on appearance. Never use guilt framing.
```

**Done when:** a manually-triggered check-in produces an accurate narrative that contains zero numbers you didn't compute.

---

## Chapter 21 — Schedule awareness

**Effort:** high

This is the "work lifestyle" half of the brief — the part MyFitnessPal never touches.

### Prompt

```
Effort: high.

Make KayaMo aware of the user's actual working day.

1. Optional Google Calendar read-only connection (OAuth, scoped to
   freebusy + event titles). Store nothing but derived signals.
2. Derive: typical meal windows, days with back-to-back meetings,
   commute blocks, and days with no gym-sized gap.
3. Use it for:
   - Reminder timing: nudge at the END of a likely meal window, not on
     a fixed clock. Never nudge during a meeting.
   - "Heads up: you have meetings 12-3 tomorrow, want to pre-log baon?"
   - Training scheduling: the training coach proposes sessions into
     real gaps, not into occupied time.
4. SHIFT WORK support (BPO/night shift is common here and every US app
   gets it wrong): let the user define their own "day boundary" —
   the day rolls over at their wake time, not at midnight. Every daily
   aggregate must respect this, including targets and streaks.
5. Full offline/no-calendar fallback: a manual schedule template
   (weekday pattern + gym days) that gives 80% of the benefit.

Privacy: calendar event titles are never sent to an LLM. Only derived
time blocks are.
```

**Done when:** setting your day boundary to 4pm (night shift) makes every daily total roll over correctly.

---

# PHASE 6 — The training side

## Chapter 22 — Exercise library & workout logger

**Effort:** high

### Prompt

```
Effort: high.

Build the gym logging half of the app.

1. Seed an exercise library (~120 exercises) with: name, name_tl aliases,
   primary/secondary muscles, equipment, movement pattern, unilateral flag,
   default rep range. Users can add their own.
2. Workout logger UI, optimized for use mid-set with sweaty hands:
   - Big tap targets, previous session's numbers pre-filled as the default
   - Weight/reps steppers, not free text keyboards
   - RPE/RIR picker (optional, one tap, dismissible)
   - Rest timer that auto-starts on set completion, with a notification
     when it fires even if the screen is off
   - Plate math helper: given target weight and bar weight, show the
     plates per side (kg plates, PH gym reality: 20/15/10/5/2.5/1.25)
3. Templates: save a session as a routine; routines assemble into a
   program with a weekly schedule.
4. Everything writes through the offline layer — gyms have terrible signal.
5. Superset and dropset support without complicating the common path.

Screenshot the logging screen at 390px and verify one-handed reachability.
```

**Done when:** you can log a full session without ever opening a keyboard.

---

## Chapter 23 — Progression engine

**Effort:** xhigh

### Prompt

```
Effort: xhigh. PLAN FIRST.

Build packages/core/src/progression.ts.

COMPUTE:
- e1RM per set via Epley (1RM = w × (1 + reps/30)) and Brzycki
  (1RM = w × 36/(37 − reps)); store both, surface the average, and flag
  when reps > 12 since both formulas degrade badly there.
- Best e1RM per exercise per session; e1RM trend over time.
- Weekly volume per muscle group (hard sets, where a hard set is
  RIR ≤ 3 or, when RPE is unlogged, any working set).
- Volume landmarks per muscle group (MEV / MAV / MRV as configurable
  defaults, adjustable per user). Show current weekly volume against
  the user's band, not against a population average presented as truth.

RECOMMEND (deterministic rules, not LLM):
- Double progression: hit the top of the rep range on all sets → add
  load next session (2.5kg upper, 5kg lower, configurable).
- Stall detection: no e1RM improvement across 3 sessions → suggest a
  rep-range reset, a technique check, or a deload.
- Fatigue proxies: rising RPE at constant load, falling reps at constant
  load, session-to-session e1RM decline → deload flag.
- Deload proposal after 4-6 weeks of accumulated volume OR two fatigue
  flags: 50% volume, load maintained.

Plan the exact rule thresholds and how they interact, then stop.
```

Then implement with tests over synthetic 12-week training logs.

**Watch out:** don't let it present MEV/MAV/MRV as settled science with precise numbers. They are heuristic training landmarks. The copy should say "your band," and the numbers must be user-adjustable.

---

## Chapter 24 — Linking training to nutrition

**Effort:** medium

### Prompt

```
Effort: medium.

Wire the two halves together.

1. A logged workout automatically sets that day's day_type to 'training'
   and applies the training-day macro split (Chapter 19).
2. A deload week (from Chapter 23) reduces the training-day carb bump and
   tells the check-in agent so the narrative explains why.
3. Post-workout card on the home screen: protein remaining today, with a
   one-tap "log my usual post-gym" if a template exists.
4. Weekly view correlating training volume and intake against the trend —
   as a plain observation, never as a causal claim.
5. Do NOT add calories back for exercise. State this explicitly in a
   short in-app explainer: the adaptive TDEE already contains the user's
   real activity level, so eating back "burned calories" double-counts.
```

---

# PHASE 7 — Agents

## Chapter 25 — Agent architecture

**Effort:** xhigh

Resist the multi-agent swarm. For a solo dev, one tool-using agent over a structured database beats an orchestra you cannot debug.

### Prompt (plan first)

```
Effort: xhigh. PLAN ONLY.

Design the agent layer for KayaMo. Constraint: ONE primary tool-using
agent ("Coco"), plus scheduled/event-triggered runs. No supervisor
hierarchy, no agent-to-agent delegation, until I explicitly ask for it.

TOOLS Coco can call (each a typed function with a Zod schema):
  logFood, logWeight, logWorkout, searchFoods, getDaySummary,
  getWeekSummary, getTrend, getTargets, proposeTargetChange,
  getTrainingHistory, proposeWorkout, planMeals, getRecentEntries,
  searchOwnHistory (RAG)

MEMORY ARCHITECTURE — be specific about what lives where:
  - Structured DB = source of truth. Always. Every number Coco states
    must come from a tool call, never from conversation memory.
  - Short-term: the current conversation, capped and summarized.
  - Long-term profile: a compact structured record (goals, preferences,
    dislikes, injuries, schedule shape, foods they hate) — updated by an
    explicit tool, never by silent inference.
  - Semantic memory: pgvector over past meals, workouts, and check-ins
    for "what did I usually eat on gym days in June?" queries.

GUARDRAILS (wrap every run):
  - Input: prompt-injection screening on any user-supplied text that
    came from a photo/OCR path.
  - Output: schema validation, numeric grounding check (reject any
    number not present in a tool result), and the Chapter 33 safety
    classifier.
  - Write actions (logFood, proposeTargetChange) require user
    confirmation in the UI before they commit. Coco proposes; the user
    disposes.

TRIGGERS:
  - user message (chat)
  - scheduled: weekly check-in (Ch 20)
  - event: 3 days no logging, weight trend crosses target band,
    stall detected

Write the plan including the full tool schemas and the numeric-grounding
check design. Stop for approval.
```

Then implement with the Vercel AI SDK, one tool per file in `packages/ai/src/tools/`.

**Done when:** Coco cannot state a number that didn't come from a tool result — prove it with a test that feeds a hallucination-prone prompt and asserts rejection.

---

## Chapter 26 — Coach agent + RAG over your own history

**Effort:** xhigh

### Prompt

```
Effort: xhigh.

Build the retrieval layer that makes Coco actually personal.

1. Embed and index: each food entry (name + context + time), each
   workout session summary, each weekly check-in. pgvector, HNSW index.
   Embed on write, batched, cheapest embedding model.
2. searchOwnHistory tool: hybrid search (vector + structured SQL filter
   on date range, meal slot, exercise). Structured filters run FIRST to
   cut the candidate set, then vector rank.
3. Questions it must answer correctly:
   - "What do I usually eat for breakfast on gym days?"
   - "Ano yung kinain ko nung nag-PR ako sa bench?"
   - "Was I eating more or less protein in June?"
   - "Anong ulam ang madalas kong kainin pag late shift?"
4. Every answer cites the underlying entries — the UI renders them as
   tappable cards, so the user can verify and correct.
5. Cap retrieval to a token budget; summarize rather than truncate.
```

**Done when:** all four example questions return correct, cited answers against your seeded data.

---

## Chapter 27 — Planner agent (PHP-aware)

**Effort:** high

Nobody else does this for Filipinos. Budget-aware meal planning in pesos is a genuine differentiator.

### Prompt

```
Effort: high.

Build the meal planning tool.

INPUT: weekly budget in PHP, macro targets, days to cover, cooking
constraints (time, equipment, who cooks), disliked foods from the
long-term profile, and whether they eat out / order delivery on
which days.

OUTPUT (Zod schema):
  { days: [{ date, meals: [{ slot, dish, servings, est_kcal,
    est_macros, est_cost_php }] }],
    grocery_list: [{ item, qty, unit, est_cost_php, where }],
    total_cost_php, prep_plan: [{ day, tasks[] }] }

RULES:
- Dishes come from the PH core table and the user's own history first,
  international recipes second. Bias hard toward things they already eat.
- Cost estimates: maintain data/ph-core/prices.yaml with typical PHP
  prices (palengke vs supermarket vs convenience), user-editable, with
  a last_updated date shown in the UI so stale prices are visible.
  Never present a price as authoritative.
- Batch-cook aware: propose dishes that reheat well and share
  ingredients, because the user works full time.
- Respect budget as a hard constraint. If the macro targets cannot be
  hit within budget, say so plainly and show the cheapest protein
  sources that close the gap (eggs, tuna, chicken leg quarters,
  monggo, tokwa) rather than silently missing the target.
- Grocery list groups by store section and by trip.
```

**Done when:** it produces a week of food you'd actually eat, under budget, with a grocery list you could hand to someone.

---

## Chapter 28 — Proactive nudges

**Effort:** high

### Prompt

```
Effort: high.

Build the notification system. The bar is high: every notification must
earn its interruption or it gets turned off, and then the app is dead.

TRIGGERS (all user-toggleable, all schedule-aware from Chapter 21):
- End of a likely meal window with nothing logged → single quiet nudge
- Weigh-in reminder at the user's usual time, only if not yet logged
- Gym day, no session logged by evening → one nudge, never two
- Weekly check-in ready
- 3+ days of no logging → a re-entry nudge that is explicitly
  non-judgmental and offers the fastest path back in (quick log)

HARD RULES:
- Max 3 notifications per day. Ever.
- Never between the user's sleep hours (derived or configured).
- Never during a calendar meeting.
- Never a streak-loss guilt message. Never a weight-shaming message.
- Every notification deep-links to the action, not to the home screen.
- One-tap "fewer of these" on every notification.

TECH: Web Push for the PWA. Note: iOS only delivers Web Push to PWAs
installed to the home screen (16.4+), and subscriptions can silently
drop — detect a dead subscription and re-prompt gracefully. Add an
"Install KayaMo to get reminders" flow for iOS users in Safari.
```

---

# PHASE 8 — Mobile

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

# PHASE 9 — Safety, compliance, launch

## Chapter 33 — Safety guardrails

**Effort:** xhigh

Do not skip this. A calorie app is one bad interaction away from real harm.

### Prompt

```
Effort: xhigh.

Build packages/ai/src/safety.ts and wire it into every agent output path.

HARD CODE-LEVEL LIMITS (already in Chapter 19, now enforced globally —
these are code, not prompts, because prompts can be argued with):
- Calorie floors: 1200 (female) / 1500 (male). Non-negotiable, no
  override flag, no "advanced mode."
- Max weekly loss target: 1% bodyweight.
- Max deficit: 25% below estimated TDEE.
- Reject any user request to set targets below these. Explain why in
  plain language; do not lecture.

RED-FLAG DETECTION on user input (classifier, cheap model + keyword net):
- Requests for extreme restriction, fasting beyond safe windows,
  purging, appetite suppression, "how little can I eat"
- Weight goals implying a BMI below 17.5, or rapid-loss framing
- Body-image distress language
- Logging patterns suggesting restriction: sustained intake far below
  the floor, long logging gaps paired with sharp weight drops

RESPONSE PROTOCOL when flagged:
- Coco does NOT provide the requested plan or numbers.
- Warm, brief, non-clinical response. No diagnosis. No lecture.
- Surface Philippine support resources from a maintained config file
  (do not hardcode into a prompt where the model can garble them).
- Do not end the conversation; do not make the app unusable.
- Log the flag privately for the safety review, never shown as a
  "warning" badge to the user.

ALSO:
- Never comment on appearance, ever.
- Never use "cheat," "guilty," "earned," "burn it off," "bad food."
  Add a lint-style test asserting these strings never appear in any
  prompt template or UI copy.
- Medical disclaimer surfaced at onboarding and in settings: KayaMo is
  not a medical device and does not diagnose, treat, or prescribe.
- If the user mentions a medical condition (diabetes, PCOS, kidney
  issues, pregnancy, an eating disorder history), Coco defers to their
  clinician and does not generate a plan.

Write tests for every red-flag path.
```

**Done when:** the banned-vocabulary test passes across the entire codebase and every red-flag path is covered.

---

## Chapter 34 — Philippine data privacy compliance

**Effort:** high

Health data is **sensitive personal information** under the Data Privacy Act of 2012 (RA 10173). Under NPC Circular 2022-04, any controller processing sensitive personal information of **1,000 or more individuals** must register its data processing systems — and that circular explicitly names online and mobile applications. Registration is due within 20 days of the system commencing operation. Breach notification is 72 hours. Fines run 0.5–3% of annual gross income, capped at ₱5M per violation, plus criminal penalties.

### Prompt

```
Effort: high.

Implement RA 10173 compliance for KayaMo.

1. Consent: granular, separate opt-ins for (a) core processing,
   (b) photo analysis by a third-party AI provider, (c) health platform
   sync, (d) anonymized product analytics. Consent is versioned and
   timestamped; re-consent on material policy change. Nothing is
   pre-ticked.
2. Transparency: a plain-language privacy notice at kayamo.ph covering
   what is collected, why, who it goes to (name the LLM provider and the
   nutrition APIs), retention periods, and cross-border transfer.
3. Data subject rights, implemented in-app:
   - Export: full JSON + CSV of everything, generated on demand
   - Delete: hard-delete account and all data, with a stated grace period
   - Correct: already covered by editable entries
   - Object / withdraw consent per purpose
4. Security: encryption at rest (Supabase default) and in transit,
   RLS everywhere (already done), least-privilege service keys, audit
   log of admin access, no health data in application logs or error
   reports — add a scrubber to the error reporter.
5. Retention: photos deleted post-analysis unless saved; agent_runs
   inputs scrubbed after 30 days; account data purged N days after
   deletion request.
6. Breach plan: a documented runbook at docs/breach-response.md with the
   72-hour NPC notification path and the user notification template.
7. Create docs/compliance.md documenting: DPO designation (you, for now),
   the processing inventory, the lawful basis for each purpose, and a
   note that NPC registration is triggered at 1,000 users — with a
   reminder task.

Also generate the privacy policy and terms as markdown in docs/legal/,
clearly marked as a draft requiring review by a Philippine lawyer before
public launch.
```

**Watch out:** the generated policy is a starting draft. Have it reviewed before you take real users — you handle sensitive personal information, which is the highest-risk category under the Act.

---

## Chapter 35 — Observability & test coverage

**Effort:** medium

### Prompt

```
Effort: medium.

1. Error tracking (Sentry or similar) with a PII/health-data scrubber
   that strips food names, weights, photos, and chat content before send.
   Write a test proving the scrubber works.
2. Product analytics on EVENTS only, never content: meal_logged
   (with input_method), workout_logged, checkin_viewed,
   target_applied, photo_analyzed. Self-hostable (PostHog) preferred.
3. The metrics that actually matter, on an /admin dashboard:
   - D1 / D7 / D30 retention
   - Logging completeness distribution (this predicts churn better
     than anything else)
   - Median time-to-log per input method — your <15s target
   - Resolver hit rate by cascade rung (if rung 6 / LLM is firing a
     lot, your PH core has gaps)
   - Cost per active user per day
   - Photo correction rate (how often users adjust the AI's portions)
4. Test coverage audit. Required: resolver cascade, TDEE engine,
   target floors, safety classifier, offline sync idempotency, RLS.
   Playwright E2E for: onboard → log via each of the four methods →
   weigh in → check-in → apply targets.
```

---

## Chapter 36 — Launch checklist

**Effort:** medium

```
Effort: medium. Audit the whole repo against this list and produce
docs/launch-checklist.md with pass/fail and a fix list.

PRODUCT
[ ] Log a repeat meal in under 5 seconds, three taps
[ ] All four input methods work offline or degrade gracefully
[ ] Taglish parsing handles my 30 real test phrases
[ ] Photo logging opens as an editable draft, never a saved fact
[ ] Home screen answers "am I on track?" in two seconds
[ ] Weekly framing everywhere; no daily failure states
[ ] Night-shift day boundary works end to end

DATA
[ ] 40+ PH core dishes, personally verified
[ ] Resolver falls through to LLM on <10% of my own logs
[ ] No FNRI data was scraped; every ph_core entry has a source_note
[ ] ODbL attribution for Open Food Facts is visible in-app

SAFETY
[ ] Calorie floors unbreachable from the API
[ ] Banned-vocabulary test passes
[ ] Red-flag paths tested
[ ] Medical disclaimer at onboarding

PRIVACY
[ ] Granular consent, nothing pre-ticked
[ ] Export and hard-delete both work
[ ] No health data in logs or error reports
[ ] Privacy policy drafted, flagged for legal review
[ ] NPC registration reminder set at the 1,000-user threshold

COST
[ ] Per-user monthly LLM cost under $0.50 at my usage
[ ] Per-user daily budget cap enforced
[ ] Embedding cache hitting on repeat meals

SHIP
[ ] Installable PWA on Android + iOS
[ ] Capacitor builds signed for both stores
[ ] Health sync working on a real device each platform
[ ] Store copy makes no accuracy or health-outcome claims
```

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
description: KayaMo nutrition and food data rules — resolver cascade order, PH food data, portions, Taglish aliases, licensing constraints.
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
