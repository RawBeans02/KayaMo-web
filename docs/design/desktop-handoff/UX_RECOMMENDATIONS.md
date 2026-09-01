# UX recommendations — KayaMo desktop

Found while reviewing the prototype end to end. Ordered by impact. Items marked
**prototype gap** are things the mock fakes or leaves inert; items marked **design change**
are proposals that alter intended behavior and should be agreed before building.

---

## 1 · One assistant, one vocabulary — design change

There are currently two Muses. The `/mus` screen has its own thread, its own proposal card
and a context panel that says `on / ask first / off`; the rail has a different thread, a
different proposal card and a five-level permission model
(`read → suggest → edit w/ approval → edit → never`). A user has to learn both.

Fix: the Mus screen should render the *same* rail component in its right column (or the same
thread component at full width), and one permission vocabulary should win — the five-level
one, because it is the only one that expresses "may suggest but not write".

## 2 · The proposal card is the product's contract — make it global

Risk tier → confirm gate → `touches` → undo is the best idea in the design, and it currently
only exists in the rail. Any write initiated anywhere should render it: batch-verifying rows,
placing a todo, changing a target from Goals, merging a food. Build it as one component in
`packages/ui` with `risk: 'low' | 'medium' | 'high'`, and route every mutation through it.

## 3 · Undo is scoped three different ways — design change

Today's rows delete instantly with no undo; gym sets have a per-row Undo; the rail has a
one-shot undo strip. Users cannot predict which action is recoverable.

Fix: one global undo (`⌘Z`) with a `Toast` (the component exists) for every mutation, and a
single "what changed today" log — the rail's `What Mus did today` extended to include the
user's own actions, not just Mus's.

## 4 · Verify: the inspector does not compute — prototype gap

The macro inputs are inert and the Atwater panel is derived from seed data, so the screen
cannot do the one job it exists for. It needs: live recompute of `4P + 4C + 9F` and drift %
as you type, a dirty state, and `⌘S` to commit. Then three things that make 40 rows
finishable:

- **Next unverified** jump (`Enter` already advances; add `]` / `[` to skip)
- **Skip / flag for later** so a row you cannot judge does not block the queue
- Clickable progress cells to jump to any dish
- Batch verify for rows with 0% drift and confidence ≥ 0.9, presented as one medium-risk
  proposal rather than 12 clicks

## 5 · Foods is read-only, but Mus proposes edits to it — prototype gap

The rail proposes "fold *sinaing* into Kanin as an alias". There is no manual path to do the
same thing: no row click, no create, no alias editor, no merge. If the assistant can do it,
the human must be able to do it too — otherwise the user cannot verify or reverse the merge.
Add a row inspector reusing Verify's panel, plus Create / Merge / Add alias.

## 6 · Todos: placement is the whole screen and it is faked — prototype gap

`Place` always drops the task at 15:30, and the timetable has no drag. Real behavior:

- **Drag a task onto the timetable**, snapping to 15 minutes, with fixed blocks refusing
  the drop
- Place picks the *first fitting free slot* honoring the task's estimate and energy tag
- Proposed (dashed) blocks get Accept / Dismiss **on the block**, not only in the rail
- The capacity line becomes live arithmetic — `4h 10m placed against 3h 00m free` recomputed
  as blocks move — instead of one sentence per planner button
- Energy currently changes nothing; it should reorder or dim tasks whose energy does not
  match the selection

## 7 · Gym: rest should survive leaving the screen — design change

The timer only ticks while the Gym screen is open, so switching to Todos mid-set silently
pauses rest. Move the session clock into app state, keep it running everywhere, and surface
it in the status band (the component already exists) with the remaining time and a skip.

Also on Gym:
- Every unfinished set row is editable at once. Focus the *next* set instead, collapse the
  others to one line, and auto-advance on Complete.
- `Add a set` and `Lock target` are inert.
- Station swaps only appear inside an expanded lift. When a busy chip affects several lifts,
  offer one session-level proposal: *"Two lifts need the cable station — swap both?"*

## 8 · Keyboard coverage is uneven — design change

The palette and Verify are fully keyboard-driven; Gym and Todos are mouse-only. Extend the
existing grammar rather than inventing one: `j/k` to move in any list, `Enter` to act,
`Tab` between kg / reps / RIR with `Enter` completing a set, `1–3` for Todos views,
`⌘\` to collapse the rail. Publish the map in a `?` overlay.

## 9 · Missing system states — prototype gap

Only the palette has a designed empty state. Still needed: first-run (no entries, no verified
rows, no session), offline — `synced · 2 min ago` implies a sync path with no failure state —
Mus unavailable or slow, and a day with zero logged food (which should not read as failure).
`EmptyState` exists in `packages/ui`; give each one real copy in the product's voice.

## 10 · Accessibility and touch craft

- **Contrast**: `--color-muted-2` (`#6e5f4c`) on sunken at 8.5–9.5px mono fails WCAG AA for
  small text. Set a floor of 10.5px for mono labels and darken the token, or reserve the
  smallest sizes for non-essential text only.
- **Hit targets**: several controls are 24–28px tall (row delete ×, rail chips, gym set
  buttons). 32px minimum on desktop; 44px if any of this is reused on touch.
- **Focus**: tables express selection with background and an inset bar, but keyboard focus
  has only the global outline. Give rows an explicit focus ring distinct from selection.
- **Live regions**: rest countdown, palette status and proposal application should announce;
  only the rail thread has `aria-live` today.
- **Numbers**: Barlow Condensed at 8.5–9px in some meta lines is too tight for glanceable
  data — the design's own rule is numbers get Barlow at 15px and up.

## 11 · Smaller things

- Week-strip days in Today are `<button>`s with no handler — either navigate to that day or
  make them non-interactive.
- The provenance card duplicates the row badges; turning it into a filter
  ("show only estimated") would earn its space.
- The rail can collapse itself but the shell still reserves 316px. The shell should own the
  width and animate it.
- `Copy last workout`, `Split in two`, `Brain dump`, `New conversation` are labels without
  behavior — either wire them or cut them from the first build.
- Phone-first items (Goals, Life, Grove) are disabled in the sidebar with no explanation of
  when they arrive; a tooltip or a short line would prevent the "is it broken?" read.
