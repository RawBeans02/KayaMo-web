# Codex / Coding-Agent Handoff Prompt

You are implementing the next KayaMo product layer from this source-of-truth package.

## First: inspect the repository

Do not immediately rewrite anything.

Inspect:
- project structure
- routes/pages
- current left navigation
- current Dashboard, Calories, Gym, Todos, Mus, Foods, Verify implementations
- current DB/schema/migrations
- current state management
- current AI client/model routing
- current system prompt loading/composition
- existing Gym source of truth and services
- existing Calories/Foods services
- existing styling/design tokens

Use `reference/current-kayamo-ui.png` as a visual reference.

## Critical non-destructive requirement

**DO NOT OVERWRITE THE CURRENT SYSTEM PROMPT.**

The current system prompt must remain intact at its existing source.

Implement KayaMo/Mus-specific instructions as an additive runtime extension/context layer.

Do not:
- replace the base system prompt
- save a merged prompt back over the current prompt
- delete current safety/personality instructions
- replace the Gym implementation
- replace current routes/navigation
- restyle the entire app

## Product architecture

Mus is the user-facing AI across KayaMo.

The Mus tab is the full AI command center.

Dashboard, Todos, Gym, Calories, Foods, and Verify may expose a smaller Mus companion that shares the same assistant/action system and receives module context.

## Build To-Do as a real execution system

Implement:
- tasks
- projects
- recurrence
- dependencies
- future tasks
- overdue tasks
- inbox
- manual CRUD
- drag/drop scheduling
- resizable timetable
- schedule inspector
- lock/flexibility/AI-managed state
- day/week/agenda views as appropriate for existing architecture

## Mus actions

Mus should be able to call typed application actions, including:

To-Do:
- create
- edit
- delete
- complete
- schedule
- move
- recur
- bulk edit

Schedule:
- create/move/resize blocks
- plan day
- replan remaining day
- fill free time
- optimize day

Gym:
- schedule/move workout
- read workout
- add/remove/replace unfinished exercises
- edit future sets/reps/rest
- start workout
- read history

Calories/Foods:
- read today's summary
- log user-confirmed foods
- assist with image-based food identification

Do not allow the LLM to run arbitrary SQL.

Use an action router/service layer with:
- permission checks
- validation
- confirmations
- audit events
- Undo

## Cross-module planning

When the user asks "plan my day", Mus may use permitted context from:
- date/time
- weather
- fixed events
- tasks/deadlines
- routines
- Gym
- Calories/Nutrition summary
- locations/travel
- user-provided energy

Example:
Lunch at 12:30 can influence a suggestion for a simpler breakfast, but Mus must not silently change nutrition goals.

Example:
A Gym session that historically takes 80 minutes should not be put in a 60-minute slot without warning.

## Image handling

Mus must support images.

Keep model names configurable.

The user's intended internal design can map:
- orchestrator alias: gpt-5.6-luna
- media/vision alias: gpt-5.4-mini

Do not assume those are permanent.

Do not use Luna merely to detect whether an attachment exists. The backend already knows that.

Recommended flow:
1. request normalizer detects attachments
2. Mus/Luna orchestrator evaluates request
3. vision worker analyzes image when needed
4. worker returns structured observations
5. Mus synthesizes and invokes app actions if appropriate

## Deliver incrementally

Do not implement everything in one risky rewrite.

Start with data model + To-Do CRUD, then timetable, then action router, then companions, then full Mus, then media/proactivity.

Run existing tests after each meaningful phase and add acceptance tests from `15_ACCEPTANCE_TESTS.md`.
