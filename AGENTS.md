# AGENTS.md — KayaMo

Personal Growth OS. PWA → Android → iOS.
Solo developer. Bundle ID `ph.kayamo.app`. AI companion: Mus.
Canonical product: `Mus_Build_Source_of_Truth.md`. ADR: `docs/adr/001-mus-source-of-truth.md`.
Build chapters (the only `chNN` numbers): `docs/build/README.md`.

## Commands
```bash
pnpm install
pnpm dev:pwa          # user app
pnpm dev:web          # desktop review shell
pnpm dev:admin        # internal tools
pnpm build
pnpm test
pnpm typecheck
pnpm db:migrate
npx supabase start    # local Postgres + Auth (Docker)
npx supabase status   # URL, anon key, service role
pnpm ph-core:build    # validate + upsert data/ph-core/foods.yaml
pnpm gym:kb:build     # compile data/gym CSV → packages/features gym KB
pnpm todo:kb:build    # compile data/todo CSV → packages/features todo KB
pnpm mobile:sync      # copy PWA build into the Capacitor shell
```

## Where code goes
| Path | Holds | Never holds |
|---|---|---|
| `apps/pwa` | mobile-first routes, nav chrome, glue | domain logic, formulas |
| `apps/web` | desktop shell, sidebar, Cmd+K | domain logic, formulas |
| `apps/admin` | internal dashboards | anything user-facing |
| `apps/mobile` | native plugin wiring | UI, business logic |
| `packages/features` | screen logic, data hooks, layout-neutral UI | routing, nav chrome |
| `packages/db` | schema, migrations, RLS, queries | domain formulas |
| `packages/core` | TDEE, targets, trend, progression, identity | I/O, network, React |
| `packages/food` | resolver cascade, source adapters | UI |
| `packages/ai` | router, tools, agent, safety, memory | nutrition math |
| `packages/offline` | Dexie, sync queue | domain logic |
| `packages/ui` | tokens, primitives | app-specific screens |
| `docs/build` | KayaMo build-guide chapters 0–36 | Mus SoT phase numbers as `chNN` |

Packages never import from apps.

Five tabs: Home, Goals, Life, Grove, Mus. Food and gym live under Life → Physical Self.

## Hard constraints
See `.cursor/rules/000-project.mdc` and `.cursor/rules/010-mus-sot.mdc`. Zod on every LLM
output, `source` + `confidence` on every nutrition write, LLM never produces
nutrition numbers, calorie floors enforced in code, offline-first writes,
no health data in logs, never weaken a test to make it pass.

## Adding a fourth surface
New surfaces go in `apps/` and consume `packages/`. A Messenger bot, a watch
app, or a second product reusing the food resolver should require zero changes
to `packages/`. If it does require changes, the boundary was drawn wrong.
