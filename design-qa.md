# Botanical redesign — implementation QA

final result: blocked

## Scope and visual truth

The selected direction is the daily timeline/priorities layout, with only the botanical texture carried over from concept 3. This is a working website redesign, not an Apple approval claim. Native assets and defaults are outside this release.

- Source: `docs/design/botanical/evidence/reference.png`, copied from `/Users/rovs/.codex/generated_images/01a06373-5b0e-7231-b583-5ae731ec9c7d/exec-db002b69-8095-41e4-b55a-e4a7aae33b44.png`.
- Implementation: `docs/design/botanical/evidence/home-v3.png`, local `/today`.
- Source pixels: 1487 × 1058. Reference normalized to 1440 × 1024 for comparison (negligible aspect-ratio difference).
- Implementation: Chromium, 1440 × 1024 CSS pixels, device scale factor 1. The earlier WebKit v2 capture was scale factor 2 and normalized before full-view comparison.
- State: light theme, September 11, 2026, three illustrative tasks and time blocks stored in the isolated test guest's IndexedDB. No production sample activity is inserted.
- Full-view evidence: `docs/design/botanical/evidence/comparison-v3.png` contains source and implementation together.
- Focused evidence: `docs/design/botanical/evidence/detail-v3.png` aligns the plan panels after accounting for the real demo disclosure. The v2 detail image was incorrectly density-normalized and is not acceptance evidence.
- Supplemental evidence: `home-320.png`, `mus-390.png`, `settings-390.png`, `verify-320.png` in the same evidence directory. Also inspected Home and Mus in the in-app browser.

## Findings that still block full-design acceptance

1. **[P1] Mus asset family is unfinished.** Home/login use the new transparent neutral character, but the conversation and expression gallery still show the older detailed artwork on black circles. This visibly breaks the approved identity. Thinking, happy, and concerned candidates contain baked checkerboards. Clean and validate their alpha, then supply web-scoped asset overrides without replacing native defaults. Local background-removal permission is still pending.
2. **Verification gaps remain.** The full matrix of zoom, long text, open editors, worst-case glass contrast, reduced motion/transparency, dark screenshots, and screen-reader behavior is not yet documented. Passing overflow assertions is not equivalent to completing that review.

## Required fidelity surfaces

- **Typography:** system sans replaces the former family mixture as explicitly requested. Date hierarchy and plan headings were enlarged after comparison. Body text remains 16px by design rather than copying all enlarged mock text. The small-screen Home label was corrected in v4.
- **Spacing/layout:** the two-column timeline/priorities structure, opaque reading surfaces, compact sidebar and labeled bottom navigation are implemented. The production demo notice adds vertical space absent from the mock; this is intentional, not an attempt at exact coordinate matching. All five destinations now have real pages. Timeline dot/icon refinements are minor follow-up polish.
- **Colors/tokens:** pearl, charcoal and botanical green are web-scoped. Glass is reserved for shell/compact controls; content panels are opaque. Dark and reduced-transparency preferences persist. Worst-case contrast testing is still a release gate, not claimed as passed.
- **Images:** generated seed mark, neutral Mus and sidebar texture are real raster assets, not CSS drawings. App favicon, browser install artwork and social-preview metadata are web-only. The remaining Mus states are explicitly not approved.
- **Copy/content:** no sample tasks, invented XP or fabricated streaks are inserted into user records. Generic saved tasks use neutral category labels/icons instead of guessing life areas from their text. Demo data boundaries and unavailable areas are stated. Goal pause/resume text was corrected so it does not falsely promise automatic removal/addition of ordinary daily tasks.

## Comparison history

1. **v1:** `comparison-v1.png` showed undersized date/navigation hierarchy and weak sidebar texture. Enlarged sidebar/typography and increased texture presence; restored functional previous/next week controls.
2. **v2:** `comparison-v2.png` showed improved major proportions, but a high-specificity global font reset suppressed control typography and week controls lost their borders. Replaced that reset with zero-specificity defaults and corrected the week-action selector. Enlarged the plan heading and priority labels.
3. **v3:** `comparison-v3.png` and `detail-v3.png` confirm those fixes. Remaining differences above are not silently accepted. Earlier responsive verification overflow and duplicate goal notices were fixed; browser regressions verify the changed behavior.
4. **v4:** `home-320-v4.png` confirms the Home label is subordinate to the date. `mus-390-v4.png` confirms a visible demo-unavailability explanation in the conversation header and the expression gallery moved into a keyboard-accessible disclosure. The prior v3 captures provide the before evidence. The date advanced to September 12 for these empty-state captures; this is a date-label change, not layout drift. Eighteen affected browser checks passed after these fixes. The old artwork remains a separate blocker.

## Functional verification

- Full browser run: **105/105 passed** across Chromium, Firefox and WebKit (35 per browser), retaining the original 29 behaviors and adding six redesign regressions per browser. The subsequent Home/Mus refinement pass also passed **18/18** affected checks.
- Covered: demo identity, email-link recovery/resend/cooldown, food entry and undo, task capture/edit/reload, workout continuation/results, goal first step and milestone history, server-confirmed Mus permissions/proposals, date isolation, recovered task drafts, primary navigation, appearance persistence, and narrow legacy-tool overflow.
- Viewport checks include 320, 390, 768, 1024 and 1440px; tools additionally tested at 320/390/768px.
- macOS Safari keyboard test uses native Option-Tab to reach buttons; the focus assertion is unchanged. An intermittent callback check passed in isolation and in the final full run without weakening its assertions.
- Unit tests passed; final type checks, lint and production build also passed. Build warnings and release gates are recorded in `docs/design/botanical/implementation-status.md`.
- Disposable database integration and hosted preview/live smoke checks have **not** passed for this redesign. No production deployment was replaced.

## Implementation checklist

- [x] Selected layout, web tokens, responsive five-destination shell, working Home/Goals/Life/Grove, settings and public entry.
- [x] Canonical shared feature extraction and targeted updates, preserving unrelated mobile changes.
- [x] Full cross-browser functional suite.
- [x] Correct narrow Home hierarchy and make Mus expression guidance secondary.
- [ ] Complete Mus asset family.
- [ ] Resolve remaining visual findings and complete accessibility/state matrix.
- [ ] Check partial-write recovery for multi-record goal creation; the inherited sequence is not an atomic transaction.
- [ ] Run disposable database integration, preview deployment review and live smoke checks.
- [ ] Preserve rollback deployment before production promotion.

## Follow-up polish

Increase timeline icon prominence and consider subtle timeline markers using the existing icon library. Keep task semantics grounded in saved fields. Do not add guessed categories just to resemble the sample picture.
