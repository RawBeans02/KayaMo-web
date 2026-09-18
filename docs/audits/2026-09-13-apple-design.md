# KayaMo desk — Apple design conformance audit

Reviewed 13 September 2026. **Audit only; no application code was changed.**

Measured against Apple's fluid-interface principles (*Designing Fluid Interfaces*,
WWDC 2018; *The Details of UI Typography*, WWDC 2020; *Principles of Great Design*,
WWDC 2026) as translated to the web platform.

---

## Verdict

**The static craft is Apple-grade. The motion is absent — and motion is the thesis.**

KayaMo's typography, palette discipline, material direction and accessibility
signals are better than most shipping products. But Apple's core claim is that an
interface feels alive when it *responds instantly, moves continuously, carries
momentum, and can be grabbed mid-flight*. On that axis KayaMo scores near zero,
because it has essentially no motion system at all.

The single most consequential fact in this document:

> **`:active` appears 0 times in 1,604 live CSS rules, and there is no JavaScript
> equivalent. Nothing in the product acknowledges being pressed.**

The second most consequential:

> **36 of 36 interactive elements on the desk compute `transition-duration: 0s`.**
> Exactly one transition declaration is live in the entire loaded stylesheet set.

This is a *tractable* gap, not a rewrite. The design system already contains the
right primitives — they are declared and then bypassed (see AD-03).

---

## Method and limits

- Audited the running dev server at `http://localhost:3002` (pre-existing server
  on PID 43435; not restarted) at 1440×900.
- Static analysis across all 19 stylesheets (12,655 lines) and the interaction
  code in `src/` and `packages/`.
- Runtime probes via the browser: enumerated `document.styleSheets` rule
  selectors, and read `getComputedStyle` for every `button`, `a` and
  `[role="button"]` on the landing page and the demo Home screen.

**Not assessed.** Touch devices and real gesture input; screen-reader and full
keyboard traversal; light mode systematically (probes ran in dark mode); mobile
(`kayamo-app.module.css`) beyond static reading; §13 multimodal feedback
(haptics/sound), which is largely inapplicable to desktop web; print styles.

Counts below are reproducible with the commands in
[Verification](#verification).

---

## Scorecard

| § | Principle | State |
| --- | --- | --- |
| 1 | Response — feedback on pointer-down | **Fails** — no press feedback anywhere |
| 2 | Direct manipulation — 1:1 tracking | **Passes** — one gesture, correctly built |
| 3 | Interruptibility | **Fails** — nothing to interrupt; no motion |
| 4 | Behavior over animation (springs) | **Fails** — no spring library, no springs |
| 5 | Velocity handoff | **Fails** — no velocity tracked |
| 6 | Momentum projection | **Fails** — commits at release point |
| 7 | Spatial consistency / anchored origins | **Fails** — `transform-origin` used 0× |
| 8 | Hint in gesture direction | **N/A** — requires motion first |
| 9 | Rubber-banding at boundaries | **Fails** — hard clamp |
| 10 | Gesture detail (hysteresis, hit padding) | **Partial** — no threshold; 3 small targets |
| 11 | Frame-level smoothness | **Partial** — `will-change` 0×, `rAF` 0× |
| 12 | Materials & depth | **Passes** — with one caveat |
| 13 | Multimodal feedback | **N/A** — desktop web |
| 14 | Reduced motion & accessibility | **Passes** — with one landmine |
| 15 | Typography | **Passes** — strongest area |
| 16 | Design foundations | **Mostly passes** — consistency gap |

---

## What already conforms — preserve this

These are genuine strengths. **Do not regress them while fixing the rest.**

**Typography (§15) — the strongest area.** Tracking is size-specific exactly as
prescribed: display sizes carry `-0.04em`/`-0.05em`, small uppercase mono carries
`+0.06em`…`+0.16em`. `packages/ui/src/tokens.css` bundles size + line-height +
weight + tracking as a *set* per role rather than size alone. The mono ladder
(`--text-mono-3xs`…`--text-mono-lg`) is deliberately absolute px with a documented
reason. Most products ship one global `letter-spacing`; this does not.

**Accessibility signals (§14).** `prefers-reduced-motion`,
`prefers-reduced-transparency` and `prefers-contrast: more` are all handled, *and*
`src/shell/appearance-settings.tsx` offers System/Light/Dark plus a manual
reduce-transparency toggle. Per-user override of a system preference is §16.5
Flexibility done properly.

**Materials (§12).** 36 `backdrop-filter` declarations with blur scaling 12px →
26px by surface weight, paired `saturate()` boosts, and a
`@supports not (backdrop-filter: blur(1px))` fallback at `src/app/botanical.css:373`.

**Direct manipulation (§2).** `packages/features/src/desk/todos-timeline.tsx:105-141`
is correctly built: `setPointerCapture`, true 1:1 tracking computed from the grab
origin (not the element centre), continuous state updates during the drag,
`pointercancel` handling, and full keyboard parity (arrow keys, Shift to resize,
Escape, Delete). This is the right foundation to extend in AD-06.

**Restraint (§16.6).** The desk reads calm. Hierarchy is legible, nothing
decorative competes with content.

---

## Findings

Each finding is ID'd for tracking. Severity reflects how much it costs the *feel*
of the product, per Apple's own ordering (response first, everything else after).

### AD-01 · Critical · No press feedback anywhere (§1)

Apple calls response the foundation everything else is built on: *"Respond on
pointer-down, not on release. Highlight a button the instant it's pressed."*

**Evidence.** `:active` appears in **0 of 1,604** live CSS rules. There is no
JS-driven equivalent either — `data-pressed`, `isPressed` and `setPressed` all
return zero matches across `src/` and `packages/`. The only non-drag
`onPointerDown` in the codebase
(`packages/features/src/food/today-log.tsx:482`) starts a 450 ms long-press
timer; it sets no visual state.

**Current.** Pressing any button produces no visual change until the action
completes and the view changes.

**Target.** Every interactive element gains an `:active` state that fires on
pointer-down, ~100 ms, on compositor-friendly properties only.

```css
.ctaPrimary:active { transform: scale(0.97); transition: transform 100ms ease-out; }
```

**Where.** Add an `:active` sibling beside each existing `:hover` rule. The 15
current hover sites are the complete anchor list:

| File | Lines |
| --- | --- |
| `src/app/landing/landing.module.css` | 57, 58, 169 |
| `src/app/login/login.module.css` | 51 |
| `src/shell/shell.module.css` | 130, 206, 307, 335 |
| `src/shell/botanical-shell.module.css` | 55, 56 |
| `packages/features/src/screens/kayamo-app.module.css` | 486 |
| `packages/features/src/food/desk.module.css` | 210, 358 |
| `packages/features/src/botanical/botanical.module.css` | 234, 235 |

Note `:hover` does not exist on touch and is not a substitute for press feedback.

---

### AD-02 · Critical · No motion system (§3, §4)

**Evidence.** All **36/36** interactive elements on the demo Home screen and
**8/8** on the landing page compute `transition-duration: 0s`. Exactly **1**
transition declaration is live across all loaded stylesheets. No spring library
(`motion`, `framer-motion`, `react-spring`, `popmotion`) appears in any
`package.json`. `requestAnimationFrame` is used 0 times.

Total motion in 12,655 lines of CSS: one 240 ms `screen-in` keyframe, one 140 ms
opacity/transform pair, and three decorative infinite `bob` loops.

**Current.** Every state change is a hard cut.

**Target.** A motion layer. Two viable routes:

1. **Minimum** — tokenised CSS transitions on `transform`/`opacity` only, driven
   by the existing `--duration-fast` / `--ease-out` tokens. Fixes hard cuts; does
   *not* deliver §3 interruptibility.
2. **Correct** — add a spring library and use it for anything gesture-driven.
   Apple's parameters map to Motion's `bounce` + `duration`:

| Interaction | Damping | Response |
| --- | --- | --- |
| Move / reposition | `1.0` | `0.4` |
| Rotation | `0.8` | `0.4` |
| Drawer / sheet | `0.8` | `0.3` |

Default to **damping `1.0`** (critically damped, no overshoot). Add bounce
(~`0.8`) **only** where the gesture itself carried momentum — a flick or a throw.
Overshoot on a menu that merely faded in reads as wrong.

Avoid CSS transitions and `@keyframes` for anything a user can grab: they cannot
be smoothly reversed mid-flight. Springs animate from the *current* value, which
is exactly what interruption requires.

---

### AD-03 · High · The design system's button is bypassed by the new surfaces (§16.4)

This is why AD-02 measures zero, and it changes the shape of the fix.

**Evidence.** `packages/ui/src/components/Button.tsx:40` — the canonical button —
already wires the motion tokens:

```
transition-[filter,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]
```

It is imported by five surfaces, all mobile/legacy: `daily-loop.tsx`,
`today-log.tsx`, `food-search.tsx`, `quantity-form.tsx`, `add-product-form.tsx`.

The **new botanical desk and landing hand-roll bare `<button>` elements** with
bespoke CSS-module classes (`.ctaPrimary`, `.iconButton`, `.tool`, `.logFood`,
`.settings`) and no transition at all. `--duration-sheet` has **0** uses anywhere.

**Why it matters.** §16.4 Familiarity: things that look the same must behave the
same. Today a "button" means two different things depending on which era of the
codebase rendered it.

**Target.** Either route the new surfaces through `@kayamo/ui` `Button`, or lift
its interaction contract (transition + the AD-01 `:active`) into a shared class
the botanical modules compose. Also extend the canonical Button's transition to
include `transform`, which it currently omits.

---

### AD-04 · High · Reduced-motion block is a blanket kill (§14)

**Evidence.** `src/app/botanical.css:343-351`:

```css
@media (prefers-reduced-motion: reduce) {
  html[data-kayamo-web] *,
  html[data-kayamo-web] *::before,
  html[data-kayamo-web] *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```

**Why it matters.** Reduced motion does **not** mean no feedback — it means a
gentler, non-vestibular equivalent. Apple's guidance is to replace slides, springs
and parallax with short opacity cross-fades, drop elastic overshoot, and **keep
the opacity and colour changes that aid comprehension**.

Today this is harmless because there is no motion to suppress. The moment AD-01
and AD-02 land, reduced-motion users get hard cuts instead of cross-fades — and
`!important` on `*` means the gentle alternative cannot be expressed without
fighting this rule.

**Target.** Narrow it to suppress transforms and vestibular motion while
preserving opacity/colour transitions:

```css
@media (prefers-reduced-motion: reduce) {
  html[data-kayamo-web] * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-property: opacity, background-color, border-color, color !important;
    transition-duration: 150ms !important;
    scroll-behavior: auto !important;
  }
}
```

Fix this **before** AD-02, or the motion layer ships inaccessible.

---

### AD-05 · Medium · Nothing is anchored to its origin (§7)

**Evidence.** `transform-origin` appears **0 times** in the codebase.
Observed: the "Ask Mus" control sits at the top-right of Home; activating it
replaces the whole view with the full `/mus` screen instantly, with no spatial
relationship to the trigger.

**Why it matters.** *"If something disappears one way, we expect it to emerge
from where it came."* Menus, popovers and sheets should originate from the element
that triggered them, and enter and exit along the **same** path.

**Target.** Set `transform-origin` on overlay surfaces to their trigger's
position, and mirror the easing between enter and exit (inverse cubic-bézier
control points) so the outbound path matches the return.

---

### AD-06 · Medium · The timeline drag stops dead and clamps hard (§5, §6, §9, §10)

The fundamentals are right (see *What already conforms*); the physics are missing.

**Evidence.** `packages/features/src/desk/todos-timeline.tsx:105-141`.

| Gap | Detail |
| --- | --- |
| No velocity history (§5) | `move()` records position only — no timestamps, so release velocity is unknowable |
| No momentum projection (§6) | `up()` commits at the exact release point; a flick behaves like a slow drag |
| No hysteresis (§10) | `beginDrag` calls `preventDefault()` + `stopPropagation()` on pointer-down, so a 1 px wobble becomes a drag |
| Hard clamp (§9) | `packages/features/src/todo/timetable.ts:30` and `:33` use `Math.max(dayStart, Math.min(dayEnd - duration, …))` |

**Target.**

Track the last few `pointermove` samples with timestamps, then on release project
the landing point and hand the velocity to a spring. Apple's projection function —
note this is the exponential-decay form, **not** the textbook `v²/(2·decel)`:

```js
function project(initialVelocity /* px/s */, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}
const projected = currentPosition + project(releaseVelocity);
const target = nearestSnapPoint(projected);      // snap from the projection
animateSpringTo(target, { velocity: releaseVelocity });  // then hand off velocity
```

Replace the hard clamp with progressive resistance past the day bounds:

```js
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

Add a ~10 px movement threshold before committing to a drag, so taps stay taps.

Keep the existing keyboard path unchanged — it is correct and must not regress.

---

### AD-07 · Low · Three interactive targets below 44 px (§10)

Measured live on the demo Home screen:

| Target | Height | Location |
| --- | --- | --- |
| `KayaMo` brand link | 41 px | `botanical-shell` `.brand` |
| `Sign in · demo entries won't transfer` | 19 px | demo banner |
| `▾ Sign in to manage access` | 19 px | `mus-rail` `.permToggle` |

Most of the product already meets 44 px (icon buttons are exactly 44×44 at
`packages/features/src/botanical/botanical.module.css:226`; landing CTAs are
52 px). **Target:** add hit padding to bring these three to ≥44 px without
changing their visual size.

---

### AD-08 · Low · Missing frame and type hints (§11, §15)

- `will-change` — 0 uses. Add on elements whose motion is imminent, once AD-02
  lands. Do not apply it globally.
- `font-optical-sizing: auto` — 0 uses. Cheap win on the Source Serif display sizes.
- Sizing is **2,295 px values to 955 rem**. The mono ladder's px is deliberate and
  documented, but the broader ratio means a user who raises their browser font size
  gets text scaling inside fixed-px containers. Worth a pass on container padding
  and `max-width` values (§15 Dynamic Type).

---

## Recommended order of work

Ordered by felt improvement per unit of risk. **AD-04 precedes AD-02 deliberately**
— otherwise the motion layer ships inaccessible to reduced-motion users.

1. **AD-01** — press feedback. One `:active` rule per existing `:hover` site.
   Largest perceived improvement per line changed, and near-zero risk.
2. **AD-04** — narrow the reduced-motion block before any motion exists to trip it.
3. **AD-03** — unify the button contract so the fix applies everywhere at once
   rather than 15 times.
4. **AD-02** — the motion layer. Start with route 1 (tokenised transitions), adopt
   route 2 (springs) when a gesture actually needs interruption.
5. **AD-05** — anchor overlays to their triggers.
6. **AD-06** — upgrade the timeline drag: velocity → projection → spring → rubber-band.
7. **AD-07, AD-08** — hit padding, `will-change`, optical sizing, rem pass.

Items 1–3 are mechanical and safe. Item 4 is a genuine design decision (which
library, which defaults) and deserves a spike before committing.

---

## Verification

Re-run after changes; every count in this document comes from these.

```bash
# AD-01 — expect > 0 after the fix (currently 0)
grep -rn ":active" --include='*.css' src packages | wc -l

# AD-02 — motion declarations across all stylesheets (currently 16, mostly decorative)
grep -rn "transition:\|animation:\|@keyframes" --include='*.css' src packages | wc -l

# AD-05 / AD-08 — currently 0 each
grep -rn "transform-origin" --include='*.css' src packages | wc -l
grep -rn "will-change" --include='*.css' src packages | wc -l
grep -rn "font-optical-sizing" --include='*.css' src packages | wc -l

# AD-03 — --duration-sheet currently unused
grep -rn "var(--duration-sheet" src packages | grep -v node_modules | wc -l
```

Runtime check in the browser console — the two headline numbers:

```js
let active = 0, total = 0;
for (const s of document.styleSheets) {
  let rules; try { rules = s.cssRules } catch { continue }
  for (const r of rules) {
    if (!r.selectorText) continue;
    total++;
    if (r.selectorText.includes(':active')) active++;
  }
}
const els = [...document.querySelectorAll('button,a,[role="button"]')];
const still = els.filter(e => getComputedStyle(e).transitionDuration === '0s').length;
console.log({ activeRules: active, totalRules: total, zeroTransition: `${still}/${els.length}` });
// Baseline 13 Sep 2026 on /: { activeRules: 0, totalRules: 1604, zeroTransition: "36/36" }
```

---

## A note on scope

Apple's eight foundations (§16) are mostly well served here — Purpose, Agency
(the demo requires no account and states plainly where data lives), Responsibility
(Mus proposes, never writes unconfirmed), Simplicity and Craft in the static
layer. **Delight (§16.8) is described as the result of getting the other seven
right, not something added on top.** The gap in this audit is not decoration; it
is that the interface currently gives the user nothing back when they touch it.
Fixing AD-01 alone will change how the product feels more than any visual change.

---

# Addendum · Mus screen (light mode) — added 13 September 2026

The original audit probed the landing page and demo Home in **dark** mode and
listed light mode and per-screen composition as *not assessed*. This addendum
covers `/mus` in **light** mode at 1440×900, with a message sent so the thread
renders in its populated state.

**The findings above still hold here** — they are rule-level and global. `:active`
is 0 on this screen too, all its controls compute `transition-duration: 0s`, and
`mus-rail.module.css` `.permToggle` is one of the three sub-44px targets in AD-07.

What follows is **new** and composition-specific. IDs are `M-nn` to keep them
separate from the global `AD-nn` findings.

## M-01 · High · The same sentence renders twice, from two different roles

**Reproduce.** Open `/mus` in the demo, type anything, send.

**Evidence.** "Online Mus is not available in the local demo. Sign in to use it."
appears twice in the DOM from two distinct sources:

| Element | Class | Size | Role it implies |
| --- | --- | --- | --- |
| `div` | `kayamo-app_cocoBubble` | 15px | an assistant turn — Mus *saying* this |
| `p` | `kayamo-app_mutedNote` | 12.5px | a system status note |

**Why it matters.** §16 separates feedback into four kinds — status, completion,
warning, error. This conflates *assistant speech* with *system status*, then shows
the user the same sentence twice in one viewport. The demo's most common path is
also its least polished moment.

**Target.** Pick one owner. A capability limit is **status**, not something the
companion says — render it once as `.mutedNote` and drop the `.cocoBubble` copy.

## M-02 · Medium · "New conversation" uses the proposal metaphor

**Evidence.** Computed: `border: 1px dashed rgba(25, 34, 29, 0.2)`, radius 6px,
13px text, 44px tall.

**Why it matters.** §16.4 Familiarity — a metaphor must be honoured consistently.
In this design system a dashed border means *proposed / unconfirmed / not yet
real*: it is the treatment used for Mus proposals and for empty-slot hints
("Nothing yet — ⌘K to add"). "New conversation" is a committed primary action in
the panel that owns creation. Dashing it says the opposite of what it does.

**Target.** Give it a solid or ghost treatment consistent with other create
actions, and reserve dashed for genuinely provisional things.

## M-03 · Medium · The most layered screen uses no material at all

**Evidence.** Walking the surface stack from the composer upward returns
`backdrop-filter: none` at every level. The Mus screen has **zero**
`backdrop-filter` declarations — while the codebase as a whole has 36.

This is the screen with the most simultaneous chrome in the product: a left
Conversations panel, a centre thread, a right Context rail, a sticky thread
header, and a floating composer. The right rail *reads* translucent but is an
opaque tint.

**Why it matters.** §12 — translucent materials are how Apple conveys hierarchy
between a floating functional layer and the content beneath it, with content
scrolling under rather than a bar consuming a fixed strip. The product already
owns this vocabulary; this screen doesn't use it.

**Target.** Apply the existing glass treatment to the thread header and composer
so thread content scrolls under them, and let the right rail read as a lighter
material than the structural sidebar. Respect the existing
`prefers-reduced-transparency` and `@supports` fallbacks already in
`src/app/botanical.css`.

## M-04 · Medium · The keyboard affordance is invisible to sighted users

**Evidence.** `packages/features/src/screens/mus-thread.tsx:653` contains
"Message Mus. Enter sends. Shift+Enter starts a new line." — but it renders as a
`<label>` at **1×1px with `clip: rect(0,0,0,0)`**, i.e. screen-reader only.

Enter-to-send itself works correctly (`mus-thread.tsx:689` handles
`Enter` / `shiftKey` / `isComposing` properly). The behaviour is right; only its
discoverability is missing.

**Why it matters.** §16 Wayfinding — a screen should answer "what can I do here?".
Sighted users see only an icon button and have no reason to try Enter. The desk
design handoff specified a *visible* mono "Enter sends" line inside the composer
block.

**Target.** Surface a visible hint in the composer. Keep the sr-only label for
assistive tech.

## M-05 · Low · Redundant and inconsistent chrome

- **`state · neutral` renders twice** in one viewport — in the thread header and
  again in the right rail header. §16.6 Simplicity: every element earns its place.
- **Control type sizes disagree inside one panel** — "New conversation" is 13px,
  "Archive" is 16px, both 44px tall, both in Conversations. §16.7 Craft: values
  should be defensible, not incidental.

## M-06 · Note · Dead styling left by a redesign

`.cocoBubble` sets `border-bottom-left-radius: 4px` (a speech-bubble tail) on an
element that is also `background: transparent; border: 0; padding-left: 0`
(`kayamo-app.module.css:2850-2855`). The radius has nothing to render against.

Harmless, but it is a fossil: the rule outlived the treatment it was written for.
Worth clearing when that block is next touched.

## Two things that are correct and should not be "fixed"

Recorded here because both look like defects and are not:

1. **The asymmetric bubbles are deliberate.** The user's message gets a solid
   `var(--km-action)` bubble; Mus's reply is transparent with no border and no
   left padding (`kayamo-app.module.css:2850-2861`). This is an intentional later
   override of the earlier symmetric rule at `:1013-1026`, and it matches the desk
   design handoff, where the assistant speaks as plain text. It is also the
   prevailing convention in current chat UIs.

2. **The focus ring is heavy on purpose and should stay.** The composer takes
   `outline: 3px solid rgb(36,99,72)` at `outline-offset: 3px` — visually loud,
   but high-contrast and unambiguous. That serves §14; do not trim it for
   aesthetics.

## Correction to the original audit

The body of this document lists light mode under *Not assessed*. That now holds
only for screens **other than** `/mus`, which has been checked in light mode at
1440×900. Touch input, screen readers, and mobile remain unassessed.
