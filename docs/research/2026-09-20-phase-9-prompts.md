# Phase 9 prompts for claude.ai — onboarding, a human Lis, meters and counters

Written 2026-09-20 from the owner's five points after v1 shipped: no onboarding (so no
calorie target), no preference asking, Lis feels like a robot with no personality or
talkative/concise setting, too few counters and meters, not enough human interaction.

Decisions already made by the owner: onboarding collects body + goal + Lis preferences
(about six skippable screens, target shown at the end with its floor); Lis gets a daily
greeting on Home built from the person's own data, no AI call; demo guests get onboarding
stored on the device.

What the code already has, so the research and the designs build on it rather than
around it: the calorie engine (`packages/core/src/tdee.ts`, `targets.ts`) with the
1200/1500 floor enforced by a database trigger, unused because nothing writes the
profile; four Lis dials and a language register with no preset and no length control
(`packages/ai/src/persona.ts`); a week bar on the food screen with percent and remaining
kcal computed but never shown; Phase 7's readings, charts, stage ring and count-ups.

## How to use

1. Paste **Prompt A** into Claude chat with deep research on. Save the result as
   `docs/research/2026-09-20-onboarding-and-lis-research.md`.
2. Paste **Prompt B** into Claude design, with two or three screenshots of the Phase 7
   preview's Home and Grove attached. Export the mockups and notes under
   `docs/design/2026-09-20-phase-9/`.
3. Say "start phase 9". The build plan is in `docs/RELEASE.md` once the phase starts;
   anything the research contradicts is re-decided before code.

### Prompt A — Claude chat, deep research

Paste as one message with deep research on. Title: **Evidence brief for KayaMo
onboarding, assistant personality, progress meters and daily greetings.**

> **Product context (fixed constraints):** KayaMo is a Philippines-only personal-growth
> web app (calories, gym, todos) with an assistant named Lis. Lis proposes and the user
> confirms; Lis never speaks in lists and stays to two or three sentences. Calorie targets
> are computed by code (Mifflin-St Jeor plus a blended TDEE), never by an LLM; a floor of
> 1200 kcal (female) / 1500 kcal (male) is enforced in the database, and the engine also
> caps weekly loss at 1 % of bodyweight and the deficit at 25 % of TDEE, and raises the
> target to a protein-plus-fat floor. Copy is non-shaming: cheat, guilty, earned, burn it
> off, bad food and sinful are banned, and Lis never shames a missed day. Language register
> is English, Taglish, or "match me". Inputs available: sex, birth year, height (cm),
> activity baseline (1.2–2.0), goal (lose / maintain / gain), weight logs. Planned: about
> six skippable onboarding screens ending in a target card; a daily greeting on Home built
> from the person's own data with no AI call; demo guests store onboarding on device.
>
> **Research and return a decision-ready brief on four questions:**
>
> 1. **Onboarding for calorie targets in consumer apps.** What to ask, in what order, what
>    can be skipped without breaking the estimate. How shipped apps (MyFitnessPal, Lose It,
>    MacroFactor, Cronometer, Noom, Yazio, any Filipino apps) present the first target and
>    a safety floor. Published error ranges of Mifflin-St Jeor and activity multipliers, and
>    evidence-based ways to communicate that uncertainty (ranges, confidence wording, "we
>    adjust as you log"). Philippine context: rice-centric meals, merienda, shared ulam,
>    typical self-reported activity, metric habits, kcal targets versus portion guidance.
> 2. **Assistant personality settings people actually use.** Presets versus dials; whether a
>    concise-versus-talkative control gets used; examples from shipped products (ChatGPT
>    custom instructions and personality, Pi, Replika, Character.ai, Duolingo, Headspace,
>    Finch). What makes an assistant feel human rather than robotic; risks
>    (over-familiarity, sycophancy, dependency, inconsistency between settings and
>    behaviour).
> 3. **Counters, meters and progress rings.** Behavioural evidence for goal-gradient,
>    streaks, "15 of 24 done", percent-complete and count-ups; when they help and when they
>    backfire (shame, gaming, the what-the-hell effect, dropout after a broken streak).
>    Evidence specific to food logging and disordered-eating risk. Accessibility of meters
>    and rings (WCAG, screen-reader semantics, colour-only encoding, reduced motion).
> 4. **Daily greetings and check-ins.** Evidence on frequency, timing, tone,
>    personalisation from own data, and opt-out; what drives annoyance versus habit.
>
> **Output format:** for each question, a short evidence summary with citations
> (peer-reviewed where possible, product teardowns otherwise), then three to six concrete
> recommendations each tagged high / medium / low confidence, then an explicit "do not do"
> list. Close with a one-page summary and the open questions you could not settle. Flag any
> recommendation that conflicts with the constraints above instead of silently adapting it.

### Prompt B — Claude design

Paste as one message. Attach two or three screenshots of the current Home and Grove
(from the Phase 7 preview) so the style is anchored.

> **Product:** KayaMo, a Philippines-only personal-growth web app with an assistant named
> Lis. Produce mockups in a Liquid Glass style: frosted translucent surfaces, soft hairline
> strokes, one accent colour, large rounded pills, SF-style type, generous whitespace.
> Deliver light and dark for every screen. Use colour tokens by role, not hex: **ink**
> (primary text), **ink2** (secondary text), **stroke** (hairlines), **glass** (translucent
> surface), **accent** (the one brand colour), **danger** (only for genuine safety, never
> for a missed day).
>
> **Voice rules for any copy you place:** Lis proposes, the person confirms. Lis speaks in
> two or three sentences, never lists, never "Here are" or "Feel free to". No shaming words:
> cheat, guilty, earned, burn it off, bad food, sinful. A zero or empty state reads as
> neutral or inviting, never as failure.
>
> **Deliverables, each at desktop 1440 and phone 390:**
>
> 1. **Six skippable onboarding screens:** (a) welcome and what Lis is; (b) body basics:
>    sex, birth year, height in cm, current weight in kg, every field skippable; (c) activity
>    as a five-step pill picker from mostly sitting to very active; (d) goal: lose /
>    maintain / gain with a gentle pace choice; (e) how Lis speaks: a personality preset
>    row (for example Gentle, Balanced, Straight-talking), a concise-versus-talkative
>    control, and a language choice English / Taglish / Match me; (f) privacy and "you can
>    change any of this later". A step indicator that does not punish skipping.
> 2. **End-of-onboarding target card:** the daily kcal target, a plain-language line on
>    where it comes from, a visible floor note ("we never go below 1,200 / 1,500"), a "why
>    this number" expander listing the possible adjustments (weekly pace, deficit cap,
>    calorie floor, protein-and-fat floor), and a confidence cue that invites logging to
>    refine it.
> 3. **Home greeting line:** one line from Lis built from the person's own data, three
>    variants: first day, normal day, returning after a gap (warm, the gap is never a
>    failure).
> 4. **Meters and counters system:** percent ring, "x of y" counter, a horizontal meter
>    with a target tick, and a streak chip. For each show zero, partial, at target and over
>    target (neutral, no danger colour), plus a reduced-motion variant with no count-up or
>    sweep. Include an accessibility note per component: text alternative, minimum
>    contrast, colour never the only signal.
>
> Also provide a one-page token sheet and a spacing and radius scale so the components can
> be built as a system.

### Other human-friendly factors to fold in

- **Guests see a Lis personality form they cannot save.** The Settings page renders the
  companion form without the guest guard, and the API needs a session, so guests read
  "unavailable right now", which sounds like an outage. With on-device onboarding the
  preset saves locally for guests, and the copy says signing in keeps it.
- **Three different lockout sentences in the Lis area** (`mus-desk.tsx`, `mus-rail.tsx`,
  `mus-thread.tsx`). One sentence in Lis's own voice, and a sample exchange so a guest can
  see how Lis talks before signing in.
- **The target card explains adjustments, not only the floor.** `generateNutritionTarget`
  already returns `clampReasons` and `confidence`; "we slowed the pace to keep it safe"
  turns a silent clamp into trust, and the same reasons can feed the greeting on the day
  a target changes.
- **"no target yet" becomes an invitation.** The food screen's string deep-links into the
  body-basics screen, so the food page is the recovery path for anyone who skipped.
