# Live Session UX Notes

## Main live screen

Recommended hierarchy:

1. Session header
   - workout name
   - elapsed time
   - finish/pause
   - active rest timer

2. Next-up / queue
   - draggable exercise cards
   - status badge
   - sets completed / total
   - quick substitute
   - quick skip

3. Exercise card
   - exercise name
   - planned prescription
   - last-session reference
   - set rows

4. Set row
   - set number/type
   - planned reps
   - actual reps
   - planned/actual load
   - RIR/RPE
   - check button

5. Rest timer overlay
   - remaining time
   - +30 sec
   - -30 sec
   - skip
   - choose next exercise

## Useful additions beyond the original concept

- **Lock exercise:** AI cannot change a favorite/must-do exercise.
- **Temporary equipment state:** mark a machine "busy today" without editing the permanent gym profile.
- **Previous-set autofill:** initialize actual load from the previous set or previous session, but require confirmation.
- **Warm-up sets:** distinguish warm-ups from working sets so volume analytics are cleaner.
- **PR/event markers:** flag rep/load bests without turning the app into a competition.
- **Partial completion:** do not force whole-exercise completion when only some sets were performed.
- **Undo last action:** especially useful after accidentally checking a set.
- **Rest timer history:** record actual rest optionally, useful later for density/conditioning analysis.
- **Session notes:** whole-workout and per-exercise notes.
- **Pain/discomfort flag:** record a neutral flag and offer substitution; do not diagnose.
- **Offline-first session logging:** active workout must keep working if network/AI is unavailable.
- **AI fallback:** the core workout, logging, queue, and timer must not depend on the AI being online.
- **Resume interrupted session:** restore unfinished workout after app close/crash.
- **Copy last workout:** fastest manual workflow for regular gym users.
- **Favorite exercise + avoid exercise:** user preference layer independent from safety/exclusion rules.
- **Workout version history:** saved template edits should not rewrite old sessions.
