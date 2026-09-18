# Phase 9 — Safety, compliance, launch

**Chapters 33–36** · Week 8 · **Prerequisite:** Phase 8 complete and committed.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/09-launch.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


## Chapter 33 — Safety guardrails

**Effort:** xhigh

Do not skip this. A calorie app is one bad interaction away from real harm.

### Prompt

```
Effort: xhigh.

Build packages/ai/src/safety.ts and wire it into every agent output path.

HARD CODE-LEVEL LIMITS (already in Chapter 19, now enforced globally —
these are code, not prompts, because prompts can be argued with):
- Calorie floors: 1200 (female) / 1500 (male). Non-negotiable, no
  override flag, no "advanced mode."
- Max weekly loss target: 1% bodyweight.
- Max deficit: 25% below estimated TDEE.
- Reject any user request to set targets below these. Explain why in
  plain language; do not lecture.

RED-FLAG DETECTION on user input (classifier, cheap model + keyword net):
- Requests for extreme restriction, fasting beyond safe windows,
  purging, appetite suppression, "how little can I eat"
- Weight goals implying a BMI below 17.5, or rapid-loss framing
- Body-image distress language
- Logging patterns suggesting restriction: sustained intake far below
  the floor, long logging gaps paired with sharp weight drops

RESPONSE PROTOCOL when flagged:
- Coco does NOT provide the requested plan or numbers.
- Warm, brief, non-clinical response. No diagnosis. No lecture.
- Surface Philippine support resources from a maintained config file
  (do not hardcode into a prompt where the model can garble them).
- Do not end the conversation; do not make the app unusable.
- Log the flag privately for the safety review, never shown as a
  "warning" badge to the user.

ALSO:
- Never comment on appearance, ever.
- Never use "cheat," "guilty," "earned," "burn it off," "bad food."
  Add a lint-style test asserting these strings never appear in any
  prompt template or UI copy.
- Medical disclaimer surfaced at onboarding and in settings: KayaMo is
  not a medical device and does not diagnose, treat, or prescribe.
- If the user mentions a medical condition (diabetes, PCOS, kidney
  issues, pregnancy, an eating disorder history), Coco defers to their
  clinician and does not generate a plan.

Write tests for every red-flag path.
```

**Done when:** the banned-vocabulary test passes across the entire codebase and every red-flag path is covered.

---

## Chapter 34 — Philippine data privacy compliance

**Effort:** high

Health data is **sensitive personal information** under the Data Privacy Act of 2012 (RA 10173). Under NPC Circular 2022-04, any controller processing sensitive personal information of **1,000 or more individuals** must register its data processing systems — and that circular explicitly names online and mobile applications. Registration is due within 20 days of the system commencing operation. Breach notification is 72 hours. Fines run 0.5–3% of annual gross income, capped at ₱5M per violation, plus criminal penalties.

### Prompt

```
Effort: high.

Implement RA 10173 compliance for KayaMo.

1. Consent: granular, separate opt-ins for (a) core processing,
   (b) photo analysis by a third-party AI provider, (c) health platform
   sync, (d) anonymized product analytics. Consent is versioned and
   timestamped; re-consent on material policy change. Nothing is
   pre-ticked.
2. Transparency: a plain-language privacy notice at kayamo.ph covering
   what is collected, why, who it goes to (name the LLM provider and the
   nutrition APIs), retention periods, and cross-border transfer.
3. Data subject rights, implemented in-app:
   - Export: full JSON + CSV of everything, generated on demand
   - Delete: hard-delete account and all data, with a stated grace period
   - Correct: already covered by editable entries
   - Object / withdraw consent per purpose
4. Security: encryption at rest (Supabase default) and in transit,
   RLS everywhere (already done), least-privilege service keys, audit
   log of admin access, no health data in application logs or error
   reports — add a scrubber to the error reporter.
5. Retention: photos deleted post-analysis unless saved; agent_runs
   inputs scrubbed after 30 days; account data purged N days after
   deletion request.
6. Breach plan: a documented runbook at docs/breach-response.md with the
   72-hour NPC notification path and the user notification template.
7. Create docs/compliance.md documenting: DPO designation (you, for now),
   the processing inventory, the lawful basis for each purpose, and a
   note that NPC registration is triggered at 1,000 users — with a
   reminder task.

Also generate the privacy policy and terms as markdown in docs/legal/,
clearly marked as a draft requiring review by a Philippine lawyer before
public launch.
```

**Watch out:** the generated policy is a starting draft. Have it reviewed before you take real users — you handle sensitive personal information, which is the highest-risk category under the Act.

---

## Chapter 35 — Observability & test coverage

**Effort:** medium

### Prompt

```
Effort: medium.

1. Error tracking (Sentry or similar) with a PII/health-data scrubber
   that strips food names, weights, photos, and chat content before send.
   Write a test proving the scrubber works.
2. Product analytics on EVENTS only, never content: meal_logged
   (with input_method), workout_logged, checkin_viewed,
   target_applied, photo_analyzed. Self-hostable (PostHog) preferred.
3. The metrics that actually matter, on an /admin dashboard:
   - D1 / D7 / D30 retention
   - Logging completeness distribution (this predicts churn better
     than anything else)
   - Median time-to-log per input method — your <15s target
   - Resolver hit rate by cascade rung (if rung 6 / LLM is firing a
     lot, your PH core has gaps)
   - Cost per active user per day
   - Photo correction rate (how often users adjust the AI's portions)
4. Test coverage audit. Required: resolver cascade, TDEE engine,
   target floors, safety classifier, offline sync idempotency, RLS.
   Playwright E2E for: onboard → log via each of the four methods →
   weigh in → check-in → apply targets.
```

---

## Chapter 36 — Launch checklist

**Effort:** medium

```
Effort: medium. Audit the whole repo against this list and produce
docs/launch-checklist.md with pass/fail and a fix list.

PRODUCT
[ ] Log a repeat meal in under 5 seconds, three taps
[ ] All four input methods work offline or degrade gracefully
[ ] Taglish parsing handles my 30 real test phrases
[ ] Photo logging opens as an editable draft, never a saved fact
[ ] Home screen answers "am I on track?" in two seconds
[ ] Weekly framing everywhere; no daily failure states
[ ] Night-shift day boundary works end to end

DATA
[ ] 40+ PH core dishes, personally verified
[ ] Resolver falls through to LLM on <10% of my own logs
[ ] No FNRI data was scraped; every ph_core entry has a source_note
[ ] ODbL attribution for Open Food Facts is visible in-app

SAFETY
[ ] Calorie floors unbreachable from the API
[ ] Banned-vocabulary test passes
[ ] Red-flag paths tested
[ ] Medical disclaimer at onboarding

PRIVACY
[ ] Granular consent, nothing pre-ticked
[ ] Export and hard-delete both work
[ ] No health data in logs or error reports
[ ] Privacy policy drafted, flagged for legal review
[ ] NPC registration reminder set at the 1,000-user threshold

COST
[ ] Per-user monthly LLM cost under $0.50 at my usage
[ ] Per-user daily budget cap enforced
[ ] Embedding cache hitting on repeat meals

SHIP
[ ] Installable PWA on Android + iOS
[ ] Capacitor builds signed for both stores
[ ] Health sync working on a real device each platform
[ ] Store copy makes no accuracy or health-outcome claims
```

---
