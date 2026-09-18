# Phase 3 — Logging surfaces

**Chapters 10–13** · Week 3 · **Prerequisite:** Phase 2 complete and committed.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/03-logging-surfaces.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


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
