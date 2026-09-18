# Phase 2 — The food data layer

**Chapters 6–9** · Week 2 · **Prerequisite:** Phase 1 complete and committed.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/02-food-data.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


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
