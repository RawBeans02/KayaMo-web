# Phase 5 — The coaching engine

**Chapters 18–21** · Week 5 · **Prerequisite:** Phase 4 complete and committed.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/05-coaching-engine.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


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
