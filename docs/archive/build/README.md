# KayaMo — build prompts

37 chapters, 10 phases. Each chapter is one Cursor session.

## Phases

| # | Phase | File | Chapters | Week |
|---|---|---|---|---|
| 0 | Cursor & Grok 4.6 setup | [`00-setup.md`](./00-setup.md) | 0–2 | 1 |
| 1 | Data foundation | [`01-data-foundation.md`](./01-data-foundation.md) | 3–5 | 1 |
| 2 | The food data layer | [`02-food-data.md`](./02-food-data.md) | 6–9 | 2 |
| 3 | Logging surfaces | [`03-logging-surfaces.md`](./03-logging-surfaces.md) | 10–13 | 3 |
| 4 | AI logging | [`04-ai-logging.md`](./04-ai-logging.md) | 14–17 | 4 |
| 5 | The coaching engine | [`05-coaching-engine.md`](./05-coaching-engine.md) | 18–21 | 5 |
| 6 | The training side | [`06-training.md`](./06-training.md) | 22–24 | 6 |
| 7 | Agents | [`07-agents.md`](./07-agents.md) | 25–28 | 7 |
| 8 | Mobile | [`08-mobile.md`](./08-mobile.md) | 29–32 | 8 |
| 9 | Safety, compliance, launch | [`09-launch.md`](./09-launch.md) | 33–36 | 8 |
| — | Reference | [`99-reference.md`](./99-reference.md) | — | — |

## Before you start

```bash
bash kayamo-scaffold.sh kayamo
cd kayamo
pnpm create next-app@latest apps/pwa --ts --tailwind --app --src-dir --use-pnpm
cp .env.example .env.local
```

Then open the repo in Cursor. The six `.cursor/rules/*.mdc` files are already
written — Grok 4.6 retrieves them by description, so you rarely need to
mention them explicitly after Chapter 1.

## Effort routing

| Rung | Use for |
|---|---|
| `xhigh` | Architecture, schema, algorithms, agent design, a bug you've already failed to fix twice |
| `high` | Normal feature work, multi-file edits, refactors |
| `medium` | Boilerplate, CRUD screens, styling, tests, copy |
| `low` | Renames, formatting, one-liners |

Every chapter below states its rung. Running everything on `xhigh` wastes
budget; Cursor's own benchmarking puts `xhigh` and `high` within about a
point of each other on typical multi-file tasks.

## Progress


**Phase 0**

- [ ] Ch 0 — Configure the model correctly
- [ ] Ch 1 — Repo scaffold & rules files
- [ ] Ch 2 — Design system

**Phase 1**

- [ ] Ch 3 — Supabase project & auth
- [ ] Ch 4 — Core schema & RLS
- [ ] Ch 5 — Offline layer

**Phase 2**

- [ ] Ch 6 — Source adapters (USDA + Open Food Facts)
- [ ] Ch 7 — The PH core dataset
- [ ] Ch 8 — The resolver cascade
- [ ] Ch 9 — User contributions & label OCR

**Phase 3**

- [ ] Ch 10 — Quick log & meal templates
- [ ] Ch 11 — Manual search UI
- [ ] Ch 12 — Barcode scanning in the browser
- [ ] Ch 13 — Weight, trend, and the home screen

**Phase 4**

- [ ] Ch 14 — Taglish natural-language logging
- [ ] Ch 15 — Photo logging (honest version)
- [ ] Ch 16 — The chat surface
- [ ] Ch 17 — Cost guard & model routing

**Phase 5**

- [ ] Ch 18 — Adaptive TDEE
- [ ] Ch 19 — Macro targets & day types
- [ ] Ch 20 — The weekly check-in
- [ ] Ch 21 — Schedule awareness

**Phase 6**

- [ ] Ch 22 — Exercise library & workout logger
- [ ] Ch 23 — Progression engine
- [ ] Ch 24 — Linking training to nutrition

**Phase 7**

- [ ] Ch 25 — Agent architecture
- [ ] Ch 26 — Coach agent + RAG over your own history
- [ ] Ch 27 — Planner agent (PHP-aware)
- [ ] Ch 28 — Proactive nudges

**Phase 8**

- [ ] Ch 29 — PWA hardening
- [ ] Ch 30 — Capacitor wrap
- [ ] Ch 31 — Health data sync
- [ ] Ch 32 — Store submission

**Phase 9**

- [ ] Ch 33 — Safety guardrails
- [ ] Ch 34 — Philippine data privacy compliance
- [ ] Ch 35 — Observability & test coverage
- [ ] Ch 36 — Launch checklist

## The rule that matters most

From the end of Week 3, log every meal in KayaMo and nothing else. Bugs you
hit as a user jump the queue ahead of the roadmap. A tracker you personally
abandon in week 2 will not survive contact with anyone else.
