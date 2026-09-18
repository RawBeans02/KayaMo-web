# Phase 1 — Data foundation

**Chapters 3–5** · Week 1 · **Prerequisite:** Phase 0 complete and committed.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/01-data-foundation.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


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
