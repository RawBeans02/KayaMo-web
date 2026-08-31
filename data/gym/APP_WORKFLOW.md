# App Workflow & Live Workout Session Specification

## Product principle

The app is **manual-first and AI-assisted**.

The user can always choose exercises, order, sets, reps, weights, rest times, repeats, and substitutions. AI does not replace this control. It fills gaps, suggests options, and adapts only unfinished work.

## End-to-end flow

### A. Gym/setup first
A user can save multiple equipment profiles:
- Main gym
- Home gym
- Hotel/travel gym
- Bodyweight-only
- Custom temporary setup

When building a workout, the app asks which setup is being used and loads its available equipment. The user can make temporary changes such as "cable machine unavailable today."

### B. Build a workout frame
The workout can start from:
- blank session
- saved workout template
- recurring program day
- copied prior workout
- AI-generated starting frame

The user may manually add the exercises they definitely want. These items can be **locked** so AI cannot remove or replace them.

The same muscle group can have several exercises. The exact same exercise may also intentionally appear more than once; each appearance is a separate `plan_item_id`.

### C. AI Fill
AI Fill means:

1. Keep locked/manual items.
2. Read goal, workout type, target muscles, time, experience, readiness, equipment, exclusions, and history.
3. Apply hard rules.
4. Retrieve only eligible exercises from SQLite.
5. Identify gaps in the user's workout frame.
6. Add only what is missing.
7. Warn about likely redundancy, but allow intentional repeated work.

AI should never silently rebuild the entire workout unless the user explicitly asks.

### D. Prescription editing
Before starting, every exercise instance can have:
- number of sets
- set type: warm-up / working / back-off / drop / other
- target rep range
- target load
- RIR/RPE
- duration/distance where applicable
- tempo
- rest time
- notes

Planned values and performed values must be stored separately.

### E. Start workout
When the user taps **Start Workout**:
- create a `workout_session`
- snapshot the current plan into session items
- start session elapsed time
- display exercises as an editable to-do queue

The list is **not a forced sequence**. A user can drag/reorder at any time or tap any unfinished exercise.

### F. Perform and log sets
Each exercise expands into its sets.

For each set, show:
- planned reps/load
- previous workout performance if available
- editable actual reps
- editable actual weight
- optional RIR/RPE
- completion checkbox
- notes

Checking a set complete immediately saves the performance.

### G. Automatic rest timer
A rest timer starts after a set is checked complete **only when that set has a configured rest time**.

The user can:
- skip rest
- add/subtract time
- restart it
- dismiss it
- continue with another exercise while it runs

When the timer reaches zero, send an in-app notification/ping. Do not automatically mark another set complete.

The often-used 2–3 minute rest range should be represented as a configurable user/program default, not a universal hard-coded rule.

### H. Live workout changes
During a workout the user can:
- reorder remaining exercises
- edit future set targets
- add an exercise
- remove an unfinished exercise
- add a set
- remove a future set
- skip
- substitute because equipment is busy/unavailable
- ask AI to shorten/extend the remaining session

Never delete already completed work when the plan changes. Use a session-event audit trail.

### I. Finish and history
On finish:
- preserve completed sets
- preserve partial/skipped work
- preserve substitutions
- preserve exercises added live
- calculate workout duration and basic totals
- update exercise history

Next time the app can show:
- last load/reps
- previous set-by-set performance
- recent trend
- last substitution
- frequently used equipment
- saved rest settings

## Recurring workouts and programs

A workout plan can be:
- one-time
- reusable template
- repeated every week
- part of a multi-day split
- copied from a previous session
- scheduled using a recurrence rule

The app should permit multiple planned workouts targeting the same muscle across a cycle. It should **warn**, not automatically forbid, when programming rules think overlap/recovery is unusual.

## State model

Workout: `DRAFT → READY → ACTIVE ↔ RESTING / PAUSED → COMPLETED`

Exercise/session item:
`QUEUED → IN_PROGRESS → RESTING → COMPLETED`
with alternatives `PARTIAL`, `SKIPPED`, `SUBSTITUTED`, `ADDED_LIVE`.

## Data rule that matters most

Never overwrite the plan with the performance.

Example:

Planned:
`80 kg × 8`

Performed:
`80 kg × 6`

Both values must remain available forever.

That is what lets the app compare intention against reality and make useful future recommendations.
