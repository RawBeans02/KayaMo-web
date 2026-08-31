# Mus — shared assistant (additive)

Created: 2026-09-01

**One identity. Multiple entry points. Shared context. Controlled actions.**

Mus is already the companion on `/mus` and the Dashboard pane. Module
companions (Todos, Gym, Calories) are the **same** router, not new bots.

## Do not

- Overwrite the current system prompt in `packages/ai/src/openai-provider.ts`.
- Replace Gym, navigation, routes, theme, auth, or existing tables.
- Give the model arbitrary SQL or a generic `write_row` tool.
- Auto-write calorie floors or nutrition numbers.
- Add a sixth PWA tab.

## Prompt composition (required)

```
EXISTING SYSTEM PROMPT   ← unchanged at its source
        +
runtime context snapshot (permissions, confirmed rows)
        +
entry (module, view, selected ids)   ← additive JSON, not a new prompt file
        +
user request
        +
attachments metadata (server already knows if an image is present)
```

Never: delete the old prompt and paste a new Mus prompt over it.

## Implementation order

From `17_CODEX_IMPLEMENTATION_PROMPT.md`:

1. Data model spec + To-Do CRUD (this slice)
2. Timetable
3. Action router (typed tools → services)
4. Module companions
5. Full Mus command-center actions
6. Media / proactivity

## Related

- Daily OS taxonomies: `data/todo/`
- Gym KB: `data/gym/`
- Current UI: desktop Dashboard / Calories / Gym / Todos / Mus
