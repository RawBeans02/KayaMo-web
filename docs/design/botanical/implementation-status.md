# Botanical web redesign — status

Status: implemented foundation and core vertical slices; **not release-complete**.

## Current checks

- Browser regressions: 105/105 passing (Chromium, Firefox, WebKit); subsequent Home/Mus refinement checks 18/18 passing.
- Unit suite: passing across root and shared packages, including account isolation, offline sync, nutrition and AI safeguards.
- Final typecheck/lint/production build: passing. Existing AI SDK dynamic-dependency and local Node 20 deprecation warnings remain; CI already uses Node 22.
- `git diff --check`: passing.
- Database integration: blocked locally because a disposable Supabase environment is unavailable. Do not use production credentials as a substitute. Existing CI has a disposable-Supabase job.
- Preview deployment / live smoke: not yet verified for this redesign.
- Delivery target: `codex/botanical-liquid-glass`, a review branch, not a production promotion. Production remains unchanged.

## Boundaries

New product orchestration/components live in `packages/features/src/botanical` and `packages/features/src/journey`; root routes remain composition. Their canonical sibling copies were changed first and targeted updates kept new equivalent files aligned. Older Mus files already differ between repositories; only the new prop/copy/disclosure hunks were applied to each, preserving those existing differences. No whole-tree synchronization was run. Existing unrelated changes are preserved.

The previous deployed revision recorded for rollback is `e7326d87ff1edceff2525e71e7e63c2d5e3081cd`; re-verify its deployment identity before any production promotion.

## Remaining work

See root `design-qa.md` for screenshot evidence and blocking findings. Complete Mus assets, full accessibility and editor-state coverage, partial goal-save recovery, disposable DB verification, then review a preview before production promotion. Native iOS/Android remains deferred.
