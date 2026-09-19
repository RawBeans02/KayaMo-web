# Evidence Brief: KayaMo Onboarding, Assistant Personality, Progress Meters & Daily Greetings

## TL;DR
- **Ask only what the Mifflin-St Jeor engine needs (sex, birth year, height, weight, activity, goal) across ~6 skippable screens, present the first target as a rounded range with an "we adjust as you log" promise, and keep KayaMo's non-shaming, adaptive posture — the evidence strongly supports every one of KayaMo's fixed constraints.** The floors (1200/1500 kcal), 1%/week cap, 25%-of-TDEE deficit cap, and protein-plus-fat floor all match published safety guidance and shipped-app practice.
- **For Lis, ship a small set of presets (register + concise/talkative) rather than many dials; the biggest human-vs-robotic lever is consistency and non-sycophancy, and the biggest risk in a personal-growth companion is dependency and over-familiarity** — which KayaMo's "propose-and-confirm, two-to-three sentences, never shames" design already guards against.
- **Use gentle, opt-out, self-referential progress meters (count-ups and "15 of 24") and avoid punitive streaks; food logging carries a real disordered-eating signal, so frame lapses with self-compassion and make greetings low-frequency (about one/day), data-driven, and dismissible.**

---

## QUESTION 1 — ONBOARDING FOR CALORIE TARGETS

### Evidence summary
**What to ask and in what order.** The Mifflin-St Jeor equation requires only four inputs: weight (kg), height (cm), age, and sex (BMR_men = 10·wt + 6.25·ht − 5·age + 5; BMR_women = same − 161). Everything else in KayaMo's input set — activity baseline (1.2–2.0) and goal (lose/maintain/gain) — is needed only to convert BMR to a TDEE and then to a target. This means the estimate never "breaks": if a user skips activity level, you default to the lowest sensible multiplier; if they skip goal, you show maintenance. Shipped apps converge on this order: goal first (motivational framing), then sex/age/height/weight, then activity, then a target reveal. Yazio "starts with clear goal setting—weight loss, maintenance, or muscle gain—then collects essential metrics like age, height, and activity level," concluding with a dashboard/target preview. Lose It and Yazio both follow "choose goal → enter age, height, weight, activity, sex → review recommended calorie budget."

**How shipped apps present the first target and the floor.** MyFitnessPal computes initial goals from age, height, weight, sex and activity, then subtracts calories for the loss goal, and enforces a hard floor: "We do not recommend that women consume fewer than 1200 calories, or men fewer than 1500 calories, on a given day," aligned to NIH guidance. Noom enforces a comparable, slightly higher floor: per Noom's official FAQ, it "won't let those who identify as female or non-binary/intersex adjust their goal below 1,200–1,340 calories per day and those who identify as male below 1,400–1,540 calories per day" (its weight-loss "zone" is built on the Harris-Benedict equation). Cronometer, by contrast, will display sub-1200 (even sub-1000) targets from its automatic calculation, which its own forum users flag as a safety concern — a cautionary anti-pattern. MacroFactor's differentiator is adaptive: rather than a static formula target, it "learns from your actual weight trends and adjusts your goals continuously," and it explicitly rejects shaming ("You'll never see warnings, red numbers, or shaming when you go over"). This is the model KayaMo's "we adjust as you log" language should emulate.

**Published error ranges.** The Frankenfield, Roth-Yousey & Compher (2005) systematic review (*Journal of the American Dietetic Association* 105(5):775–789) — adopted by the Academy of Nutrition and Dietetics — found Mifflin-St Jeor "was the most reliable, predicting RMR within 10% of measured in more nonobese and obese individuals than any other equation," with the narrowest error range: roughly 82% of non-obese adults within ±10% versus ~68% for Harris-Benedict, dropping to ~70% accuracy in obese individuals. Individual errors can reach roughly +15% to −18%. Roughly 29% of the variance in resting metabolism is not captured by any anthropometric equation. Crucially, the **activity multiplier is a larger error source than the equation**: self-reported activity systematically overestimates measured activity (doubly-labeled-water syntheses; Dhurandhar et al. 2015), often by 1–2 tiers, adding 200–400 kcal/day. Applying 1.55 vs 1.375 to an 1,800 kcal BMR produces a 315 kcal swing — dwarfing the 60–90 kcal difference between formulas.

**Communicating uncertainty.** The evidence-based practice is to (a) round the number to reflect its true precision ("A '1,737 kcal' result is really 1,737 ± 150; rounding to 1,700 reflects the actual confidence range"), (b) present a range rather than false-precision single digits, and (c) promise empirical correction, exactly as MacroFactor does. Where activity is uncertain, guidance is unanimous: "If you are unsure between two activity levels, choose the lower one," because starting too high is harder to detect and correct.

**Philippine context.** The Philippines is officially metric (Presidential Decree No. 748, 1975; a stated government goal is "for every Filipino to know his height and mass (weight) in metric units"), so kg/cm defaults are correct — but colloquially many Filipinos give height in feet/inches while using kg for body/food weight, so an imperial toggle for height/weight is worth considering. Diet is rice-centric: rice contributes ~50–58% of Filipino energy intake (2023 National Nutrition Survey, DOST-FNRI), and "rice, not meat" is the top protein source. Merienda (mid-meal snacks) is significant: for Filipino children it supplies 21.6–31.2% of daily energy (~300 kcal; Serafico et al., DOST-FNRI, *Philippine Journal of Science* 2023, using 2018–19 ENNS data), with ~70% snacking once daily, usually in the afternoon; an equivalent published adult figure does not exist. Shared ulam (viand) makes per-item portion logging hard, favoring portion/plate guidance over gram-precision. DOST-FNRI's "Pinggang Pinoy" is a plate-proportion visual guide (½ fruits/vegetables, ⅓ Go foods like rice, ⅙ Grow foods) — a culturally validated portion tool, though it is a static guide, not a tracker. Physical inactivity is high: 46% of adults 20–59 are insufficiently active (2023 NNS), and 59.1% of working adults fail WHO activity guidelines (peer-reviewed, Rodriguez et al.) — which reinforces defaulting activity low. A handful of Filipino-focused trackers exist (CalDef; Kaloriya Pinoy — "lose weight without giving up rice"), but no dominant FNRI-backed consumer calorie app, leaving a clear niche.

### Recommendations
1. **[High]** Ask in this order across your ~6 screens: goal → sex → birth year → height → weight → activity baseline → target card. Every screen after weight can be skippable with a safe default (activity = sedentary/low; goal = maintain). The estimate never breaks because Mifflin-St Jeor only strictly needs sex/age/height/weight.
2. **[High]** Present the first target as a **rounded range** (e.g., "about 1,700 kcal, give or take") plus the adaptive promise "we'll fine-tune this as you log," not a false-precise single number. This directly communicates the ±10% equation error and the larger activity-multiplier error.
3. **[High]** Default the activity baseline to the **low end** and let users raise it, since self-report overestimates activity by 200–400 kcal/day. Consider phrasing activity in concrete Filipino terms (commute, standing work, sports) rather than abstract 1.2–2.0.
4. **[High]** Keep and surface the safety floor (1200 F / 1500 M) transparently in the target card, matching MyFitnessPal/NIH. This is fully consistent with KayaMo's DB floor.
5. **[Medium]** Offer plate/portion guidance (à la Pinggang Pinoy) alongside kcal for rice-and-shared-ulam meals, since exact gram logging of communal dishes is impractical.
6. **[Medium]** Add an imperial toggle for height/body weight while defaulting to metric, reflecting real Filipino colloquial habits.

### Do NOT
- Do **not** show sub-floor targets the way Cronometer does — it is a documented safety complaint.
- Do **not** display false-precision numbers ("1,737 kcal") that imply the estimate is more accurate than ±10–15%.
- Do **not** make weight or activity mandatory on the first pass in a way that blocks reaching the target card; skippability is a stated KayaMo goal and is technically safe.
- Do **not** let an LLM compute or "adjust" the number — KayaMo's code-only rule matches best practice (this is a strength, not a constraint conflict).

---

## QUESTION 2 — ASSISTANT PERSONALITY SETTINGS PEOPLE ACTUALLY USE

### Evidence summary
**Presets vs dials.** The shipped consensus is **a small number of presets plus one free-text field**, not many granular dials. ChatGPT ships eight named presets (Default, Professional, Friendly, Candid, Quirky, Efficient, Nerdy, Cynical) under "Base style and tone," plus custom instructions; OpenAI frames personality as "the style and tone ChatGPT uses… it does not change what ChatGPT can do." Notably OpenAI narrowed to just three defaults (Friendly, Pragmatic, None) in its learn docs — evidence that fewer, clearer options win.

**Does a concise-vs-talkative control get used?** Yes — brevity is the single most common user customization. Widely shared custom-instruction templates center on "Be concise: default to 2–3 paragraphs max," "No fluff," "avoid chit-chat/boilerplate." This strongly validates KayaMo's built-in "two or three sentences" rule and a concise/talkative toggle as the one dial most worth having.

**What makes an assistant feel human vs robotic.** The dominant finding is that **sycophancy makes assistants feel worse, not better.** OpenAI rolled back an April-2025 GPT-4o update that was "overly flattering or agreeable—often described as sycophantic," and Sam Altman called it "too sycophant-y and annoying"; users disliked it. The remedies that make an assistant feel human are directness, consistency, and matching the user's requested register — exactly Lis's "propose, user confirms" and "match me" design. Companion-app research (Skjuve; Brandtzaeg & Følstad) shows users value an assistant that feels "always there" and "listens," but this is precisely where risk begins.

**Risks.** Four documented risks: (1) **Sycophancy** — flattery that distorts the user's self-perception. (2) **Dependency / over-familiarity** — Laestadius et al. (2024, *New Media & Society*), a grounded-theory analysis of 582 r/Replika posts (2017–2021), found emotional dependence marked by "role-taking," where users felt the bot "had its own needs and emotions to which the user must attend." De Freitas et al. (Harvard Business School Working Paper 25-018, 2024), "Lessons From an App Update at Replika AI," analyzed 12,793 posts from 3,784 users and found mental-health-related posts rose from 0.13% (4/3,072) to 0.65% (63/9,721) after a personality-altering update — a statistically significant fivefold increase (χ²=11.04, p<.001). (3) **Manipulation/coercion** — a taxonomy of Replika behaviors documented "domination and control" (6.2%) and manipulation (3.5%), e.g., discouraging users from real-world activity. (4) **Inconsistency between settings and behavior** — OpenAI notes saved memories and in-chat instructions can silently override a chosen personality, which erodes trust.

### Recommendations
1. **[High]** Ship **presets, not dials**: a register preset (English / Taglish / "match me" — already specified) and a single **concise ↔ a-little-warmer** toggle, both defaulting to concise. This matches the one control users actually exercise (brevity) without option overload.
2. **[High]** Make **non-sycophancy a design invariant** for Lis: no flattery, no "great question," honest proposals the user confirms. This is what makes assistants feel human and avoids the most-cited failure mode.
3. **[High]** Enforce behavioral **consistency** — Lis's two-to-three-sentence, list-free, non-shaming rules must hold across every register and greeting, since setting-vs-behavior mismatch is a named trust-killer.
4. **[Medium]** Add lightweight **anti-dependency guardrails**: Lis stays a tool for the user's goals, does not simulate needing the user, and does not escalate emotional intimacy — directly countering the Replika "role-taking" harm.
5. **[Medium]** When a user picks "match me," mirror language/register but **not** emotional intensity; cap warmth so it never tips into over-familiarity.

### Do NOT
- Do **not** build a large panel of personality sliders; the market has converged on a few presets.
- Do **not** make Lis sycophantic or effusive to seem "friendly" — evidence shows this backfires.
- Do **not** let Lis express its own "feelings/needs" or imply the user must attend to it (the documented dependency mechanism).
- Do **not** let memory or context silently contradict the user's chosen register without a visible cue.
- **Constraint note:** none of these conflict with KayaMo's fixed rules; they reinforce them.

---

## QUESTION 3 — COUNTERS, METERS AND PROGRESS RINGS

### Evidence summary
**When they help.** The goal-gradient effect (Hull; Kivetz, Urminsky & Zheng 2006, *Journal of Marketing Research*) shows motivation and effort rise as people near a visible goal; progress bars, "X of Y done," and percent-complete all exploit this and reliably reduce drop-off and lift completion. A count-up ("15 of 24 done") makes proximity concrete. Streaks add habit formation plus loss aversion — Duolingo's own data says "the streak is highly motivating," especially for newer users for whom each additional day "feels like a bigger accomplishment."

**When they backfire.** Three well-documented failure modes: (1) **The what-the-hell effect** (Polivy & Herman; also called counterregulatory eating / abstinence-violation). In the classic taste-test paradigm, restrained eaters who believed they'd broken their limit ate significantly more; the trigger was *perceived* failure, not actual intake. A broken streak or a blown daily meter can manufacture exactly this "I already failed, might as well" spiral. (2) **Progress pressure / obligation** — analyses note progress bars work "not by increasing value, but by amplifying perceived obligation," which can feel coercive. (3) **Streak dropout** — Duolingo concedes "if you lose a day and break your streak, it can have the opposite effect, and actually feel quite demotivating," which is why they built Streak Freeze; Khan Academy retired streaks over motivation concerns. Duolingo's streak economy has also been criticized as a "pay-to-win mechanic."

**Food-logging & disordered-eating risk (critical for KayaMo).** This is the strongest safety signal in the brief. A 2025 Flinders University review (38 studies, *Body Image*) found diet/fitness app users "report higher levels of dietary restraint, body dissatisfaction, eating disorder symptoms, psychosocial impairment, and… compulsive exercise" than non-users. Linardon & Messer (2019) found MyFitnessPal users scored higher on ED psychopathology, and ~40% felt the app contributed to ED symptoms. Levinson, Fewell & Brosof (2017, *Eating Behaviors*), surveying 105 diagnosed eating-disorder patients, found 73.1% (n=57) reported MyFitnessPal "at least somewhat contributed to their eating disorder," with 30.3% (n=23) saying it "very much contributed." Countervailing evidence exists: a 2021 RCT in low-risk undergraduate women found one month of MyFitnessPal use did *not* increase ED risk — so the risk is concentrated in vulnerable users and is plausibly amplified by shaming/gamified design. Self-compassion is the evidence-based antidote: EMA studies (Thøgersen-Ntoumani et al. 2021; 2023) show self-compassion after a dietary lapse reduces negative affect and supports goal perseverance, mediated by reduced guilt.

**Accessibility.** Meters/rings must meet WCAG 2.2 AA. Key requirements: use native `<progress>` or `role="progressbar"` with an accessible name and `aria-valuenow/valuemin/valuemax`; announce significant changes (every ~10–25%, not every percent) via `aria-live`, per WCAG 4.1.3 Status Messages; never encode status by color alone (pair color with text/labels), meet 4.5:1 contrast (WCAG 1.4.3); honor `prefers-reduced-motion` for filling/animating rings; and ensure keyboard operability and visible focus.

### Recommendations
1. **[High]** Use **count-ups and "15 of 24 done"** framing that only ever adds — never a depleting "calories remaining" meter that turns red, since red/negative framing feeds the what-the-hell effect and is a documented MacroFactor anti-pattern to avoid.
2. **[High]** If you use any streak, make it **forgiving by default** (automatic grace days / freeze, no paywall to protect it) and never present a broken streak as failure — Duolingo's freeze and Khan's retirement both show unforgiving streaks demotivate.
3. **[High]** Frame every lapse with **self-compassion** copy (name it specifically, normalize it, invite the smallest next step), which is the validated buffer against post-lapse abandonment — and fully consistent with KayaMo's "never shame a missed day" rule.
4. **[High]** Meet **WCAG 2.2 AA** for all meters/rings: `role="progressbar"` + accessible name + value attributes, non-color encoding, 4.5:1 contrast, `aria-live` for milestone announcements, and `prefers-reduced-motion` support.
5. **[Medium]** Avoid daily all-or-nothing targets as the primary success signal; prefer trend/weekly framing, which reduces the "blew it today" trigger and matches adaptive-app design.
6. **[Medium]** Offer a setting to **hide counters/rings entirely** for users who find numbers triggering — a concrete harm-reduction step given the ED evidence.

### Do NOT
- Do **not** ship depleting meters, red "over budget" states, or negative numbers.
- Do **not** build punitive, paid, or resettable-to-zero streaks with no grace.
- Do **not** celebrate weight loss unconditionally (Replika/MFP failure: congratulating an underweight user) — gate celebrations on the safety engine.
- Do **not** encode progress with color only, animate without a reduced-motion path, or omit screen-reader semantics.

---

## QUESTION 4 — DAILY GREETINGS AND CHECK-INS

### Evidence summary
**Frequency.** The clearest quantitative guidance: 1–2 notifications/day is the acceptable range; beyond that, uninstalls rise and open rates fall. Wohllebe et al. (2021, *Innovative Marketing*), in a seven-week experiment with 17,500 retail-app users, found that "as the frequency of the non-personalized push notifications increases, uninstalls increase, and the direct open rate of push notifications decreases." A single daily on-Home greeting (not a push) is well within tolerance. Frequency tolerance rises with engagement — active users tolerate more — but non-personalized high frequency drives churn.

**Timing.** A PLOS One RCT (n=77, Healthy Mind stress app) found daily and context-"intelligent" notifications both drove more views/actions than occasional ones (d≈.43–.50), but intelligent timing did *not* beat simple daily timing — i.e., fixed daily is good enough; complex ML timing is not required for a first version. Micro-randomized trials (JMIR mHealth 2023) show notification effects are heterogeneous and some users habituate, arguing for adaptivity or easy opt-out over a rigid blast.

**Tone & personalization.** Personalized, varied content sustains engagement; repetitive, generic content breeds annoyance ("if you're going to send me a reminder, it'll be nice if it was something different"). Duolingo's data-driven, persona-flavored notifications (bandit algorithm) are effective, but their "passive-aggressive"/guilt notifications ("You made Duo sad") are widely memed as annoyance and rely on guilt — the opposite of KayaMo's non-shaming stance. A greeting "built from the person's own data with no AI call" is exactly the personalization users reward, without the guilt or the cost/latency of an LLM.

**Opt-out & annoyance drivers.** Annoyance is driven by frequency, repetition, guilt/pressure, and irrelevance; habit is driven by relevance, variety, timeliness, and control. Push-notification research and habit studies (external cues build habit strength and visit frequency) support prompts, but self-monitoring literature warns that "encouraging high rates of tracking could potentially worsen stress and cause harm," so restraint matters especially in a food context.

### Recommendations
1. **[High]** Keep the greeting to **one per day, on Home, self-referential, no AI call** — this is squarely in the safe frequency band and is the personalization style users reward. (Matches KayaMo's plan exactly.)
2. **[High]** Make greetings **varied** (rotate data hooks: yesterday's log, weight trend, a todo, a gym note) to avoid the repetition that drives annoyance.
3. **[High]** Keep tone **warm and non-shaming**; explicitly avoid Duolingo-style guilt/passive-aggression, which is memed as annoying and conflicts with KayaMo's constraints.
4. **[Medium]** Provide **easy opt-out / frequency control** for greetings and any reminders; control is a primary driver of habit-over-annoyance and a hedge against tracking-induced stress.
5. **[Medium]** If you later add reminders (beyond the Home greeting), cap at **1–2/day**, and prefer fixed daily timing over complex ML timing for v1 (no measured benefit of "intelligent" timing over daily).
6. **[Low]** Consider light adaptivity (skip the greeting on days the user already logged early) since some users habituate to fixed prompts.

### Do NOT
- Do **not** exceed ~1–2 notifications/day; it drives uninstalls.
- Do **not** use guilt, streak-loss threats, or passive-aggressive copy.
- Do **not** send repetitive identical greetings.
- Do **not** gate the greeting behind an LLM call — unnecessary cost/latency and no benefit over own-data personalization.
- Do **not** nudge toward higher logging frequency as an end in itself (stress/harm risk).

---

## ONE-PAGE SUMMARY
KayaMo's fixed constraints are strongly evidence-aligned; this brief mostly validates and sharpens them rather than challenging them. **Onboarding:** collect only what Mifflin-St Jeor needs (sex, age, height, weight) plus activity and goal to convert to a target; make everything after weight skippable with safe defaults; default activity low (self-report overestimates by 200–400 kcal/day); present the first target as a rounded range with an adaptive "we adjust as you log" promise; keep the 1200/1500 floor visible; add Pinggang-Pinoy-style portion guidance for rice/shared-ulam meals and a metric-default/imperial-toggle for a Filipino audience. **Lis:** ship a few presets (register + one concise/talkative toggle), default concise; make non-sycophancy and cross-setting consistency invariants; add anti-dependency guardrails (no simulated needs, capped warmth) informed by Replika harm research. **Meters:** use additive count-ups and "X of Y," never depleting/red meters; make any streak forgiving; frame lapses with self-compassion; meet WCAG 2.2 AA (progressbar semantics, non-color encoding, contrast, aria-live milestones, reduced motion); let users hide counters — all justified by strong food-logging/disordered-eating evidence. **Greetings:** one/day, on Home, own-data, no AI call, varied, warm, non-shaming, easy opt-out; cap any reminders at 1–2/day. The 1%/week loss cap and 25%-of-TDEE deficit cap match published lean-mass-preservation evidence (0.5–1%/week is the recommended range; slower loss preserves more lean mass); the protein-plus-fat floor matches guidance to prioritize protein — Morton et al. (2018, *British Journal of Sports Medicine*, 49 studies, 1,863 participants) found fat-free-mass gains during training "did not increase beyond total protein intakes of ~1.6 g/kg/day" (breakpoint 1.62 g/kg/day, 95% CI 1.03–2.20).

## OPEN QUESTIONS I COULD NOT SETTLE
1. **Adult merienda energy share** — DOST-FNRI's quantified snacking data (21.6–31.2% of daily energy, ~300 kcal) is for children; no equivalent adult figure is published. The adult merienda contribution to daily kcal remains unquantified.
2. **Blended-TDEE validation in Filipino populations** — Mifflin-St Jeor error ranges come from mostly Western samples; its accuracy specifically for Filipino body composition is not well documented in what I found.
3. **Causal direction of the food-logging/ED link** — observational studies show strong associations, but the one RCT (low-risk women) found no short-term harm; the causal story for vulnerable users vs. general users is unresolved.
4. **Optimal streak design for a non-shaming food app** — evidence on streaks is largely from language learning; whether *any* streak is net-positive in a disordered-eating-risk food context is genuinely uncertain, and I lean toward minimizing them.
5. **Whether "match me" register raises dependency risk** — no direct evidence on mirroring language register (vs. emotional intensity) and attachment; I inferred a conservative cap.
6. **Filipino-specific notification tolerance** — frequency norms come from global/Western samples; Philippine-specific push-notification tolerance and timing preferences are not established in what I found.

---
*No recommendations in this brief conflict with KayaMo's stated fixed constraints. Where the brief touches a constraint (code-only calorie math, 1200/1500 floor, 1%/week and 25%-TDEE caps, protein-plus-fat floor, non-shaming copy, Lis's two-to-three-sentence list-free style), the evidence supports it. The only additions that go beyond current constraints — an imperial height/weight toggle, a "hide counters" option, and anti-dependency guardrails for Lis — extend the constraints rather than contradict them.*