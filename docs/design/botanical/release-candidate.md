# Botanical release candidate — September 13, 2026

Production has not been promoted. This is a release-gate record, not a completion claim.

## Mus assets

The web family lives in `public/botanical/mus-{neutral,thinking,happy,concerned}.webp`.
The three new expressions were generated with the user-approved OpenAI API fallback CLI,
`gpt-image-1.5`, high quality, high reference fidelity, and native transparent output.
The existing neutral image was the reference. Prompts are in `prompts/mus-*.txt`.
Raw 1024px outputs are retained locally in ignored `output/imagegen/`; production assets
are 512px WebP with alpha preserved. No API key is stored in assets or documentation.

`evidence/mus-family-v5.png` shows neutral, thinking, happy and concerned, in that order,
on pearl and charcoal backgrounds. The character has a consistent seed silhouette and
two leaves. Concern remains for wellbeing, never for missed logs or compliance.
Native defaults and artwork have not been replaced; the web supplies optional asset overrides.

## Goal creation and partial writes

`createLocalGoalPlan` commits the goal, milestones, first task and all sync-queue records
in one account-scoped IndexedDB transaction. The editor saves a confirmation UUID with its
draft, allowing an interrupted confirmation to be retried without duplicating saved records.
Tests cover milestone/task/outbox failures, retry, concurrent duplicate confirmation, database
reopening, stale deleted-goal confirmation and an account switch during the transaction.

This does **not** make the server sequence transactional. Remote records still synchronize
through the existing durable outbox and its retry rules. No endpoint or migration was added.
Previously created incomplete goals are not silently guessed or backfilled; their missing steps
must be added explicitly. There is no reliable historical intent record from which to infer them.

## Database verification

Fresh isolated Supabase project: `kayamo-botanical-check-20260912`.
API port 55321, database port 55322; production and the existing local `kayamo` project were not reset.
All migrations replayed on the disposable database. **32/32 integration tests passed**:
25 RLS, five database-sync, two PostgREST-sync checks.

`scripts/run-disposable-db-tests.mjs` validates the isolated project and ports, loads its
credentials into the child process without printing them, and invokes the guarded integration suite.
The disposable project was stopped with `--no-backup` after verification. Only its
temporary containers/data were removed; the existing local project was left intact.

## Accessibility and regression verification

The full suite passed **123/123** browser tests across Chromium, Firefox and WebKit,
including the original journeys, light/dark axe scans and new goal recovery/modal
keyboard tests. After the narrow goal-footer correction, **33/33** affected Home,
goal, keyboard and accessibility browser checks passed across all three engines.
Final typecheck, lint and production build passed. The unit suite passed **525/525**
tests across the root and shared packages. Existing AI SDK dynamic-dependency and
local Node 20 deprecation warnings remain; CI uses Node 22.
See `accessibility-state-matrix.md` for exact coverage and explicit manual-testing limits.

The user approved a targeted web-only exception for the already-diverged foods table,
verification table and planner timeline. Those semantic fixes preserve their native
counterparts. All other reusable goal/modal/asset-prop changes were applied to canonical
shared sources and targeted web copies without whole-tree synchronization.

## Rollback record

### September 14 audit verification addendum

The Apple-design audit implementation passes **132/132** browser checks across all
three engines and **529/529** unit tests. Typecheck, lint and production build passed
in the same final sequential run. The production build is available locally on port
3002 for QA; this is not a hosted preview or production promotion. See root
`design-qa.md` and `docs/audits/2026-09-13-apple-design-implementation.md` for the motion,
target-size, reduced-preference and timetable-save changes. No backend migration was
added; the earlier isolated database result above remains a historical check.

### Existing deployment

- Existing production commit: `e7326d87ff1edceff2525e71e7e63c2d5e3081cd`.
- GitHub deployment: `6375372627`, environment `Production`, status `success`.
- Immutable deployment URL: https://kaya-mo-web-1u7mu070h-rovinceeduvane113-2617s-projects.vercel.app
- Metadata checked September 12 and rechecked September 13 through the repository deployment API.
- The immutable URL responds with Vercel's authentication redirect; this is not an application smoke pass.
- `https://www.kayamo.fit/login` returned HTTP 200. This checks existing production, not the redesign.
- The existing deployment has not been deleted or changed. Provider retention and an actual rollback
  rehearsal remain unverified; do not claim preservation beyond this recorded, existing deployment.

Before promotion, verify the old deployment is retained and accessible in Vercel, record the
new immutable preview URL and commit, complete preview/browser checks, and obtain the user's
preview approval. Restore the recorded deployment through Vercel if post-promotion smoke checks fail.

## Outstanding release gates

- Upload to `RawBeans02/kayamo-web`, branch `codex/botanical-liquid-glass`.
  On September 13 the execution approval system rejected the commit/push command,
  requiring explicit destination-and-payload consent rather than a general "proceed".
  The command did not run; changes remain staged locally. Do not bypass that rejection.
  Upload payload is website source, generated Mus artwork and QA documentation/evidence;
  `.env.local`, raw image outputs and unrelated folders are excluded.
- Preview deployment review, hosted candidate smoke checks, user preview approval.
- Native browser zoom and real screen-reader review (not substituted by axe/text-size checks).
- Confirm provider rollback retention before any production promotion.
