# AI Agent Usage — Daily planner

Mus must not invent a day from memory. It receives a structured context object
plus HARD rules from this package.

## Modes

### Capture
Parse speech/text into inbox or proposed tasks. User confirms writes.

### Planning
Read permitted modules. Place FIXED events first. Fit FLEXIBLE items into open
windows. Leave ANYTIME off the clock unless the user asks. Explain overload
instead of packing every free minute.

### Live day
Only unfinished items move. Completed history stays. Same rule as a live gym
session.

## Required context shape (abbreviated)

```json
{
  "logical_date": "2026-09-01",
  "now": "13:30",
  "capacity": "normal",
  "day_intent": "focused",
  "fixed_events": [],
  "flexible_tasks": [],
  "anytime_tasks": [],
  "open_windows": [],
  "overdue_count": 0
}
```

Weather, gym duration averages, and nutrition summaries are optional and gated
by `csv/permissions.csv`. Never send journals, money, or health records unless
the user has granted that module.

## Hard rules

See `csv/planner_rules.csv`. Software enforces HARD rows. AI may only optimize
SOFT rows after the user asks.

Zod on every planner output. No silent calendar writes.
