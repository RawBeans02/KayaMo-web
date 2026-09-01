# Handoff: KayaMo Desktop (Today · Verify · Foods · Mus · Gym · Todos)

## Overview

The desktop shell for KayaMo: a Manila-based calorie, training and planning app whose
defining idea is **provenance and consent** — every number shows where it came from, and
the assistant (Mus) proposes changes it is never allowed to write by itself.

This bundle covers six screens inside one persistent shell, plus two shared surfaces:
a command palette for food logging and a Mus assistant rail that follows the active screen.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes of intended
look and behavior, not production code to lift. The task is to **recreate them in the existing
`kayamo-web` codebase** (Next.js App Router + pnpm workspace + Tailwind v4 semantic tokens),
using its established patterns:

- The design's **Today** screen is the meal-slot food log. In this repo that table is
  `/calories` (`TodayTable`). `/today` is the dashboard (`DeskHome`). Tranche 4 should
  put the designed Today on `/today` rather than restyling the dashboard and calling it done.
- Routes already exist: `src/app/(shell)/{today,verify,foods,mus,gym,todos}/page.tsx`
- Shell chrome: `src/app/(shell)/layout.tsx`, `packages/features/src/app-shell/`
- Desktop screens: `packages/features/src/desk/` (`desk-home.tsx`, `gym-desk.tsx`,
  `gym-picker.tsx`, `gym-rest.tsx`, `todos-desk.tsx`, `todos-timeline.tsx`,
  `todos-inspector.tsx`, `desk-mus.tsx`, `mus-desk.tsx`, `use-desk-clock.ts`)
- Primitives: `packages/ui/src/components/` (`Button`, `Card`, `EmptyState`,
  `NumberDisplay`, `Sheet`, `Toast`, `TrendRibbon`), tokens in `packages/ui/src/tokens.css`

Do not port the HTML's inline styles. Map them to tokens (table below) and to the existing
components. The prototype uses hard-coded seed data; wire the real data layer
(`packages/db`, `packages/food`, `packages/core`, `/api/mus/*`) in its place.

## Fidelity

**High fidelity.** Colors, type, spacing, copy and interaction states are final and should be
matched. Two deliberate exceptions:

1. The shell is a fixed `1440 × 900` canvas so it can be previewed. In the app it must be
   fluid: sidebar `216px`, rail `316px`, center column flexes, minimum comfortable width
   `1280px`.
2. Placeholder imagery (`mus-*.png`, `coco-seed.png`) is stand-in art, and the two
   unfinished Mus states are explicitly drawn as slots (`mus-happy.png needed`,
   `mus-sad.png needed`).

## ⚠️ Palette conflict — decide before building

The design and the codebase currently disagree on the entire color system:

| | design (this bundle) | `packages/ui/src/tokens.css` today |
|---|---|---|
| background | `#f7f2e7` warm cream | `#f4f8ff` cool blue-white |
| surface | `#fffbf4` | `#ffffff` |
| accent / action | `#1f4d3a` evergreen | `#1463ff` blue |
| text | `#17211b` | `#10233f` |
| dark theme | `#101a16` ground, `#d4a72c` mustard accent | `#2a1b3d` purple, `#c4e538` lime |

Pick one before writing code:

- **A — adopt the design palette (recommended):** change the values in `tokens.css` only.
  Every token *name* below already exists, so no component churn.
- **B — keep the blue tokens:** the design is re-skinned; provenance colors (mustard, attn
  orange, sage) still need new tokens because nothing equivalent exists.

## Design tokens

Design value → semantic name → existing token in `tokens.css`.

| Design | Role | Token |
|---|---|---|
| `#f7f2e7` / dark `#101a16` | page background | `--color-bg` |
| `#fffbf4` / `#17251e` | card, sidebar, rail | `--color-surface` |
| `#efe8d8` / `#203129` | sunken (table heads, chips, tray) | `--color-surface-2` |
| `#17211b` / `#f7f2e7` | primary text | `--color-text` |
| `#5a4433` / `#a7bfa8` | secondary text | `--color-muted` |
| `#6e5f4c` / `#8fa590` | tertiary text, mono labels | **new** `--color-muted-2` |
| `#1f4d3a1f` | hairline | `--color-line` |
| `#1f4d3a33` | strong line, input border | **new** `--color-line-strong` |
| `#1f4d3a` / `#d4a72c` | action, verified, primary button | `--color-accent` |
| `#fffbf4` / `#101a16` | on-action text | `--color-accent-fg` |
| `#b5652f` / `#d98a4f` | attention: drift, overdue, now-line, high risk | `--color-warning` |
| `#d4a72c` | mustard: proposals, unsaved | **new** `--color-proposal` |
| `#a7bfa8` | sage: USDA source | **new** `--color-source-usda` |
| `#5a4433` | bark: user-created source | **new** `--color-source-user` |
| `#17211bb0` | palette overlay | `--color-overlay` |

Tinted fills are `color-mix(in srgb, <token> N%, transparent)` — 4–7% for row/section
washes, 8–14% for active chips and proposal cards, 25–45% for their borders.

### Type

Four families, already declared as `--font-body`, `--font-numeral`, `--font-data`; add serif.

| Family | Use |
|---|---|
| **Source Serif 4** 600 | screen titles (30px, `-0.022em`), card titles (18–21px), meal group labels (15.5px) — **new** `--font-display` |
| **Source Sans 3** 400/500/600 | all body, labels, buttons, inputs. Base 15px/1.45 |
| **Barlow Condensed** 600 | every number: 76px hero, 48px verify count, 30px stat, 27px week cell, 16–23px table numerals. Always `font-variant-numeric: tabular-nums`, tracking `-0.02em` to `-0.035em` |
| **IBM Plex Mono** 400/500 | eyebrows, column heads, timestamps, kbd, provenance badges, aliases. 8.5–11px, `letter-spacing: 0.08–0.15em`, uppercase |

### Geometry

Radius `3px` badge · `5–7px` control · `8px` inner card · `10px` card · `12px` palette ·
`999px` pill. Border `1px` everywhere; proposals use `1px dashed`.
Spacing: screen gutter `32px`, card padding `15–24px`, table row `7–9px × 14–16px`,
section gap `16px`. Control heights `26 / 28 / 30 / 34 / 38 / 40px`.
One shadow only: `0 28px 72px #0000002e` on the command palette. Selection is expressed as
`inset 2–3px 0 0 var(--color-accent)`, not shadow.

## Shell

`grid-template-columns: 216px minmax(0,1fr) 316px` · `grid-template-rows: minmax(0,1fr)`.
The row track is required — without it the implicit row grows to max-content and the
sidebar footer and rail composer fall outside the viewport. `main` and the rail mount both
need `min-height: 0` so they scroll internally instead of stretching.

**Sidebar** (`216px`, 4 rows: brand / nav / phone-first / footer):
Mus avatar 38px with an 11px mustard presence dot · wordmark Source Serif 20px ·
`Manila · desk` mono eyebrow. Nav rows are 18px glyph + label + count, `6px` radius,
active = sunken background + 600 weight. Below it, a disabled *Phone-first for now* list
(Goals, Life, Grove) with an `on phone` mono tag — these are real routes that intentionally
have no desktop layout yet. Footer: **Log food ⌘K** button, sync dot + `synced · 2 min ago`,
account line and a theme toggle.

**Rail** (`316px`) is the same Mus everywhere — see *Mus rail* below. It is hidden on the
Mus screen, which has its own three-column layout.

## Screens

### 1 · Today (design table → `/calories` until tranche 4; `/today` is the dashboard)
Reading the week, not the day. Header `Diary · week 36` + *Tuesday, 1 September*, with a
day-boundary note (00:00 Asia/Manila — totals follow the user's boundary, not midnight).

- **Week strip** — 7 equal cells: weekday mono, day number, kcal in Barlow 27px, a 4px
  progress bar against target, and a note (`logged` / `today, so far` / `not yet`).
- **Headline** — `1.55fr / 1fr` split. Left: week average at 76px with `kcal / day`, signed
  delta, an 8px bar and a 2px target tick. Right: three stats (Protein, Sessions,
  Verify queue).
- **Entry table** — columns `60 / 1fr / 88 / 72 / 108 / 34`, grouped by meal
  (Almusal, Tanghalian, Meryenda, Hapunan) with per-group count and kcal. Each row: time,
  name + serving, editable qty input (commit on blur/Enter), kcal, source badge +
  provenance mark, delete. Empty groups show a dashed `Nothing yet — ⌘K to add`.
  Footer row: `Today · secondary to the week` + total.
- **Provenance card** and **4-week presence grid** (28 cells; copy: coming back after four
  quiet days counts).

### 2 · Verify (`/verify`)
Curating the 40 hand-built PH-core dishes. Rows are estimates until a human passes them.

- Progress block: `31 of 40 verified` at 48px, a lede that rewrites itself at 0 / mid / 31,
  4/4/9 drift count, mean confidence, and a demo toggle. Below, 40 cells, one per dish.
- Table `24 / 1fr / 104 / 80 / 46 / 54`: mark, dish + Taglish aliases, P/C/F, kcal per 100 g,
  confidence, and an `off >5%` flag when Atwater drift exceeds 5%.
- Inspector `288px`: four macro inputs, an Atwater reconciliation panel that turns
  attention-orange when the macros do not add up, default serving, and the **source note** —
  the sentence explaining exactly how the number was derived. Primary action
  `Mark verified` + `⌘S`.
- Keyboard: `j`/`k` move, `Enter`/`v` verify and advance, `⌘S` save.

### 3 · Foods (`/foods`)
Read-only catalog of 47 rows across five sources. A stacked bar shows the shape of the
database (PH core, Brand, USDA, Yours, Photo) with counts, a filter row of pills, a search
by name or Taglish alias, and a table `24 / 1fr / 200 / 116 / 148 / 66`. Photo-sourced rows
show a kcal *range*, never a point value. Copy states the rule: logging happens in the
palette, not here.

### 4 · Mus (`/mus`)
Three columns `236 / 1fr / 316`: conversation list, thread, and a context panel listing what
Mus can see (`on` / `ask first` / `off`) plus the four Mus emotional states and the rule for
each — *happy* only for a milestone the user chose, *sad* only for wellbeing, never for a
missed log. The thread contains an inline proposal card with Confirm / Dismiss and the line
`Nothing is saved until you confirm.`

### 5 · Gym (`/gym`, `gym-desk.tsx` + `gym-picker.tsx` + `gym-rest.tsx`)
A live Push A session.

- **Session bar**: pause/resume, elapsed clock (ticks each second while running), a note
  counting logged sets, and `Copy last workout`.
- **Rest bar** (appears when a rest is running): label naming the set it followed, `m:ss`
  that turns attention-orange under 15s, a progress track, `−30s` / `+30s` / `Skip rest`.
- **Busy today** chips (Cable station, Flat bench 2, Dumbbells over 30 kg, Smith machine).
  Marking a station busy flags unfinished lifts that need it and offers same-pattern swaps.
- **Lift table** `26 / 1fr / 68 / 100 / 88 / 24`: state mark, name + lock diamond + source
  tag, sets `done/total`, planned, last time, chevron. Expanding a lift reveals set rows
  `50 / 104 / 1fr / 88 / 116`: planned, kg × reps × RIR inputs, last time, Complete.
  Completing a set writes it, starts that lift's rest timer, and offers Undo.
  Completed lifts (Bench, Incline DB) arrive locked — the rail must never move them.
- **Add from catalog** strip appends a lift mid-session.

### 6 · Todos (`/todos`, `todos-desk.tsx` + `todos-timeline.tsx` + `todos-inspector.tsx`)
Day / Week / Agenda.

- Planner actions (Plan my day, Replan from now, What can I do now?, Brain dump) and an
  energy selector (low / steady / high). The capacity line under them is the screen's
  argument: work placed vs hours actually free.
- **Day**: `312px` timetable + working column. Timetable runs 07:00–21:00 at 44px/hour with
  a now-line at 15:12. Blocks are styled by kind — *fixed* (sunken, ◆), *done* (accent wash,
  ✓), *planned* (surface), *proposed* (mustard wash, **dashed** border, `from Mus`, not
  saved). A legend spells this out.
- Working column: capture field + Add + Brain dump, then buckets (Placed today, Unplaced,
  Later this week) with round check toggles, tag pills (`due` in attention-orange), and a
  Place/Move action; then an inspector with When / Estimate / Energy / Due / Source /
  Blocked by and its actions.
- **Week**: 7 columns of chips accented by kind, today tinted. **Agenda**: Overdue / Today /
  Later grouped rows.

### Command palette (⌘K, global)
`776px`, opens 132px from the top over a `#17211bb0` overlay. Meal-slot segmented control
(⌥1–4), 20px query input, and four states: *ready* (suggestions with frequency), *searching*
(pulsing skeletons, 260ms), *results*, *no match*. The no-match state is a designed screen,
not an error: create it in PH core, search brands and USDA, or ask Mus — with the reason
brands stay out of the palette stated in copy. A **plate tray** keeps the palette open
across several items and totals them; `↑↓ / Enter / Tab / ⌥1–4 / Esc` are shown at all times.

Logging here is the user's own write. It goes through the existing offline path and a
Toast with undo. It does **not** render a proposal card. That card is for Mus-proposed
mutations (target changes, alias merges, batch verify). A Confirm on every plate of rice
would miss the two-second target.

### Mus rail (shared, `316px`)
One assistant, context follows the screen.

- Header: avatar, `state · neutral|thinking`, collapse.
- **Context block**: current screen, the current selection (`row 5 · Sinigang na baboy`,
  `Cable Fly · unfinished`, the selected task), and an expandable permission list. Five
  modules cycle through `read → suggest → edit w/ approval → edit → never`. Copy:
  *Mus reads only what is on. Nothing at suggest or below is ever written without you.*
- **Thread**, then the **proposal card** — the most important pattern in the product:
  - risk tier drives the whole card: `low` (applies with undo), `medium` (preview first,
    accent border), `high` (attention border and the user must type the word `apply`)
  - a before/after diff or a proposed block list
  - `touches` chips naming every screen the change reaches
  - Apply / Edit / Dismiss and a footnote about what is *not* changed
- Applied changes drop into an undo strip, then into `What Mus did today`.
- Quick actions and composer per screen; footer: `Same assistant as the Mus tab · proposes,
  never writes`.

## Interactions & behavior

- **Nothing writes without confirmation** when Mus proposes the write. High-risk proposals
require typing `apply`; medium require Confirm; low apply immediately with a day-long undo.
The user's own ⌘K log is not a proposal — Toast plus undo, no card. Applying a proposal
never rewrites history — past days keep the target they were logged against.
- **Provenance marks**: `✓` filled accent = verified · `~` outline = estimate ·
  `~` orange = photo/LLM range. Badges: PH, Brand, USDA, Yours, Photo.
- Palette search debounces 260ms into the skeleton state; logging keeps the palette open.
- Qty edits commit on blur or Enter, revert on invalid input.
- Verify toggles confidence to 1.00 and advances to the next row.
- Gym rest counts down each second; expanding one lift collapses the previously open one.
- Theme toggle swaps the whole variable set; both themes are complete.
- Timings: 140ms for state changes (`--duration-fast`), 1.0–1.1s pulse loops for
  thinking dots and skeletons. Respect `prefers-reduced-motion`.

## State

Prototype state, for reference when wiring the real stores:

`screen`, `theme` · palette (`paletteOpen`, `query`, `typing`, `selected`, `slot`, `qtyMode`,
`qty`, `plate`, `paletteStatus`) · food (`entries`, `drafts`) · verify (`active`, `verified`,
`verifySeeded`) · foods (`foodsQuery`, `sourceFilter`) · gym (`gymRunning`, `gymSec`,
`gymOpen`, `gymSets`, `gymUndone`, `gymDrafts`, `gymBusy`, `gymAdded`, `restLeft`,
`restTotal`, `restFrom`) · todos (`todoView`, `todoDone`, `todoSel`, `todoPlaced`,
`todoExtra`, `capture`, `energy`, `plannerPick`) · rail (`collapsed`, `permsOpen`,
`permLevels`, `thread`, `thinking`, `dismissed`, `applied`, `confirmWord`, `logOpen`).

Real data sources to substitute: PH core + brand/USDA/user foods from `packages/food` and
`data/ph-core`, gym lifts from `data/gym` + `gym_knowledge_base_v1`, todos from `data/todo`,
Mus from `/api/mus/{respond,plan-day,what-now,capture,permissions}`, permissions persisted
per module.

## Assets

In `assets/`, copied from the prototype (`public/mus-neutral.png` and `public/coco-seed.png`
already exist in the repo):

`mus-neutral.png` (rail + sidebar + Mus screen), `coco-seed.png` (thinking state),
`mus-*-full.png`, `mus-banner.png`, `mark-*.png`, `food-*.png`, `prop-laptop.png`.
Missing by design: `mus-happy.png`, `mus-sad.png` — drawn as labeled slots.

## Files in this bundle

These HTML files are committed here so a fresh clone can open them. If you still have a
local drop at repo-root `design_handoff_kayamo_desktop/`, that path is gitignored — copy
replacements into this folder.

| File | What it is |
|---|---|
| `KayaMo Desktop.dc.html` | the shell and all six screens + command palette |
| `KayaMo Mus Rail.dc.html` | the shared assistant rail, imported by the shell |
| `support.js` | runtime for the two HTML prototypes (not for production) |
| `UX_RECOMMENDATIONS.md` | prioritized gaps found reviewing the prototype — read before building |
| `assets/` | imagery used above |

Open either `.dc.html` directly in a browser. In the shell, use the sidebar to switch
screens, `⌘K` for the palette, and the rail to exercise the proposal flow.
