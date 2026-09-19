# Dependency remediation and support handoff — September 15, 2026

Scope: existing website release fixes, no new product features or visual redesign.
No commit, push, production promotion, secret change or production data mutation.

## Targeted changes

- Next.js and eslint-config-next: 16.3.1 → 16.3.3, the patched release identified
  by the two critical advisories found in the September 14 audit.
- Drizzle ORM: ^0.44 → ^0.45.2. Canonical `kayamo-mobile/packages/db/package.json`
  changed first; equivalent one-line sync applied to web, with each lockfile updated.
  The canonical installation was lockfile-only; native app code was not run.
- Narrow web dependency override: `@ai-sdk/provider-utils@3>undici` → 6.28.0.
  Retains current AI SDK major and checks its Agent/custom-DNS/fetch API on loopback.
  No live OpenAI request or credential change. Existing key reuse was already authorized.
- Narrow web override: `next@16.3.3>sharp` → 0.35.4.
- `scripts/check-security-dependencies.mjs`: checks resolved patched versions,
  Drizzle SQL identifier escaping and the SDK HTTP client's loopback compatibility.
- CI now runs that check and fails on high/critical production dependency advisories.

The overrides are deliberate compatibility patches. Revisit them when upgrading
the parent libraries; do not silently remove them or assume the mobile runtime
inherits root web overrides.

## Evidence

- Before: production audit reported 16 advisories (2 critical, 5 high, 7 moderate, 2 low).
- After final dependency resolution: **zero production advisories** in
  `/private/tmp/kayamo-security-final-audit.json`. This is not a comprehensive security
  audit or proof that every application path is safe.
- Full browser suite after Next/Drizzle/Undici changes: **141/141 passed**, three
  engines, `/private/tmp/kayamo-security-browsers.log`. This preceded the final sharp
  patch and newer UI edits observed on September 15; do not claim it covers those edits.
- Final current-tree typecheck/lint/unit/build, compatibility and disposable-database
  results will be recorded after completion. Docker was initially stopped; it was
  started to retry only the isolated project on ports 55321/55322.

## USDA remains unresolved

The key currently loaded from the web `.env.local` returned **403 / API_KEY_INVALID**
in a generic lookup. The expected variable `USDA_FDC_API_KEY` exists. No key values
or raw upstream response bodies were displayed. The owner's completion of key
retrieval does not yet establish that the local app or deployment has a usable value.
Replace the local value and separately confirm hosting configuration, then verify.

## Owner support / policies

Confirmed email: **help.kayamo@gmail.com**. See `legal/README.md` for support copy,
privacy/terms drafts and the accessibility statement. Operator legal name and
jurisdiction are still unconfirmed. Proposed retention/age policies are clearly
marked proposals, not implemented automation or approved public promises.

Domain ownership is acknowledged. Search Console verification is separate and is
not a blocker to local design work. Preview approval, hosted auth/AI/provider smoke,
manual accessibility review and rollback verification remain release gates.

## Sources

- [Next.js image-optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)
- [Next.js Windows-hosted advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
- [Drizzle identifier-escaping advisory](https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9)

Version matches indicate required remediation, not evidence of compromise. In
particular, the Windows-specific advisory is not evidence of that exposure on this Mac.
