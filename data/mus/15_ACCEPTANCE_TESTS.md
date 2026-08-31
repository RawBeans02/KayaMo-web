# Acceptance tests (from the owner package)

Run existing `pnpm test` after each phase. These are product checks, not a
license to weaken unit tests.

## Prompt

- [ ] `packages/ai/src/openai-provider.ts` system string is unchanged in intent
      (Coco/Mus safety, confirmation, no silent writes, no nutrition invention).
- [ ] Module context is extra JSON, not a replaced prompt file.

## To-Do CRUD

- [ ] Add a task for today.
- [ ] Add a task to inbox (no date).
- [ ] Complete / uncomplete.
- [ ] Edit title.
- [ ] Move today → tomorrow → inbox.
- [ ] Delete (tombstone, not a hard wipe).
- [ ] Overdue stays in its own list; it is not dumped onto Today.

## Shared Mus

- [ ] `/mus` and Dashboard Mus use `/api/mus/respond`.
- [ ] Todos companion uses the same route.
- [ ] Proposals still require Confirm.
- [ ] Gym consult picker is unchanged.

## Later phases (not this slice)

- [ ] Drag timetable, inspector, Plan My Day, vision photos, action audit UI.
