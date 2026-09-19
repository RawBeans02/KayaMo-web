# Phase 6 — The training side

**Chapters 22–24** · Week 6 · **Prerequisite:** Phase 5 complete and committed.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/06-training.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


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
