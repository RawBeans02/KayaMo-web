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
