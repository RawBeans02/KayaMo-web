# Entry redesign — implementation and verification

Implemented the approved login/landing review in the existing app. No deployment or real sign-in email was sent.

## Delivered

- Rebuilt login with a separate readable form, transparent companion, mobile-first form order and no glass-card stack.
- Adapted Claude's cream/forest product-first landing, with honest sample values, source/portion caveats, useful FAQs, working sign-in and demo actions, and no waitlist or unsupported launch claims.
- Added public theme controls; preserved keyboard focus visibility and existing account/auth callback behavior.
- Improved shared sign-in success/error/pending states, elapsed-time resend cooldown and change-address action at the canonical mobile source; targeted sync to web was explicitly approved.
- Made home reachable during a demo and preserved guest identity when resuming.
- Defaulted Mus to collapsed, grouped catalog tools secondarily, enlarged desktop navigation targets, and lowered the desktop shell's width gate from 1280 to 960px. The food diary is not claimed to be a mobile layout.
- Preserved all unrelated pre-existing worktree edits.

## Verification

- `pnpm exec playwright test e2e/entry-pages.spec.ts e2e/smoke.spec.ts`: **12 passed**. Covers entry layouts at 320/390/768/1024/1440px, form-first mobile ordering, day/night persistence, keyboard focus, guest resume identity, mocked email success/resend/cooldown, rate limiting, callback messages and both rail toggle directions. All submitted OTP requests were intercepted; no real emails were sent.
- `pnpm lint`: **passed**, including all workspace packages.
- `pnpm --filter @kayamo/features typecheck`: **passed**.
- `pnpm --filter @kayamo/features test`: **137 passed** across 31 files.
- Root Vitest tests: **5 passed**.
- `git diff --check`: **passed**.
- Shared login source/copy: **byte-for-byte equal**.
- `pnpm build`: webpack compilation succeeded; full build **blocked** by existing TS2532 errors in `scripts/build-demo-catalog.ts:33` and `:34`.
- `pnpm exec tsc --noEmit`: the same two existing demo-catalog errors.
- `pnpm test`: **not fully green**; stops at the same three pre-existing meal-label/default-locale failures in `packages/food/src/quick-log.test.ts`. These were not weakened or rewritten.

The older smoke test now expects the approved login wording. Existing shell/Mus tests explicitly expand the rail before their existing open-rail assertions; those width, overflow and permission assertions were retained. Their authenticated workflows were not rerun here because the new entry tests cover the changed shell behavior without sending sign-in emails or changing account permissions.

## Visual evidence

Use the `verified-*` screenshots captured by the regression browser. Earlier in-app browser captures have viewport scaling/cropping inconsistencies and are not the final comparison evidence.

### Desktop sign-in, 1440px

![Desktop sign-in](/Users/rovs/Documents/KayaMo/kayamo-web/docs/audits/2026-09-09-entry-redesign/verified-login-desktop.png)

### Desktop landing, 1440px

![Desktop landing](/Users/rovs/Documents/KayaMo/kayamo-web/docs/audits/2026-09-09-entry-redesign/verified-landing-desktop.png)

### Mobile sign-in, 390px

![Mobile sign-in](/Users/rovs/Documents/KayaMo/kayamo-web/docs/audits/2026-09-09-entry-redesign/verified-login-mobile.png)

The local-development bypass visible in screenshots is the existing development-only control, not a production login option. Legal policy content, full accessibility testing and the wider readiness audit remain separate work. This redesign is not a claim that the entire product is ready to launch.
