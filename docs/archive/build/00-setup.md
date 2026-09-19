# Phase 0 — Cursor & Grok 4.6 setup

**Chapters 0–2** · Week 1 · **Prerequisite:** Nothing — start here.

> **How to use this file in Cursor**
>
> Don't paste the whole file. Either copy one chapter's prompt block into a
> **new chat**, or type `@docs/build/00-setup.md` and tell Cursor which chapter
> to run — referencing the file is cheaper than pasting it.
>
> One chapter = one chat. Set the effort rung shown. Verify *Done when*.
> Commit as `ch{NN}: <what you built>`. Then close the chat and open a new one.
>
> If the context meter passes ~150K mid-chapter, stop, commit what works,
> and restart with a narrower prompt. Grok 4.6's token rate doubles past
> 200K context.

---


## Chapter 0 — Configure the model correctly

Grok 4.6 in Cursor has **four effort rungs: low, medium, high (default), xhigh** ("Extra High"). Effort switching requires Pro or higher. The model has a **500K context window**, but token pricing (~$2/$6 per M in/out) **doubles past 200K context** — so a bloated chat is not just slower, it is literally 2× the cost.

It also has the full agent toolset: file search, grep, directory reads, web search, terminal execution, image reading, **browser control for screenshots and visual verification**, and rules retrieval.

### Effort routing table — use this for every chapter

| Effort | Use for | Chapters |
|---|---|---|
| **xhigh** | Architecture, schema design, algorithm work (adaptive TDEE), agent orchestration, debugging something you've already failed to fix twice | 1, 4, 8, 14, 18, 19, 26, 27 |
| **high** (default) | Normal feature implementation, multi-file edits, refactors | most chapters |
| **medium** | Boilerplate, CRUD screens, styling passes, test scaffolding, copy edits | 6, 11, 12, 24, 33 |
| **low** | Renames, formatting, one-line fixes | ad hoc |

**Rule of thumb:** if you cannot predict the shape of the answer, use xhigh. If you can, use high or below. Running everything on xhigh burns budget on work that does not need it; Cursor's own benchmarking shows xhigh and high land within ~1 point of each other on typical multi-file tasks.

### Session hygiene (non-negotiable)

1. **One chapter = one chat.** Start a new chat every chapter.
2. **Watch the context meter.** At ~150K, summarize and restart. Never let it cross 200K.
3. **Plan before code on xhigh chapters.** Ask for a plan, read it, approve it, *then* say "implement the approved plan."
4. **Let it use the browser.** For any UI chapter, end the prompt with "then open the browser, screenshot the result, and fix what looks wrong." Grok 4.6 has this tool — a screenshot is worth 1000 tokens of description.
5. **Commit after every chapter.** `git commit -m "ch04: adaptive TDEE engine"`. If a chapter goes sideways, `git reset --hard` is cheaper than arguing with the agent.
6. **Never paste secrets into chat.** Use `.env.local` and tell the agent the variable names only.

---

## Chapter 1 — Repo scaffold & rules files

**Effort:** xhigh (this sets the constitution for every later chapter)

Grok 4.6 has a rules-retrieval tool, so rules with good `description` fields get pulled in automatically when relevant. Write the descriptions like search queries.

### Step 1 — run the scaffold script (before you open Cursor)

The monorepo structure, workspace config, all six Cursor rules, the compliance
docs, and the PH core seed file are already written. Run:

```bash
bash kayamo-scaffold.sh kayamo
cd kayamo
pnpm create next-app@latest apps/pwa --ts --tailwind --app --src-dir --use-pnpm
cp .env.example .env.local
```

The script deliberately does **not** install app dependencies — `create-next-app`
pulls current versions instead of whatever was current when this guide was written.

### Step 2 — Cursor prompt

```
Effort: xhigh. Read AGENTS.md and .cursor/rules/000-project.mdc first —
the monorepo structure and constitution already exist. Do not restructure them.

PROJECT: "KayaMo" — a Filipino-first calorie + gym tracker with AI chat
logging. Solo developer. PWA first, Capacitor wrap later.

STACK (do not substitute):
- Next.js 15 App Router, TypeScript strict, Tailwind CSS v4
- Supabase (Postgres + Auth + Storage + Edge Functions)
- Drizzle ORM · Dexie.js · Vercel AI SDK · Zod
- Vitest + Playwright · pnpm workspaces + turbo

TASK — wire up the existing scaffold:
1. Rename apps/pwa's package.json to "@kayamo/pwa". Point its tsconfig at
   ../../tsconfig.base.json and verify the @kayamo/* path aliases resolve.
2. Create apps/admin as a second Next.js app named "@kayamo/admin", sharing
   the same presets. Minimal shell for now — auth gate only, no screens.
3. Build packages/config: shared eslint, prettier, tailwind, and tsconfig
   presets. Both apps consume them; neither redefines them.
4. Install the stack deps into the packages that actually use them
   (drizzle into @kayamo/db, dexie into @kayamo/offline, ai sdk into
   @kayamo/ai, and so on) — not into the root.
5. Set up Vitest at the workspace level and Playwright in apps/pwa.
6. Verify: pnpm typecheck, pnpm lint, and pnpm test all exit 0 across the
   whole workspace, and pnpm dev:pwa boots.
7. Commit as "ch01: workspace wiring".

Do NOT write feature code. Do NOT move or rewrite the existing rules files,
READMEs, or docs. Wiring only.
```

**Done when:** `pnpm dev:pwa` boots a blank page, `pnpm typecheck` / `pnpm lint` / `pnpm test` all exit 0 across the workspace, and `@kayamo/*` imports resolve from both apps.

**Watch out:** Grok will want to start building features, and it will want to "tidy" the folder structure into something it likes better. Stop it on both. The rules files are the highest-leverage thing in this entire build — everything downstream inherits them, and a mid-build restructure invalidates every path reference in the remaining 35 chapters.

---

## Chapter 2 — Design system

**Effort:** high

Pin the visual identity now so every later screen is consistent instead of accreting Tailwind defaults.

### Design brief to give it

The subject is a **gym logbook that lives in a canteen** — used sweaty at 6am and one-handed over a plate of rice at noon. Not a wellness app, not a clinical dashboard.

- **Palette:** deep ube base `#2A1B3D`, surface `#3A2A50`, calamansi accent `#C4E538` for progress/actions, rice `#F7F4ED` for text, `#E8734A` reserved *only* for over-target warnings, muted `#8B7BA8`.
- **Type:** a condensed grotesque for all numerals (weights, calories, macros — they should read like a scale display), a humanist sans for body, monospace for data tables.
- **Signature element:** the **trend ribbon** — a single continuous band on the home screen showing weight trend against target, replacing the standard bar-chart-plus-big-number layout. It is the one thing the app is remembered for.
- **Constraint:** dark-first, one-handed reachable, largest tap targets at the bottom third of the screen.

### Prompt

```
Effort: high. Read .cursor/rules/000-project.mdc first.

Build the design system for KayaMo as Tailwind v4 CSS variables + a small
set of primitives. Design brief:

[paste the palette / type / signature block above]

Deliver:
1. packages/ui/src/tokens.css with the token layer (colors, type scale, spacing,
   radii, motion durations). Every token named semantically
   (--color-surface, not --color-purple-800).
2. packages/ui/src/components/: Button, Card, Sheet (bottom sheet — this app is
   thumb-driven), NumberDisplay (the condensed-numeral component),
   TrendRibbon (the signature element, accepts a series of {date, weight,
   trend} and renders one continuous band with target overlay), Toast,
   EmptyState.
3. A /design-system route rendering every primitive in every state.
4. Respect prefers-reduced-motion. Visible keyboard focus everywhere.

Then open the browser, screenshot /design-system on a 390px viewport,
and fix anything that looks templated or cramped.
```

**Done when:** `/design-system` renders on a phone-width viewport and the trend ribbon reads clearly at a glance.

**Watch out:** the agent defaults to generic card-with-shadow layouts. If the screenshot looks like every other tracker app, tell it so directly and make it revise.

---
