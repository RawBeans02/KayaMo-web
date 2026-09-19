# Global product direction — September 14, 2026

Owner override: KayaMo is a global personal-growth app, not a Filipino-first product.
Keep the KayaMo name and Mus identity. Default to natural English; preserve explicit
language choices. Filipino foods remain available as one cuisine among many.
This supersedes older Philippines-first positioning for the website, not native
bundle identifiers, nutrition provenance or stored meal-slot identifiers.

## Implemented in this pass

- Landing and login promote daily improvement without forced Tagalog slogans,
  Filipino-portion marketing or Philippines-only footers.
- Settings explain English as the default and translations as optional.
- Regression checks prevent reintroducing regional marketing or universal-food claims.

## Implemented food and experience changes

The initial canonical edit was blocked by the approval service's usage limit. After
the stated reset time passed, the same normal approval path succeeded. Shared changes
were made canonically and applied as targeted web changes, preserving divergent files.

- Quick logging now includes cached USDA and Open Food Facts records alongside
  user and curated foods. Regional placeholders and exclusionary empty-state copy
  are replaced with neutral examples and real routes to the Foods page.
- Foods has an explicit worldwide search form, result review, gram quantity, meal
  selection, source attribution, saving feedback, undo, and failure/empty states.
- A thin POST `/api/foods/worldwide` route composes a shared authenticated handler.
  It sends submitted search text only, not account identifiers or history. Demo
  remains local. Input and returned food records are validated; responses are private
  and not HTTP-cached. Errors do not echo upstream URLs or credentials.
- Search providers run independently, with timeouts and process-local request limits.
  No search-as-you-type calls to external providers, service-role writes, new provider
  subscriptions, nutrition-generating LLM calls, or schema migrations were added.
- Logging stores an existing-format, account-scoped nutrition snapshot with a nullable
  food reference. It does not invent a foreign-key food row or publish a user food to
  a shared catalog. Logged quantities and source/confidence persist through reload.
- Missing core macronutrients and OFF energy without an explicit per-100g basis are
  excluded instead of being filled with fabricated zeros. Existing nullable/missing
  micronutrient limitations remain disclosed in the review UI.
- USDA branded `foodNutrients` are already per 100g: removed an inherited second
  serving-size conversion. The old tests encoded that incorrect conversion; their
  expected values now preserve the source values. No historical entries were rewritten.
- Missing/guest diary profile clocks fall back to the device timezone; the Home clock
  starts from UTC before hydration. Saved profile timezone/day boundary still win.
- Brain-dump and web workout instructions no longer assume a country or regional
  language. Existing food parser code has a web-only legacy divergence; its language
  coverage statement is not a forced output-language setting and remains for later
  canonical consolidation. Existing schemas and AI permissions are unchanged.

## Verification and release limits

- Targeted browser checks: 15/15 across Chromium, Firefox and WebKit, including
  guest API rejection, portion review at 390px, save/undo/reload and existing palette
  and catalog behaviors. Provider responses in the authenticated browser test are fixtures.
- Full regression run: 135 passed; three failures were the same intentionally renamed
  catalog filter label in each engine. After correcting that selector, **36/36**
  affected release/food checks passed across all engines, including all three failures.
  This is a full run plus a passing affected rerun, not a second clean 138-test run.
  Log: `/private/tmp/kayamo-global-final-browser.log`.
- Visual evidence: `docs/design/botanical/evidence/worldwide-review-390.png` shows
  the authenticated fixture's source/portion review at 390px. The in-app browser
  separately verified the real demo entry point and sign-in gate.
- Live generic lookup: 20 usable Open Food Facts **staging** records, all passing
  the food schema. No diary, account details or food history were sent.
- **USDA is blocked:** the configured key received HTTP 403. A valid USDA credential
  is needed before claiming USDA availability. Neither key values nor upstream
  credential-bearing URLs were printed.
- Final verification completed successfully: type checking, lint, **546 unit tests**
  and production build. New endpoint authorization, input limits, source-outage
  handling and normalization have unit tests. The final verification chain exited 0.
- The rebuilt production server is running locally at `http://localhost:3002` for QA.
  The in-app browser loaded `/foods` with the saved demo catalog and worldwide-search
  sign-in gate. This is local verification, not a production deployment or approval.
- Count correction: earlier release notes overstated aggregate unit totals by 100.
  The pre-global audit total was 529, not 629 (and its predecessor 525, not 625).
  Current totals are calculated from each test runner's actual passing-test counts.
- Rate budgets are in-process, not a distributed IP-wide quota. Production scale
  requires coordinated provider budgets/cache or a licensed/imported dataset strategy.

## Remaining scope

No database has every food. This is an international-search foundation, not universal
coverage. Restaurant menus, detailed regional recipes, additional national datasets,
barcode-camera UX and a globally representative offline demo catalog need separate
coverage work. Custom entry remains the existing signed-in catalog workflow.

Existing cached USDA branded records may reflect the former conversion and need an
explicit audit/recheck before production rollout; saved logs are intentionally untouched.
Existing database defaults and native locale/timezone settings were not migrated. Do
not silently re-bucket historical diary dates or reset an explicit language preference.

## Coverage standard

Aim for broad international ingredients, packaged foods, dishes, recipes and custom
entries, not a promise that one database contains every food. USDA FoodData Central
and Open Food Facts are existing adapters, not proof of live web coverage. Missing
foods require verified recipe/label data or a clearly identified custom entry.

Provider references: [USDA API guide](https://fdc.nal.usda.gov/api-guide.html) and
[Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/).
Check credentials, licensing, attribution, limits and actual provider availability
before release. No new provider subscription, dataset import, migration, deployment
or production data mutation was performed in this pass.
