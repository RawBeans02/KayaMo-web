# Daily OS data model

Offline-first. Client UUID primary keys. `updated_at` last-write-wins.
RLS: user reads/writes only their rows. Store UTC; render in the user timezone
and custom day boundary.

Mus proposes. Confirmed writes set `origin = coco_confirmed` (or equivalent).
Planned clock times never overwrite what actually happened.

## Entity split (non-negotiable)

| Kind | Clock | Example |
|---|---|---|
| TASK | optional | Finish Chapter 3 — due Friday, ~90 min |
| EVENT | required start/end | Doctor 3–4 PM |
| ROUTINE | preferred window | Gym Tuesday afternoon |
| HABIT | not a todo | Vitamins, prayer |
| PROJECT | container | Teacher training |
| INBOX | unclassified | “Printer” |

Do not collapse these into one checklist row.

## Three schedule buckets

FIXED · FLEXIBLE TODAY · ANYTIME

Plus PROTECTED time the planner must not fill.

## SHIPPED tables

### tasks
`id user_id title notes scheduled_for due_at completed_at sort_order origin`
timestamps + `deleted_at` + `server_seq`

Missing for the Daily OS: duration, flexibility, energy, location, project,
dependencies, start_after, locked.

### routines / routine_completions
Day-of-week array + optional preferred_time. Not a full recurrence engine.

### inbox_items
Capture. Process later into a task/event/habit/idea.

### daily_plans
One row per user per logical date. `capacity` `day_intent` `plan_mode`
(`standard` `minimum` `rescue` `restructure`). Morning/evening check-in stamps.
This is **not** the timetable.

### focus_sessions
Optional `task_id`. Actual duration lives here when Focus Mode ships on desktop.

### busy_blocks
Dexie-only committed hours. Promote to `events` or `time_blocks` when calendar
sync exists.

### goals / habits
Journey tables. Habits are not tasks.

## PLANNED tables

### events
Fixed calendar occupancy.

- `start_at` `end_at` (timestamptz)
- `title` `location_id` `flexibility` default FIXED
- `source` (user, imported, coco_confirmed)

### time_blocks
Day timeline rows (planned occupancy). Separate `actual_start_at` /
`actual_end_at` when the user runs the block. Never overwrite planned with
performed.

- `logical_date`
- `kind` (item_kinds)
- `source_table` `source_id`
- `planned_start` `planned_end` (time without tz, local to the day)
- `flexibility`
- `locked`
- `travel_before_min` `prep_min` `recovery_min`

### daily_plan_items
Snapshot of a proposal the user accepted or rejected.

- `daily_plan_id`
- `time_block_id` nullable
- `decision` proposed | accepted | edited | rejected
- `rationale` (why this slot — shown in the inspector)

### task_constraints
Earliest, latest finish, preferred window, before/after event, weather flag.

### task_dependencies
`task_id` `blocks_task_id`. Planner must not schedule the dependent first.

### projects / project_tasks
Container. Completing a project is not a single checkbox unless the user said so.

### task_recurrence
Richer than routines: after-completion interval, first working day, exceptions.

### travel_blocks
Protected transitions. May be auto-suggested, never silent-written.

### user_locations
Named places (HOME SCHOOL WORK GYM MALL). Manual “I’m at school” is v1.
Geofence is later.

### energy_logs
“I’m tired” snapshots for Replan. Not clinical.

### schedule_changes
Audit: from/to times, who initiated (user | mus), approval id.

### ai_planning_sessions
Prompt context hash, model, Zod-parsed proposal JSON, user decision.
No health payloads in logs.

## DEFERRED

- `weather_context` fetch
- `notifications` queue (copy patterns are specified)
- attachments / people graph
- two-way Google/Outlook calendar
- geofencing

## Planner context object (what Mus receives)

Not raw tables. A compiled JSON for the logical date:

- `logical_date` `now` `time_zone` `day_starts_at`
- `capacity` `day_intent` `plan_mode`
- `permissions` (per module read / suggest / write)
- `fixed_events` `protected_windows`
- `flexible_tasks` `anytime_tasks` `overdue_count` (count + top N, not the dump)
- `open_windows` (start, end, minutes)
- `routines_due`
- optional summaries: gym planned duration + historical average; nutrition
  remaining (opt-in); weather (when shipped)
- `user_state.energy` if logged today

## Writes

Every planner output uses Zod (`packages/features/src/todo/planner-schema.ts`).
User confirmation creates/updates rows. AI auto-write is always off in
`csv/permissions.csv`.
