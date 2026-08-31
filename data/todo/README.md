# Daily OS / To-Do Source of Truth v1

Created: 2026-09-01

KayaMo is a Personal Growth OS. The desktop **Todos** desk is a review surface.
PWA navigation stays five tabs: Home, Goals, Life, Grove, Mus. Daily planning
belongs on **Home**. This package is the structured brain for that surface.

## Principle

**Manual-first, AI-assisted, context-aware, always editable.**

Mus proposes a day. The user approves, edits, or ignores. Planned values stay
separate from what actually happened.

Same interaction pattern as Gym:

```
USER BUILDS FRAME
        ↓
LOCK IMPORTANT PARTS
        ↓
AI FILLS GAPS
        ↓
USER APPROVES
        ↓
START / EXECUTE
        ↓
LIVE CHANGES ALLOWED
        ↓
ACTUAL RESULT RECORDED
        ↓
AI USES HISTORY NEXT TIME
```

## What this package is

Taxonomies, workflow, AI rules, dashboard modules, permissions, and the target
data model. It is **not** a dump of the user's tasks.

CSV files in `csv/` are the editable master. Docs beside them:

- `AGENT_GUIDE.md` — what Mus may receive and must not invent
- `APP_WORKFLOW.md` — capture → frame → propose → approve → live day
- `DAY_TIMELINE_UX.md` — drag/resize/inspector; FIXED / FLEXIBLE / ANYTIME
- `DATA_MODEL.md` — shipped tables vs planned timetable schema
- `COMMANDS.md` — Plan My Day, Replan, What now, Brain dump

```bash
pnpm todo:kb:build   # compile taxonomies for the client
pnpm todo:kb:check   # fail if compiled.json drifted
```

Compiled output: `packages/features/src/todo/kb/compiled.json`.
Planner LLM contracts (unused until the planner ships):
`packages/features/src/todo/planner-schema.ts`.

Shared Mus (one assistant, many entry points): `data/mus/`.
Do not overwrite the current system prompt.

## Shipped vs planned

See `csv/data_model.csv`.

**Shipped today:** `tasks` (title, notes, date, due, origin), `routines`,
`inbox_items`, `daily_plans` (capacity / day intent / plan mode),
`focus_sessions`, local `busy_blocks`, goals/habits. Todos desk is a checklist.

**Not shipped:** calendar events vs tasks, time blocks, flexibility, travel,
weather, dependencies, projects-as-containers, Plan My Day, drag timetable.

## Do not

- Add a sixth primary PWA tab.
- Let AI silently reschedule FIXED or PROTECTED blocks.
- Force every task onto a clock time (FIXED / FLEXIBLE TODAY / ANYTIME).
- Dump every overdue item onto Today after time away.
- Change calorie floors or nutrition numbers from this planner.
- Diagnose from energy/mood flags.
- Use banned copy (cheat, guilty, earned, burn it off, bad food, sinful).
