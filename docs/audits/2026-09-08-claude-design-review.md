# KayaMo: login and Claude design review

Reviewed 8 September 2026. Review only; no application changes made.

## Verdict

The supplied login screenshot looks unfinished. Claude's landing is a substantially stronger visual direction, but the ZIP is a collection of design prototypes, not a production-ready replacement. Adopt selected composition, typography, spacing and assets; do not adopt its launch plan, claims or implementation wholesale. It contains no dedicated login design.

## Evidence and limits

- User archive: `/Users/rovs/Downloads/KAYA MO DESKTOP.zip`; inspected archive contents, HTML, scripts, assets and handoff documents. Attachment instructions were treated as reference, not implementation authority.
- User login screenshot: `/var/folders/5q/1p_1xg4d0mx_t87dpzzn1spw0000gn/T/codex-clipboard-ff079cfb-3136-4e7a-ad80-cb923b7a29ee.png`.
- Rendered extracted reference locally at 1440 × 900. Followed the landing's waitlist CTA without submitting an email. Inspected desktop reference and source for variant differences.
- This is not a complete authenticated-flow, mobile-device, keyboard or screen-reader audit. Design exports do not prove backend functionality or current product capabilities. The deployed screenshot may differ from the changing local worktree.
- Two initial screenshots were rejected for stale viewport/capture-stitching problems; neither supports these findings. Accepted captures are numbered 03–05.

## 1. Existing login — poor

![User-provided login screenshot](/var/folders/5q/1p_1xg4d0mx_t87dpzzn1spw0000gn/T/codex-clipboard-ff079cfb-3136-4e7a-ad80-cb923b7a29ee.png)

The cream/green palette and warm character are salvageable. The composition is not: a tiny mobile-style stack floats in a huge desktop canvas; the mascot squeezes the explanatory text into a narrow column; heavy shadows and oversized corners make two disconnected cards feel ornamental instead of purposeful.

The black square is an asset defect. `src/app/login/login-view.tsx:36` selects `/mus-neutral.png`; image metadata confirms that file has no alpha channel. The ZIP's `assets/mus-neutral-full.png` has transparency. This is not a reason to remove Mus; it is a reason to use a correctly exported, appropriately sized asset.

“Pasok muna.” is not the core problem. The long keyboard-shortcut explanation is poorly timed. Users need to understand the sign-in action, not the future command palette.

Recommended replacement: one coherent 360–420 px form column, with a quiet brand/product panel beside it only where space permits. Use a small transparent Mus, a stable wordmark, restrained borders/shadows, and readable paragraph widths. Mobile should prioritize the form. Suggested copy: “Sign in to KayaMo” / “Enter your email. We'll send you a sign-in link—no password needed.” / “Email me a sign-in link.” Include clear pending, sent, resend, change-email, expired-link and error states, plus working home/privacy/terms links. These are acceptance requirements, not a claim that every state is absent from current code.

## 2. Claude landing hero — strong direction, misleading copy

![Claude landing hero](/Users/rovs/Documents/KayaMo/kayamo-web/docs/audits/2026-09-08-claude-design/03-claude-landing-hero.png)

Keep the specific kanin headline, editorial heading typography, cream/forest palette, two-column composition and concrete food-logging example. Product proof receives more attention than the mascot. This feels much more intentional than the current login.

Change before shipping:

- Remove “Every other app is built on an American food database.” It is an unsupported blanket competitor claim. The later hardcoded competitor search example is not evidence of actual competitor behavior.
- Review photo, barcode, memory and adaptive-target promises against working desktop features. Replace “Mus adjusts your calorie target” with language that makes suggestion, deterministic calculation and user confirmation clear.
- Verify every catalog count, tester count and launch date. The archive includes staged status examples and an end-of-2026 waitlist promise; these are not approved facts.
- Shorten the page. The rendered desktop document is about 5,378 px tall. A focused hero, product demonstration, capabilities/limitations section and final CTA would communicate the narrow proposition more efficiently.
- Choose demo-first versus invitation/waitlist-first deliberately. A design export should not silently change the launch strategy.
- Build genuinely fluid layouts. The reference offers explicit desktop/mobile variants; showing both does not establish automatic responsiveness or intermediate-width behavior.

## 3. Claude waitlist — visually clear, functionally simulated

![Claude waitlist](/Users/rovs/Documents/KayaMo/kayamo-web/docs/audits/2026-09-08-claude-design/04-claude-waitlist.png)

The warm headline, clear input/button pairing and isolated transparent character are effective. The focus ring is visible in the captured state.

However, `KayaMo Landing.dc.html`'s `onSubmit` handler validates an email and sets `joined: true`; it does not persist or submit the address. Navigation sign-in links and footer privacy/terms/contact links use `href="#"`. This is legitimate prototype behavior, but it must not be mistaken for completed functionality. Privacy and messaging promises require an actual implementation.

## 4. Claude desktop — coherent but over-dense

![Claude desktop](/Users/rovs/Documents/KayaMo/kayamo-web/docs/audits/2026-09-08-claude-design/05-claude-desktop.png)

The diary is scannable and the shared typography, restrained surfaces and useful numerical emphasis establish a recognizable product. The visible proposal card makes a before/after change explicit.

The default screen nevertheless overemphasizes internal mechanics: Verify, provenance, module readability and a high-risk target proposal compete with the basic task of logging food. The permanent assistant column consumes valuable diary width. Small, pale metadata and tiny row controls are readability/target-size risks that need measurement and interaction testing, not a screenshot-only compliance verdict.

Prefer a simpler primary navigation, move catalog verification into a clearly appropriate secondary workflow, and make the assistant collapsible. Do not open with a large target-change proposal unless the user actually requested or needs it. Keep confirmation proportional to risk; avoid forcing every routine manual log through an AI-style approval ceremony.

This ZIP contains competing desktop versions. The main `KayaMo Desktop.dc.html` and `KayaMo Mus Rail.dc.html` are byte-for-byte identical to the matching files already in `docs/design/desktop-handoff/`. The differently named “current build” prototype has another navigation arrangement; its title does not establish production truth. Select one approved reference and retire conflicting instructions before implementation.

## Recommended order

1. Correct the mascot asset and rebuild the login composition; preserve existing authentication behavior.
2. Approve Claude's landing visual direction after removing unverified claims and deciding the primary CTA.
3. Consolidate tokens, typography, asset variants and navigation into one reference.
4. Implement real navigation/form states and test desktop, narrow windows, mobile, zoom, keyboard and screen readers.
5. Address the product and reliability findings in the separate whole-project review. Attractive screenshots do not resolve those issues.

The Product Design audit workflow grounded this assessment in rendered screenshots and source checks rather than the archive's assertions of completion. No redesign or production change was performed.
