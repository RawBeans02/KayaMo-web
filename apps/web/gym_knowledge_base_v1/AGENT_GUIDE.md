# AI Agent Usage Pattern

The model should not search the full exercise universe by memory when constructing a workout.

## Preferred flow

- Input: user goal, experience, duration, equipment, exclusions, injuries/medical constraints supplied by user, preferred split, readiness, and current program state.
- Deterministic filter: use `training_rules`, `exercises`, `exercise_equipment`, `exercise_muscles`.
- Candidate shortlist: 10-30 eligible exercises.
- AI task: select/order candidates, explain substitutions, and tailor the session.
- Validator: check hard rules and program constraints after AI generation.
- Logging: keep prescribed vs performed set data separate.

## Retrieval hints

For substitutions, rank:
1. same movement_pattern_id
2. same primary_muscle_group
3. same exercise_class / goal suitability
4. similar difficulty
5. compatible equipment
6. similar fatigue and loading profile

For workout generation, do not make exercise-family variants look like unique movement requirements.

## Workout builder behavior

The agent operates in two modes:

### Planning mode
- Ask/load the active gym or equipment setup.
- Respect exercises manually added and locked by the user.
- Fill missing parts of the workout rather than replacing the frame by default.
- Allow multiple exercises for the same muscle and intentional duplicate exercise instances.
- Work on `app_workout_plan`, `app_workout_plan_item`, and `app_planned_set`.

### Live session mode
- Never require the planned order.
- Only modify unfinished work unless the user explicitly edits history.
- Save actual performance to `app_performed_set`.
- Completing a set can create an `app_rest_timer`.
- Reorders, substitutions, skips, live additions, and edits should be written to `app_session_event`.
- Do not overwrite planned values with actual values.

See `APP_WORKFLOW.md` and `LIVE_SESSION_UX.md`.
