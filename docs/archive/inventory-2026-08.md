# KayaMo build-guide inventory — 2026-08-26

Read-only audit against `docs/build/` (build-guide chapters only). Git `ch20`–`ch24` Mus SoT commits were ignored as evidence. Status is from the working tree.

Judged chapters: **13–35** (plus schema amendments that landed with ch04). Chapters 0–12 were out of this prompt’s table; they have real artifacts (schema, Dexie queue, resolver, search, barcode) and are treated as foundations in section 4.

States: **IMPLEMENTED** · **THIN** · **MISSING** · **DIVERGED**

---

## 1. Chapter table

| Ch | Title | State | Evidence | Notes |
|---|---|---|---|---|
| 13 | Weight, trend, home | DIVERGED | `packages/core/src/trend.ts`, `trend.test.ts`; `packages/ui/src/components/TrendRibbon.tsx`, `ribbon.ts`; weight UI on Physical Self in `apps/pwa/src/app/app/kayamo-app.tsx` | EWMA + weekly kg rate exist. Home is the Mus Daily Command Center, not a nutrition home. `TrendRibbon` is on the design gallery, not Home. No `%BW/week` in `trend.ts`. Headline is remaining kcal on Physical Self, not “this week’s average vs target”. |
| 14 | Taglish NL logging | DIVERGED | `packages/food/src/query-parse.ts`, `query-parse.test.ts` (3 cases); `resolve.ts` / `resolve.test.ts` (malaki/maliit, kanin/sinaing); meal slots in `meal-slot.ts` | Deterministic parser, not a cheap-model Zod extract of `items[]` / `ambiguities[]`. Filipino units and size multipliers exist. **No 30-phrase Taglish suite** (about 3 parse tests + a handful of resolve cases). **Critical check: the food-log path does not have an LLM emit nutrition numbers** — there is no LLM in this path; `resolveFood` supplies grams/kcal. No `agent_runs` write on parse. Multi-item utterances (`2 tasa kanin, isang hita…`) are not a first-class extract step. |
| 15 | Photo meal logging | MISSING | Schema allows `input_method = 'photo'` (`0001_core_schema.sql`, `foods.ts`). Label OCR is `packages/ai/src/ocr-label.ts` + `apps/pwa/src/app/api/foods/ocr/route.ts` + add-product form | Meal two-step decomposition (`components[]` → `resolveFood`) is absent. No portion sliders-on-by-default draft, no confidence **range**, no post-analysis photo delete for meals, no per-user daily photo rate limit. Existing vision path is **packaged-label OCR** (closer to guide ch9), and that path **does** ask a model for nutrition-panel numbers (appropriate for OCR, not for meal photos). |
| 16 | Chat surface | DIVERGED | `packages/ai/src/coco-router.ts`, `contracts.ts`; `apps/pwa` Mus tab / `api/coco/respond` | No 7-value intent enum (`LOG_FOOD` … `SMALL_TALK`). Modes are `chat \| focus \| workout \| vent \| diary \| prayer`. Writes are confirmable proposals, not inline food-entry cards from ch14/15. Voice exists on Life Inbox when `SpeechRecognition` exists, not as the chat composer’s primary path. Streaming of a food pipeline is not the Mus chat. |
| 17 | Cost guard & routing | THIN | `packages/ai/src/router.ts` (tiers nano/small/vision/coach, env model IDs); `budget.ts`; coco budget **before** provider in `coco-router.ts` (~L281); `insertAgentRunTelemetry` in `packages/db/src/queries/agent.ts`; coco route writes `agent_runs` | **High risk.** `completeObject` in `router.ts` does **not** check spend before the call — label OCR/vision can bill without the coco budget. No embedding cache before LLM for repeat phrases. ESLint only bans `@kayamo/db/service` in `.tsx`; **no ban on `@ai-sdk/openai` outside `packages/ai`**. No `/admin/costs` dashboard (`apps/admin` is PH-core editor). `agent_runs` schema has model, tokens, `latency_ms`, `cost_usd` and coco records them; OCR does not go through that sink. |
| 18 | Adaptive TDEE | IMPLEMENTED | `packages/core/src/tdee.ts`, `tdee.test.ts`; `scripts/simulate-tdee.ts` (4 personas: cutting, bulking, maintaining, erratic logger) | Mifflin–St Jeor cold start, energy-balance off **trend** weight, completeness, CI. Comment and API omit wearable active-energy (no such input). |
| 19 | Targets + safety floors | IMPLEMENTED | `packages/core/src/targets.ts`, `targets.test.ts`; `guidance.ts` `clamped` / `clampReasons`; versioned rows via guidance API (`packages/db/src/queries/guidance.ts`, `user-metrics.ts` `effective_from` / expenditure `revision`) | Floors **1200F / 1500M** in code (`calorieFloor`); unspecified sex uses 1500. Max 1%/week loss, 25% deficit, fat ≥ 0.5 g/kg, carbs remainder. Tests for floors, rate, deficit, macro floor. Protein is 1.8 or 2.0 g/kg, not a 1.6–2.2 **range control**. No override parameter on `generateNutritionTarget`. |
| 20 | Weekly check-in | DIVERGED | In-app Weekly Reset: `weekly-reset-sheet.tsx`, Grove entry, `adaptive.ts` | **No** scheduled Edge Function, **no** `pg_cron` (`supabase/functions/` empty). Decision logic is local deterministic code; no LLM weekly narrative job with word cap / number-rejection against computed facts. |
| 21 | Schedule awareness | DIVERGED | `packages/offline/src/logical-date.ts` + tests; `packages/core/src/integrations.ts`; Dexie `busy_blocks` | Night-shift `day_starts_at` is honored for logical dates. Calendar is explicitly **not connected**; titles are not sent to an LLM because there is no calendar sync. Manual busy hours only. |
| 22 | Exercise library + logger | DIVERGED | `packages/db/src/seed.ts` `EXERCISE_NAMES`; workout UI `workout-flow.tsx`; `calculatePlatesPerSide`, `restTimerDeadline` in `progression.ts` + tests; offline rest timer | Logger, plate math, rest timer, previous-session proposal path exist. Seed is **~34** exercises, not ~120, and Taglish aliases are sparse. |
| 23 | Progression engine | IMPLEMENTED | `packages/core/src/progression.ts`, `progression.test.ts`; e1RM stored via DB trigger (offline twin `estimateSetE1rm`) | Epley **and** Brzycki, stall / deload proposal, volume bands. |
| 24 | Training–nutrition link | IMPLEMENTED | `dayTypeForToday` in `guidance.ts` + `guidance.test.ts`; `estimateTdee` has no exercise-kcal input | Logged workout → `day_type='training'` target. Calories are **not** added back for exercise. |
| 25 | Agent architecture | DIVERGED | `packages/ai/src/tools.ts`, `coco-router.ts` citation/proposal guards; proposals `requiresConfirmation: true` | One Coco agent, not a 7-intent food router. Tools are **authorized, not executed**. Citations must be in the snapshot (grounding for **records**, not a general “reject unreferenced numbers in prose” pass). |
| 26 | RAG over own history | THIN | `agent_memory.embedding` pgvector column (`packages/db/src/schema/agent.ts`); `packages/ai/README.md` names `memory.ts` | **`memory.ts` does not exist.** No hybrid filter-then-vector search, no tappable RAG citations of history. Coco citations are snapshot IDs, not pgvector hits. |
| 27 | Planner (PHP-aware) | THIN | `data/ph-core/prices.yaml` (estimates, `last_updated`) | File exists. No planner agent using PHP as a **hard** constraint. |
| 28 | Proactive nudges | MISSING | Quiet reminder / SW path in daily-loop PWA code | No max-3/day meeting-aware engine. No sleep-hours + calendar-meeting gate as specified. |
| 29 | PWA hardening | DIVERGED | `apps/pwa/src/app/manifest.ts`; `apps/pwa/public/sw.js`; `pwa-runtime.tsx` | SW + standalone manifest exist. Manifest **`id` is not `ph.kayamo.app`** (bundle id is copy in Settings). iOS handling is not a dedicated doc. |
| 30 | Capacitor wrap | THIN | `apps/mobile/package.json` (`sync` echoes “Capacitor wrap is Chapter 30”); `apps/mobile/README.md` | No `capacitor.config.ts`, no native plugins. |
| 31 | Health data sync | MISSING | Settings catalog: health/wearable **Not connected** (`integrations.ts`) | No Health Connect / Apple Health pipeline. Physical Self logs still count. |
| 32 | Store submission | MISSING | — | No store listing assets or submission checklist execution. |
| 33 | Safety guardrails | THIN | `packages/ai/src/safety.ts`, `safety.test.ts` (regex red flags) | No PH support-resources **config file**. **No test** that banned vocabulary (`cheat`, `guilty`, `earned`, `burn it off`, `bad food`, `sinful`) is absent from prompts/UI. Rule exists in `.cursor/rules`; enforcement is not automated. |
| 34 | RA 10173 | THIN | `docs/compliance.md` (draft, lawyer review unchecked); Life Archive export (Mus slice); `scrubbed_at` on `agent_runs` | Granular **versioned consent** not found as a product surface. Hard delete / log scrubber incomplete vs guide. Compliance doc says pre-launch. |
| 35 | Observability | THIN | `insertAgentRunTelemetry` (empty `input`/`output`); `markAgentRunScrubbed`; RLS tests | Coco runs are content-free. No event-only analytics product. Admin is not a cost/latency metrics console. Health-in-logs scrubber is convention + telemetry shape, not a proven global error filter. |

---

## 2. Schema amendments (ch04)

| Amendment | Landed? | Where |
|---|---|---|
| `server_updated_at` trigger-maintained, separate from client `updated_at` | Yes | `0001_core_schema.sql` (`kayamo_touch_row`); RLS test “does not let user A forge `server_updated_at`” |
| `deleted_at` tombstones on syncable tables, filtered in RLS | Partial | Tombstones exist. **0013** restored owner SELECT of tombstoned rows for sync (so “always `deleted_at is null` in SELECT” is **not** the live rule). App helpers still filter live rows. |
| `logical_date` on food_entries / weight_logs / workouts | Yes | `0001` + `kayamo_set_logical_date`; later `0006` |
| anon has **no** SELECT on foods / servings / exercises | Yes | `0001` `revoke all … from public, anon`; `rls.test.ts` `does not let anon select %s` |
| unique `(source, source_id)` on foods; barcode indexed **not** unique | Yes | `0001` `foods_source_source_id_key`; `foods_barcode_idx` only |
| `food_name_snapshot`, `serving_label_snapshot`, `resolved_via` on food_entries | Yes | `0001` (~L301–303) |
| `scrubbed_at` on `agent_runs` | Yes | `0001` (~L438); `markAgentRunScrubbed` |
| `expenditure_estimates` unique `(user_id, date, revision)` | Yes | `0001` `expenditure_estimates_user_date_revision_key` |

---

## 3. Top 5 gaps by risk

1. **ch17 cost guard is not global** — Coco has a pre-call USD cap; `completeObject` (vision OCR and any future ch14/15 model) does not. No embedding cache, no provider-import lint, no cost dashboard. This is the gap that can bill while you sleep.

2. **ch19 floors are real in `@kayamo/core`, but ch14/15 pipelines that would feed the card are not the guide’s LLM+confirm flows** — a Physical Self target **can** be clamped in code today (`generateNutritionTarget` + tests). The risk is not “no floor function”; it is **unbudgeted vision** and **missing meal-photo / NL-LLM logging** sitting next to a card that looks like a full tracker.

3. **ch15 meal photo logging is missing** — `input_method=photo` is schema fiction for meals. Label OCR is a different, billable vision call without the coco budget.

4. **ch14 Taglish NL logging is a parser, not the 30-phrase LLM extract+resolve product** — search/`resolveFood` is solid; “2 tasa kanin, isang hita…” as one chat utterance is not.

5. **ch33 banned-copy / PH crisis resources are not tested** — safety regexes exist; a forbidden-word sweep and a PH resource config do not. Shame copy can land in Mus UI without CI catching it.

Honorable mentions (product-shaped, not overnight-bill): ch26 RAG, ch20 cron check-in, ch30–32 native/health/stores, ch28 nudges.

---

## 4. Safe to build UI against

These have real logic and tests; UI can bind without inventing the engine:

- **Food identity + resolve** — `@kayamo/food` cascade, PH YAML, search, barcode (ch6–12).
- **Offline writes + sync queue** — Dexie, LWW, `logical_date`.
- **TDEE + targets + clamps** — `tdee.ts`, `targets.ts`, versioned expenditure/targets.
- **Weight trend math** — `trend.ts` (place `TrendRibbon` where the SoT Home actually is, or on Physical Self — don’t assume current Home is ch13).
- **Training math** — e1RM, plates, rest timer, workout logger (seed size aside).
- **Training day → nutrition day type** — `dayTypeForToday`.
- **Schema/RLS core** — ch04 amendments above (tombstone SELECT nuance in 0013).

Do **not** design chat/photo/quick-log chrome that assumes ch14–17 as specified until those gaps are filled or explicitly scoped out.

---

## 5. Open questions (not resolved from the tree)

- Whether production `OPENAI_API_KEY` is set; OCR will throw `AiConfigError` if not — cannot see `.env.local` contents in this audit by policy, and must not.
- Whether hosted Supabase has all 0001–0016 migrations applied (tree has files; live project not queried).
- How often `completeObject` is hit in real use (only label OCR found).
- Intent of 0013 tombstone-visible SELECT vs original “filter deleted in RLS” — sync vs hide-from-UI.
- Whether protein 1.8/2.0 g/kg was an accepted substitute for the 1.6–2.2 band.
- Companion rename Coco → Mus in UI vs `agent: 'coco'` in `agent_runs`.

---

*Audit date: 2026-08-26. No product files were modified for this report.*
