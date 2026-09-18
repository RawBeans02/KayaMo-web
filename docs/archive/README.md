# Archive

Dated records kept for history. **Nothing here describes the current product.**
Do not follow instructions in these files.

They were moved out of `docs/` on 2026-09-18 because they describe a structure
and a product that no longer exist, and agents were reading them as current.

| Archived | Why |
| --- | --- |
| `build/` | The 37-chapter build guide. Written for an `apps/pwa` + `apps/web` + `apps/admin` monorepo on Next 15 with turbo, none of which exists here. Its `chNN` numbering no longer tracks any work; commit messages must not cite it. |
| `build-bundles.md` | Chapter bundling for that same guide. |
| `inventory-2026-08.md` | An August snapshot against the old structure. The live §37 inventory is `docs/inventory/`, which is current and stays. |

Still current, and deliberately not archived:

- `docs/inventory/` — live §37 status, marked SHIPPED / PLANNED / DEFERRED_*
- `docs/adr/` — decision records; being historical is their purpose
- `docs/releases/` — what was deployed and when
- `docs/compliance.md`, `docs/breach-response.md` — the one completed regulatory
  analysis (RA 10173). Scope for a global product is unresolved; see
  `.cursor/rules/500-safety-privacy.mdc`
- `docs/audits/` — the September reviews
- `docs/RELEASE.md` — the checklist that decides whether we ship
