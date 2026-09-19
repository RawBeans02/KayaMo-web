# Apple-design audit implementation

Implemented September 14, 2026 against `2026-09-13-apple-design.md`.
This is a web interaction-quality pass, not an Apple approval claim.
The original audit is preserved unchanged.

| Finding | Implementation |
| --- | --- |
| AD-01 | Shared pointer-down `:active` feedback for web buttons, links, summaries and role-buttons. Disabled controls are excluded. Drag handles never scale. |
| AD-02 | Tokenized opacity/scale feedback; open/close editor and sheet transitions; a frame-rate-independent critically damped spring for timeline settling. No perpetual decorative motion or animated backgrounds added. |
| AD-03 | One web-scoped interaction stylesheet in canonical UI, imported by the web app; canonical Button includes transform in its transition contract. Existing native styles are not globally restyled. |
| AD-04 | Reduced motion retains short opacity/color feedback with no press scaling or overlay travel. Timeline follows the pointer directly but skips momentum/settling. Reduced transparency becomes opaque immediately. |
| AD-05 | Native task/goal dialogs derive their origin from the opener and close on the matching path. Shared sheets use an anchored bottom-edge origin, retain content during exit, and can reverse from their current presentation. Mus stays a full route—not a new competing assistant overlay. |
| AD-06 | 10px drag threshold, timestamped recent samples, progressive boundary resistance, projected snap and interruptible settling. Cancel/Escape discards the unconfirmed placement. Extra momentum is capped at one 15-minute step; resizing never flings. Confirmed values remain snapped and within the day. |
| AD-07 | Brand, demo sign-in link and Mus permission toggle have at least 44px hit height. Text size is preserved; banner height accommodates the actual target instead of overlapping nearby content. |
| AD-08 | `will-change` is assigned only during drag/settle and overlay motion, then cleared. Optical sizing is enabled without introducing a new font. Web shell/public-entry widths and key padding use rem; timeline minutes-to-pixel geometry, breakpoints and hairlines remain deliberate px. |

## Important correction to the audit

The live desktop timetable passed `readOnly` and no-op save callbacks, so its
underlying drag code was unreachable. The web timetable is now connected to the
existing account-scoped time-block save path, with visible save-error feedback.
Keyboard selection/move/resize/delete and empty-space block creation are wired.
Double-clicking an existing block does not create an extra one. Moving a Mus ghost
only changes the proposal draft; confirmation remains required to persist it.

The spring is a small tested closed-form implementation, not a newly installed
animation framework. The conservative momentum cap deliberately differs from an
unbounded scroll-style throw: schedule editing is precision work.

## Verification and limits

- Final September 14 run: **132/132 browser checks** across Chromium, Firefox and
  WebKit; **529/529 unit tests**; typecheck, lint and production build passed.
- New cross-browser motion checks verify active feedback, reduced-motion scale
  suppression, target height, dialog focus restoration, tap-versus-drag, Escape,
  spring interruption, bounded flick, keyboard movement and persisted time changes.
- Four pure tests cover resistance, projection cap, snapping/day bounds and spring
  convergence/interruption.
- Full-suite status and visual evidence are recorded in root `design-qa.md`.
- Native touch hardware, VoiceOver/NVDA speech output and native browser zoom are
  not claimed as tested. Automated accessibility is not universal conformance.
- No production deployment, backend endpoint, schema migration, artwork change or
  native redesign is included in this audit pass.
