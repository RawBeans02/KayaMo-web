# Tutorial application — September 14, 2026

Source reviewed in full: owner's `tutorial_compilation.md` (14 clips, 532 lines).
The source is reference material, not an instruction to install tools, change pricing,
modify the source compilation, start native work or accept marketing statistics as facts.
Scope remains the existing website; Claude Design owns the next visual/motion pass.

## Owner actions first

1. Retrieve/fix the USDA key through [FoodData Central](https://fdc.nal.usda.gov/api-guide/).
   Configure `USDA_FDC_API_KEY` server-side locally and in the deployment environment;
   never use a `NEXT_PUBLIC_` prefix or commit/paste credentials. The last lookup was 403.
   A replacement key is not proven usable until a successful provider check.
2. Confirm the operator name and a monitored support/accessibility email or support URL.
3. Approve privacy/terms wording and actual retention/deletion handling. Existing
   `docs/legal/README.md` is only a placeholder; `docs/compliance.md` is an older,
   unverified regional draft, not evidence of implemented global compliance.
   Obtain appropriate professional review; do not publish invented legal guarantees,
   deletion controls, vendor retention promises or response-time commitments.
4. Verify `kayamo.fit` ownership in Search Console through DNS, then submit the
   production sitemap after deployment. [Google ownership verification](https://support.google.com/webmasters/answer/9008080?hl=en).
5. Finish/approve Claude Design. Approve the exact upload scope/destination, review
   the deployed candidate, and confirm access to hosting, auth/email configuration
   and database backup/restore settings before release. No passwords need be sent in chat.
6. Decide acceptable data-loss and recovery-time targets and confirm backup retention.
   These are operational commitments, not values an assistant should invent.

## Applied without changing visual design

- Production sitemap explicitly lists only the public home. No invented modification
  dates, account routes, demo pages or private records.
- Robots route excludes APIs/auth callbacks. Vercel preview and development builds
  disallow all crawling. Standalone production builds are indexable; other staging
  hosts must set `VERCEL_ENV=preview` at build time or supply equivalent hosting controls.
- Root metadata defaults to noindex/nofollow. Only public home opts into production
  indexing and receives the public canonical. Private pages do not inherit that canonical.
  Robots directives are not security controls; authentication/RLS remain unchanged.
- Descriptive landing/login titles; public canonical; factual WebSite JSON-LD.
  No invented ratings, pricing, reviews, search action or medical claims.
- Existing OG artwork and icons reused. No new asset family or reskin.
- Unit and browser checks cover environment behavior, private-page metadata, sitemap
  scope, schema, heading count and candidate OG asset availability.
- Accessibility statement drafted separately with documented limitations, pending
  owner contact and review before publishing/footer integration.

## Applicability map

| Tutorial topic | Disposition |
| --- | --- |
| Hick's Law / primary action | Claude Design checklist: clear main task, contextual secondary actions; do not mechanically remove useful keyboard actions. |
| Familiar navigation | Preserve current five named destinations, browser Back and keyboard behavior. Do not force native swipe gestures or replace a destination with a sixth Create tab. |
| Notification permission timing | Deferred; no push feature added. If later approved, ask contextually after value, never on first load. |
| Mascot personality | Existing four-state Mus family and non-shaming confirmation rules retained. Consistent supportive copy; no guilt, nagging, or invented engagement claims. |
| iOS widgets / simulator trimming | Native work deferred; no simulator services changed. |
| Sitemap / robots / metadata / schema | Implemented in this pass, subject to verification below. |
| Headings / alt / responsive / focus | Existing accessibility regressions retained; new public H1 check. Manual zoom/screen-reader review still required. |
| Internal links / broken links | Candidate public-navigation check below; hosted auth/recovery/support links remain release gates. No fake privacy or contact links. |
| Image compression / CWV | Existing WebP artwork retained. Measure the final Claude design on preview before tuning; no claim of passing field Core Web Vitals. |
| URL slugs / HTTPS | Existing bookmarked routes preserved. Verify deployed HTTPS and apex/www redirect behavior before promotion; no speculative redirect or TLS changes. |
| Backlinks / Search Console | Owner verifies account/domain. Later pursue genuine useful references; no automated outreach, purchased links or SEO spam. |
| Accessibility statement | Draft only until genuine feedback channel approved; not proof of conformance. |
| App Store review / localization / ads | Deferred with native release. No Apple-login/payment/deletion feature added based on an iOS checklist alone. |
| Agent harness / ECC | Existing repo instructions, tests and CI reused. No third-party installation, hooks, plugins, autonomous loops or config replacement. |
| Engineering readiness | Preserve validation, source attribution, permissions, isolation and allowance tests; use the explicit gates below. |
| Pricing experiments / fake choice | Not applied: no approved monetization change, no deceptive preferences or paywalls. |

## Engineering gates, not assumed complete

- **Credentials/auth:** verify USDA; hosted email-link delivery, expired/reused-link
  recovery and server AI allowance. Never place secrets or health content in logs.
- **Nutrition correctness:** audit old cached USDA branded data without rewriting
  historical logs. Review missing-data/provider attribution and broader catalog coverage.
- **Abuse/reliability:** process-local food limits are not a distributed quota. Review
  deployment-wide provider budgets, timeouts and safe retries; do not retry non-idempotent
  writes blindly or install a new cache service without scope/cost approval.
- **Data lifecycle:** verify actual stored fields, vendors, retention, deletion,
  attachments and backups against the approved public policy. Older documentation
  alone is not evidence that behavior exists.
- **Security/dependencies:** the September 14 read-only `pnpm audit --prod` found
  16 advisories: 2 critical, 5 high, 7 moderate and 2 low. These are dependency
  version matches, not proof of application exploitability or compromise. Next.js
  16.3.1 matches two critical advisories; the vendor lists 16.3.3 as patched
  ([AVIF optimizer](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4),
  [Windows-hosted servers](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)).
  Also affected: sharp 0.35.3, drizzle-orm 0.44.7, and transitive undici 5.29.0.
  The Windows-specific issue is not evidence that this Mac/Vercel environment has
  that exposure. A targeted, compatibility-tested dependency remediation remains
  required before release; no automatic upgrades or lockfile changes were performed
  in this pass. Preserve canonical package ownership, test database/AI compatibility,
  then rerun the audit. Raw local report: `/private/tmp/kayamo-tutorial-dependency-audit.json`.
  Validate account isolation against the deployed candidate as well. Do not publish
  credentials or private findings in public issue trackers.
- **Testing:** CI already runs typecheck, lint, unit tests, build, disposable database
  integration and three-engine browser tests. This pass does not bypass or replace them.
- **Operations:** verify backup restoration, rollback retention, responsible contact,
  recovery targets, and a privacy-safe incident process. Existing regional breach
  guidance needs owner/professional review for the actual launch jurisdictions.
- **Manual/release:** real screen-reader and native zoom testing, final design review,
  hosted smoke tests and explicit preview approval before production promotion.

## Verification

Type checking, lint, **551 unit tests**, production build and `git diff --check`
passed. Dedicated browser metadata checks passed **3/3** on Chromium, Firefox and
WebKit using the project's configured development server. Initial checks corrected
a test assumption about Next's canonical root-URL slash normalization. A production
build on HTTP localhost passed Chromium/Firefox but WebKit rejected the Secure demo
cookie; no production cookie protections were weakened. The hosted HTTPS demo still
requires its release check. Logs: `/private/tmp/kayamo-tutorial-browser-dev.log` and
`/private/tmp/kayamo-tutorial-browser-rerun.log`.
The dependency audit exited 1 with the advisories above, so verification is not wholly green.
Previous global-search evidence and limitations remain in `global-product-direction.md`;
this checklist does not supersede failures or convert outstanding release gates into
completed work. No deployment, schema change, notification/payment feature or design
reskin was performed.
