# Botanical redesign — implementation QA

final result: passed

September 14 audit implementation and local visual QA passed. This is not production
release approval. Remaining release gates: hosted verification, native zoom/screen-reader
review, provider rollback retention and user preview approval.

## Scope and visual truth

Selected direction: daily timeline/priorities from concept 2, with only the botanical
texture from concept 3. Apple-inspired quality is the goal, not an Apple approval claim.
Native artwork and defaults remain outside scope.

- Source: `docs/design/botanical/evidence/reference.png`, 1487×1058.
- Current: `docs/design/botanical/evidence/home-motion-v6.png`, Chromium at 1440×1024,
  device scale factor 1.
- Original-direction comparison: `docs/design/botanical/evidence/comparison-v5.png`,
  source normalized to 1440×1024 beside the pre-audit implementation.
- Audit regression comparison: `docs/design/botanical/evidence/motion-comparison-v6.png`,
  2880×1024, pre-audit v5 left and final audit v6 right, each at native 1440×1024.
  Focused brand/header comparison: `motion-detail-v6.png`, two 700×260 crops at 1:1.
- Same state: light theme, September 11, 2026, three illustrative tasks/time blocks
  in isolated test-guest IndexedDB. No production sample records are inserted.
- Additional evidence in that directory: `mus-family-v5.png`,
  `goal-editor-320-v5.png`, `task-editor-dark-320-v5.png`,
  `settings-large-text-v5.png`.
- Live in-app browser review: Mus conversation/history and light/dark settings;
  audit follow-up reviewed narrow Home, Goals and editor open/close/focus restoration.

## September 14 audit findings and post-fix comparison

No actionable P0/P1/P2 visual differences remain in the reviewed audit scope.
The audit's AD-01–08 implementation is recorded in
`docs/audits/2026-09-13-apple-design-implementation.md`; the source audit is unchanged.

- Fonts/typography: same system-sans family, weights, hierarchy and wrapping at default
  text size. Optical sizing is enabled; no replacement typeface or decorative labels.
- Spacing/layout: same columns, card dimensions, corners and content rhythm. The demo
  banner is intentionally 13px taller to accommodate a true 44px sign-in target;
  content shifts down accordingly. Brand/link padding no longer relies on overlap.
  Equivalent rem dimensions preserve default density and scale with text preferences.
- Colors/tokens: botanical palette, opaque reading cards and navigation texture remain
  unchanged. Reduced transparency now becomes opaque immediately, including on theme changes.
- Images: existing sprout and transparent Mus assets retain scale, crop and sharpness;
  no artwork was regenerated or replaced in this interaction pass.
- Copy/content: the same saved-record test content and public labels remain; no invented
  activity or audit instructions appear in the interface.

The full-view and focused comparisons were opened together as before/after images.
The focused crop confirms unchanged brand/nav typography and the intentional banner
spacing correction. The enlarged dark settings screenshot was also reviewed at 200%
root text size: content remains readable and scrollable without horizontal overflow.

Iteration history: motion checks caught reduced-motion selector specificity and an
unreachable read-only timetable; those were corrected in implementation. An intermediate
full run found four Reduce Transparency checks sampling a fading translucent background.
The preference now excludes background from transitions rather than weakening assertions.
The final full run passes all 132 checks, including the original failed states.
Final screenshots are in `/private/tmp/kayamo-apple-audit-verified/`; the durable Home
comparison above was regenerated from that final run.

## Visual review outcome

Home preserves the selected two-column plan/priorities layout, opaque reading
surfaces, botanical palette and textured navigation. Typography is system sans.
The demo disclosure adds vertical space absent from the mock. Generic saved tasks
use neutral icons/categories rather than guessing life areas from their text.
These are intentional functional differences.

All four Mus expressions now use the transparent seed/two-leaf family, reviewed on
light/dark backgrounds. Web overrides preserve native assets and non-shaming rules.
Old black-circle artwork and checkerboard candidates are no longer used by the web.

Visual review caught overlapping actions in the 320px goal editor. The footer now
occupies a reserved opaque area; the scrollable form ends above it. A regression
assertion checks their bounds. Goal labels and conversation titles were made
readable, and history controls no longer squeeze titles into a tiny column.

Non-blocking polish: the mock's timeline icons/markers are more prominent. Retain
honest saved-field semantics if refining them.

## Verification

- Full browser suite: **132/132 passed**, Chromium, Firefox and WebKit, retaining
  original behaviors and adding accessibility/recovery and motion coverage.
- Unit suite: **529/529 passed**. Typecheck, lint and production build passed after
  the full browser run. Existing AI SDK and local Node 20 warnings remain.
- Final affected-screen rerun/build checks are recorded in
  `docs/design/botanical/release-candidate.md` when complete.
- Disposable database: **32/32 integration tests passed** after all migrations
  replayed in a separate local Supabase project. Temporary data was removed after
  testing; the existing local project and production were untouched.
- Goal save is now one account-scoped IndexedDB transaction including the outbox.
  Injected failure/reload/retry is tested. Remote sync remains eventually consistent,
  not an invented atomic server transaction.
- See `docs/design/botanical/accessibility-state-matrix.md` for exact route/state,
  width, theme, reduced-preference, focus and contrast coverage, and its limits.

## Release checklist

- [x] Selected layout, responsive five-destination shell and working core journeys.
- [x] Complete transparent Mus family and web-only integration.
- [x] Observed table/timeline, contrast, modal-focus and editor-overlap fixes.
- [x] Document automated accessibility and workflow-state matrix.
- [x] Atomic local goal-plan save and partial-write recovery tests.
- [x] Disposable database integration.
- [x] Audit interaction pass AD-01–08 and final visual comparison.
- [x] Final full browser checks 132/132; unit tests 529/529; typecheck, lint and build passed.
- [ ] Hosted preview and candidate smoke checks.
- [ ] Native browser zoom and actual screen-reader review.
- [ ] Verify provider rollback retention.
- [ ] User preview approval, promotion and post-promotion smoke.

## Comparison history

September 14 global-positioning follow-up: public landing/login wording is no longer
Filipino-first. Foods adds an opaque worldwide-search/review section using the existing
palette and control system; `evidence/worldwide-review-390.png` records the narrow
authenticated fixture. The app's demo gate was also inspected in the in-app browser.
This is a functional addition, not a claim that the original Home mock included a food
search design. Release limits and exact regression outcomes are in
`docs/global-product-direction.md`; USDA access currently returns HTTP 403.

Earlier `comparison-v1/v2/v3.png` and `detail-v3.png` document typography/layout
corrections. The v2 detail was incorrectly density-normalized and is not acceptance
evidence. V4 corrected narrow Home hierarchy and moved expression guidance into
a disclosure. V5 completes artwork, semantic/contrast fixes and same-state comparison.
Earlier 105-test results precede the expanded suite.
