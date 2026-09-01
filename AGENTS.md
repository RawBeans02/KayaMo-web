# AGENTS.md — kayamo-web

KayaMo's standalone desktop surface. The Next.js app lives at this repository
root, following the KitaMo layout. Shared packages are copied into `packages/`.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

## Boundaries

- Root `src/` holds desktop routes, navigation, and composition only.
- `packages/` holds reusable product, domain, data, AI, offline, and UI code.
- Packages never import from the root app.
- This repository treats `packages/`, `supabase/`, and `data/` as synced copies.
  Edit their source of truth in `../kayamo-mobile`, then run
  `../sync-packages.sh` from the KayaMo container.
- Never add service-role credentials to the desktop bundle.
- Follow `.cursor/rules/000-project.mdc` and `.cursor/rules/010-mus-sot.mdc`.
- Zod-validate every LLM output; LLMs never produce nutrition numbers; keep
  health data out of logs; never weaken a test to make it pass.

## Next.js

This version has breaking changes. Before changing framework behavior, read the
relevant guide under `node_modules/next/dist/docs/` and heed deprecations.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
