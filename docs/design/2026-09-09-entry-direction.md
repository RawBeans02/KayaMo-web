# Approved entry-page and desktop presentation direction

Owner requested implementation of the September 8 login/Claude ZIP review on September 9, 2026. This document records the implemented selection; it does not replace the product source of truth.

## Selected

- Use the existing cream/forest semantic tokens, serif display headings, sans-serif body text and restrained borders. Preserve the existing night theme and offer a visible theme control on public entry pages.
- Use the existing transparent `public/mus-neutral.webp` for the landing, login and desktop sidebar. Do not reintroduce the opaque PNG into those surfaces. The other legacy companion states are not replaced in this pass.
- Adapt the Claude landing's product-first composition and kanin headline. Keep a short hero, three explanatory points, a demo CTA/FAQ and footer. The displayed meal is explicitly illustrative, with recipe estimates, not a claim of exact measurement.
- Demo-first, not waitlist-first. No invented launch dates, tester counts, competitor comparisons, automatic target changes, or unsupported photo/barcode claims.
- Public home remains reachable during a demo. Reopening a demo reuses a valid guest cookie instead of minting a new identity. Account sign-in does not claim to migrate demo entries.
- Login: a separate 400px form column, supporting welcome panel on desktop, form first on narrow screens. Keep actual authentication in the shared package; no duplicate desktop authentication implementation.
- Mus starts collapsed; existing expansion and keyboard toggle remain. Foods and Verify are grouped under Food catalog. No routes or product modules were deleted. Desktop shell remains a desktop surface, now available at 960px and above; full mobile diary support is not claimed.

## Shared-code handling

The user explicitly approved a targeted sync because the standard sync script refuses to overwrite the existing dirty shared directories. Only `packages/features/src/auth/login-form.tsx` was edited in the canonical `kayamo-mobile` repository, then copied to `kayamo-web`; the two files were compared byte-for-byte. No broad sync, reset, stash or overwrite of unrelated work was performed. Admin was not synced.

The shared form now has customer-facing email-link wording on desktop, clear sent feedback, resend cooldown based on elapsed time, a change-email focus action, recoverable request errors, and pending-state cleanup. Callback routing and the native/PWA ports remain unchanged. Google sign-in is not part of this verification pass.

## Reference precedence

`desktop-handoff/*.dc.html` and the supplied ZIP remain reference archives, not runnable production specifications. For the entry-page composition, demo CTA/copy, rail default and catalog grouping, use this decision plus the implemented source. Other parts of the old handoff remain reference material subject to the canonical product constraints. The larger five-tab product architecture remains an owner/product decision; this change does not invent or drop those modules.

## Not included

- A waitlist, deployment, external email campaign or public launch.
- Fabricated privacy/terms pages. Approved policy content and routes are still needed before public release; there are no dummy legal links.
- Full product readiness/security work from the separate whole-project audit.
- A full screen-reader audit, actual-device testing, real-email delivery or hosted authentication testing.

See `../audits/2026-09-09-entry-redesign/implementation.md` for verification and screenshots.
