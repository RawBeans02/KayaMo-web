# Gym Knowledge Base v1

Created: 2026-09-01

## What is included

- 302 canonical exercise records
- 15 training categories
- 21 goals
- 50 training styles/disciplines
- 77 training methods
- 36 workout formats
- 51 workout/session types
- 19 split templates
- 27 progression methods
- 20 periodization methods/phases
- 48 movement patterns
- 67 equipment records
- 68 muscle/muscle-group records
- 15 deterministic planning rules

## Recommended architecture

1. **CSV files are the editable source of truth.**
   - Easy for humans to review in Excel/Google Sheets.
   - Version-control friendly.
   - Never make the AI itself the only database.

2. **SQLite is the deterministic query layer.**
   - Filter by equipment, goal suitability, movement pattern, difficulty, AI eligibility, etc.
   - The planner should query this first and only give the model eligible candidates.

3. **JSONL is the AI/RAG layer.**
   - `gym_kb_agent.jsonl` contains one self-contained record per line.
   - Exercise rows are denormalized with aliases, muscles, and equipment for easier retrieval.

## Agent planning order

Recommended:
1. Resolve user constraints.
2. Apply HARD rules from `training_rules`.
3. Query SQLite for eligible exercises.
4. Rank by goal suitability, movement-pattern coverage, equipment, difficulty, fatigue, and user preferences.
5. Give the AI only the shortlist plus workout-format/program context.
6. Validate the proposed workout again using deterministic rules.
7. Store prescription separately from performance logs.

## Important data-quality note

The exercise list and metadata are a broad curated **v1 seed**, not a claim that every exercise variation ever created is included.
Exercise variants are effectively unbounded. Use `exercise_family` + normalized variation fields rather than creating uncontrolled duplicate names.

Fields such as suitability scores, skill demand, fatigue cost, and loading potential are **heuristic software-ranking metadata** and should be domain-reviewed before being treated as production-grade coaching rules.

Advanced power/plyometric exercises are flagged for more conservative AI selection.

## Sources

See `csv/sources.csv`.
The taxonomy was cross-checked against:
- ACSM 2026 components of fitness
- ACSM 2026 resistance-training update
- ACE Exercise Library classification dimensions
- wger routine/API data model
- Free Exercise DB schema

No source instructional text or copyrighted exercise imagery is included in this package.

## App workflow layer

v1 now also includes the application/session behavior requested for a manual-first, AI-assisted gym app:

- `APP_WORKFLOW.md`
- `LIVE_SESSION_UX.md`
- `csv/app_workflow.csv`
- `csv/app_session_states.csv`
- `csv/app_item_states.csv`
- `csv/app_builder_actions.csv`
- `csv/app_rest_timer_rules.csv`
- `csv/app_ai_session_rules.csv`
- `csv/app_data_model.csv`

The SQLite file contains empty runtime schema tables prefixed with `app_` for gym equipment profiles, workout plans, planned sets, live sessions, performed sets, rest timers, recurring schedules, history, and session events.
