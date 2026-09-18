# Phase 7 — Agents

**Chapters 25–28** · Week 7 · **Prerequisite:** Phase 6 complete and committed.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/07-agents.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


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
