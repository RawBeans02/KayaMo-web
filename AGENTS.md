# AGENTS.md — kayamo-web

KayaMo's web app: kayamo.fit, desktop-first with a phone layout. A Next.js 16
App Router application at this repository root, with its own workspace packages.
There is no `apps/` directory; `src/` is the app.

## Commands

```bash
pnpm install
pnpm dev          # port 3002
pnpm build        # next build --webpack
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:security
```

## Boundaries

- Root `src/` holds routes, navigation, and composition only. A formula or a
  resolver under `src/` is a bug.
- `packages/` holds product, domain, data, AI, offline, and UI code.
- Packages never import from the root app.
- Never add service-role credentials to the client bundle.
- Zod-validate every LLM output; LLMs never produce nutrition numbers; every
  nutrition write carries `source` and `confidence`; calorie floors are enforced
  in code, not prompts; keep health data out of logs; Lis proposes and the user
  confirms; never weaken a test to make it pass.

## `packages/` is forked, not synced

Owner decision, 2026-09-18. `packages/`, `supabase/` and `data/` belong to this
repository. They are no longer copies of `../kayamo-mobile`, and
`../sync-packages.sh` no longer targets kayamo-web.

The copies had diverged past the point where `rsync --delete` was safe: 158
differing entries, 47 files that exist only here, and migrations 0021/0022 that
exist nowhere else. A sync would have deleted the Lis persona and eval harness,
the `/api/mus/respond` handler, the desk and botanical screens, the offline
closed-database recovery, the `lis_companion` schema and the Liquid Glass layer.

If the web needs something from mobile, port it deliberately and say so in the
commit. Do not re-add this repository to the sync script.

## Names

The assistant is **Lis** in everything a user reads. The older names stay frozen
where they are load-bearing, and renaming them is a migration, not a cleanup:

| Layer | Name | Change it? |
| --- | --- | --- |
| UI copy, docs, new code | Lis | yes, use this |
| Route `/mus`, `data-mus-thread` | mus | frozen until a redirect exists |
| Tables `mus_context_permissions`, `mus_may_read` | mus | frozen; needs a migration |
| Table `lis_companion_profile` | lis | already current |
| Stored origin `coco_confirmed`, env `MUS_*_MODEL` | coco / mus | frozen; stored data |

Lis has a character: the four expressions in `public/botanical/mus-*.webp` ship,
drawn by `packages/features/src/mus/lis-face.tsx` on the Lis surface (thread
header and rail). Which face shows is decided in `mus/mus-faces.ts` and nowhere
else: neutral at rest, thinking while a reply is in flight, concerned when a
reply's register or its safety verdict calls for it. Concern is for wellbeing,
never for a missed log, an over-target day or a gap; `happy` is for a milestone
the person chose and has no web trigger yet. In navigation and on buttons Lis
is the `lis` sparkle icon, not the face. `e2e/mus.spec.ts` asserts a face is
present; do not add an expressions gallery.

## Design

One visual system: **Liquid Glass**. `packages/ui/src/glass.css` owns the
tokens (`--ink`, `--ink2`, `--stroke`, `--stroke2`, `--glass`, `--glass-strong`,
`--field`, `--accent`, `--bg0`) and the type and radius scale;
`packages/ui/src/glass-materials.css` owns the `kg*` material tiers. New styles
read those tokens directly. The `--color-*` names still resolve through an alias
bridge in glass.css for `src/shell/shell.module.css` and the Tailwind primitives
in `packages/ui`; do not add new reads of them. `src/app/botanical.css` is gone
(2026-09-18). Do not start a third system.

## Scope for v1

**Decision, implemented 2026-09-19:** Gym and Todos are off the rail and the
Life hub for the first release. Both routes still resolve and work, but they
render the legacy desk skin (`packages/features/src/desk/desk.module.css`). Home
still deep-links to both (Open planner, View all tasks, the Movement glance) and
the log sheet's Workout kind opens Gym; whether those entry points stay is an
owner call recorded in `docs/RELEASE.md`. Do not convert them to glass just to
keep them visible, and do not re-surface them without converting them first.

## Next.js

This version has breaking changes. Before changing framework behavior, read the
relevant guide under `node_modules/next/dist/docs/` and heed deprecations.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
