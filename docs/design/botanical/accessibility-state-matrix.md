# Botanical accessibility and state matrix

Reviewed September 13, 2026. This is evidence of the checks below, not a claim of
Apple approval or universal WCAG conformance.

## Automated coverage

| Surface | Covered states and interactions |
| --- | --- |
| Landing / login | Light/dark, demo entry and returning identity, email sent, cooldown, resend, change address, rate limit, invalid callback and recovery |
| Home / tasks | Empty and saved records, quick capture, dated priorities, editing, completion, reload, recovered draft, discard confirmation, modal Tab cycling and return focus |
| Goals | Empty, new draft, goal detail, first step on Home, milestone confirmation, reload, injected milestone-write failure, retained draft, retry without duplicate records |
| Life / food | Navigation to physical tools, repeat food logging, provenance, quantity edits, undo, reload, catalog and verification table semantics |
| Workouts | Active session, continuation across navigation/day boundary, actual results, reload, copy blocked during active session |
| Grove | Empty state and history from saved completed records; no fabricated activity |
| Mus | Demo unavailable, permission read/write failures, server-confirmed permissions, proposal risk tiers and confirmation, valid expression assets, non-shaming state rules |
| Settings | System/light/dark, appearance persistence, reduced transparency, language controls, available account actions, permission navigation |

The existing browser behavior tests remain in place. New axe checks scan landing,
login, all five destinations, settings and the five physical/planner tool routes in
light and dark on Chromium, Firefox and WebKit. Open goal/task editors are scanned
at 320px. Reduced motion is explicitly enabled and asserted before scanning.
Automated accessibility results include manual-review candidates as well as violations;
zero reported violations is not a substitute for a screen-reader user evaluation.

Responsive regression widths: 320, 390, 768, 1024 and 1440 CSS pixels. Long task and
goal text is exercised. Settings also receives 200% root text sizing at 768px.
At 320px the goal footer occupies its own layout area; an assertion prevents it
from overlapping the scrollable form. Modal screenshots use viewport capture,
not full-page capture, to avoid moving fixed UI while measuring it.

## Fixes from review

- Proper table columnheader/cell roles and native keyboard-selectable food names.
- Named timeline region instead of an invalid empty list role.
- Visible modal focus, Tab cycling, Escape/discard behavior and opener focus.
- Readable goal/conversation labels; separated narrow-screen goal footer.
- Opaque reduced-transparency and unsupported-blur fallbacks.
- Worst-case sidebar text contrast tested over black/white texture and backdrop
  extremes using actual stylesheet tokens in both themes.
- Timeline current-time tag and food count contrast corrected.
- Mus page heading, photo-input accessible name and transparent artwork corrected.

## Manual visual evidence and limits

`evidence/comparison-v5.png` combines the selected Home reference and current
implementation at 1440×1024, the same date and three illustrative saved tasks.
The demo disclosure and neutral categories are intentional product differences.
`evidence/mus-family-v5.png` shows all four expressions on light/dark backgrounds.
The in-app browser was used to review live Mus and light/dark settings.

Native browser zoom has not been verified: the in-app browser did not visibly
respond to the browser-zoom shortcut. The 200% text-size and narrow-viewport checks
above are distinct tests, not a claim of native 200%/400% zoom coverage.
VoiceOver/NVDA speech output and physical assistive-device testing are not claimed;
accessible names, heading structure, focus behavior and axe rules are checked.
Hosted authenticated recovery and live AI allowance behavior require the preview
environment and remain separate release gates from mocked/browser regression tests.

## September 14 interaction audit follow-up

The Apple-design audit adds web-scoped press feedback, motion-aware dialogs/sheets,
44px brand/demo/permission targets and conservative timeline physics. Reduced-motion
tests assert that pressed controls do not scale; opacity feedback remains. Reduced
transparency is applied immediately, without a transitional translucent fill.
New pointer tests distinguish a tap from dragging, cancel without persisting, re-grab
while settling, bound flick travel, and check keyboard movement/resize after reload.
The original static layout/artwork is preserved; see the audit implementation record
in `docs/audits/2026-09-13-apple-design-implementation.md`.
