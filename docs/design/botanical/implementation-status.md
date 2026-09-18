# Botanical web redesign — status

Status: implemented release candidate; **not production-release-complete**.

## Current checks

- Browser regressions: 132/132 passing (Chromium, Firefox, WebKit) after the September 14 Apple-design audit implementation.
- Unit suite: 529/529 passing across root and shared packages, including account isolation, offline sync, nutrition, AI safeguards and timeline physics.
- Final typecheck/lint/production build: passing. Existing AI SDK dynamic-dependency and local Node 20 deprecation warnings remain; CI already uses Node 22.
- `git diff --check`: passing.
- Database integration: 32/32 passed against a new isolated local Supabase project after replaying all migrations. Disposable data was removed afterward; the existing local project was not reset.
- Preview deployment / live smoke: not yet verified for this redesign.
- Delivery target: `codex/botanical-liquid-glass`, a review branch, not a production promotion. Production remains unchanged.

## Boundaries

New product orchestration/components live in `packages/features/src/botanical` and `packages/features/src/journey`; root routes remain composition. Their canonical sibling copies were changed first and targeted updates kept new equivalent files aligned. Older Mus files already differ between repositories; only the new prop/copy/disclosure hunks were applied to each, preserving those existing differences. No whole-tree synchronization was run. Existing unrelated changes are preserved.

The user approved a web-only semantic-fix exception for the already-diverged foods
table, verification table and planner timeline. Native semantics of those files are
preserved. The subsequent audit adds shared timeline motion through a web-only opt-in
and targeted integration into the divergent web planner, without copying over the native layout.

The previous deployed revision recorded for rollback is `e7326d87ff1edceff2525e71e7e63c2d5e3081cd`; re-verify its deployment identity before any production promotion.

## Remaining work

Mus assets, observed accessibility/editor fixes, atomic local goal-save recovery and
disposable DB verification are complete. See root `design-qa.md` and
`release-candidate.md` for evidence and remaining gates: hosted preview/smoke,
native zoom and screen-reader review, rollback retention and user preview approval.
Native iOS/Android remains deferred.

## Subsequent launch-checklist findings

The September 14 tutorial pass adds public metadata, robots/sitemap controls and
an accessibility-statement draft without a design change. See
`../../tutorial-application.md` for current verification and owner actions.
Additional release gates: approved public privacy/support information and targeted
dependency security remediation (the production dependency audit reports 16
advisories, including two critical Next.js version matches). These are not evidence
of a compromise, but must not be omitted from readiness reports. Global food-search
coverage and the USDA 403 remain documented in `../../global-product-direction.md`.
