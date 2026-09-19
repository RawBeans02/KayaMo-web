# Phase 4 — AI logging

**Chapters 14–17** · Week 4 · **Prerequisite:** Phase 3 complete and committed.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/04-ai-logging.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


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
