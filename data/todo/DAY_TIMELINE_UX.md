# Day timeline UX

Desktop (keyboard-first). Mobile later uses a bottom sheet inspector.

## Three buckets (not every task on a clock)

- **FIXED** — exact start/end. AI cannot move unless the user asks.
- **FLEXIBLE TODAY** — should happen today; time may move.
- **ANYTIME** — no schedule required.

## Timeline

Day / Week / Agenda. Blocks are draggable and resizable on desktop.

Moving a block recalculates conflicts, travel, meals, and open time. Mus
**asks** before moving dependents or dinner.

Click a block → **Schedule Inspector** (duration, flexibility, location,
energy, Ask Mus, Start, Delete).

## Flexibility on each block

- `FIXED` — no automatic move
- `FLEXIBLE` — Mus may suggest another time
- `AUTO` — Mus may move within earliest/latest window after approval of the plan

## Protected time

Sleep, family, commute, and "do not schedule after 8 PM" are first-class.
Usable capacity is less than raw free minutes.

## Live day

Incomplete items can be skipped, shortened, or moved. Completed work is never
deleted to make the afternoon fit.
