# Shop-template isolation audit — 28 October 2026

## Finding and correction

The owner's three screenshots exposed a real shared-settings defect. The
notifications screen displayed HVAC job prompts, service schedules and
technician settings for every sector. General message pickers also offered job
templates, and the service-reminder worker did not filter organizations by
sector. Hiding navigation alone did not protect direct specialty-page links.

This change:

- Restricts AC settings, templates, technician invitations, manual reminders and
  scheduled reminders to HVAC. Sending APIs resolve the sector from the current
  authenticated organization and require its AC module; request fields cannot
  choose another sector. Existing organization and role checks remain in force.
- Blocks incompatible specialty routes before their pages mount, including in
  anonymous demos. Navigation uses the same sector rule. Common product, sale,
  customer, bill and supplier routes keep their existing role/module checks.
- Separates message history and preferences by shop, and anonymous caches by
  template. Shop identity, logo, tax settings and save timestamps are scoped too.
- Removes automatic adoption of old, unassigned global product/business caches
  into a shop. Existing tenant caches and cloud records are preserved. Legacy
  global records remain intact for explicit recovery; the code does not guess
  which shop owns them.
- Keeps failed notification saves on the authorized server path instead of
  falling back to an unchecked direct database update.
- Wraps mobile settings tabs so Sinhala/Tamil labels are visible.
- Uses the owner's approved Sinhala name **AC වැඩ** for AC Jobs. Related job
  actions, reports, schedules and Sinhala message templates use the same work
  terminology; identifiers and existing records remain unchanged. This wording
  correction is separate from the outstanding full catalogue/native review.

## Specialty boundaries checked

| Surface | Allowed sectors |
| --- | --- |
| AC jobs, schedules, assets, workforce, teams, job costing | HVAC only |
| AC reminders, job-message templates, technician invitations | HVAC with AC module enabled |
| Vehicle workspace | Vehicle sales only |
| Fabric rolls, cutting, dispatch, textile intelligence | Textile only |
| Advanced inventory screens | Pharmacy, electronics, mobile shops, footwear |
| Pulse workspace | Textile, pharmacy |

All ten supported templates are included: grocery, pharmacy, electronics,
mobile shops, electricals, spare parts, footwear, textile, HVAC and vehicle sales.
The matrix controls frontend specialty routes; database authorization remains
an independent release requirement.

## Read-only check of the actual database

Project `zestppstpwjxriwcuykc` was inspected without changing records. Aggregate
queries joining `products_base.sector_id` and `ac_jobs_base.organization_id` to
`organizations`, plus checks of `sector_modules.allowed`, returned:

| Check | Count |
| --- | ---: |
| Product sector differs from owning shop sector | 0 |
| AC jobs owned by non-HVAC shops | 0 |
| Non-HVAC sector allowed the AC module | 0 |
| Non-vehicle sector allowed the vehicle module | 0 |

These findings locate the reported visible problem in shared UI/settings and
browser storage. They do not establish that every possible data-isolation or
ledger attack has been closed. Earlier RLS and completed-ledger findings in
`GROCERY_RELEASE_GATE_STATUS_2026-10-27.md` remain open.

## Verification and release checks

- `npm run verify`: lint, types, translation-baseline check, 42 test files / 276
  tests and production build pass on the Grocery branch. The earlier framework
  reported six pre-existing lint warnings. The patched lint configuration also
  flags five existing full-page navigation calls, for 11 warnings and zero
  errors. These navigation warnings are separate from new failures; logout
  navigation has not been casually rewritten because it intentionally clears
  the old authenticated application state. Translation debt is SI 0, EN 1,
  TA 1480 keys.
- Regression tests cover every specialty route across all ten sectors,
  messages, effective preferences, old global caches, independent shop
  identities, denied saves, and a reminder worker that never visits non-HVAC
  jobs even with stale enabled settings. No SMS is sent by these tests.
- `scripts/qa-sector-isolation.mjs` checks 1280px and 390px for all ten templates
  in English, plus Sinhala and Tamil for Grocery/HVAC (28 combinations). It
  checks AC controls and navigation, incompatible direct links, legacy-message
  privacy, correct shop identity, mobile tab clipping, overflow and browser
  errors. Mutation requests are actively blocked and reported. Screenshots and
  `report.json` are generated as verification artifacts. The service worker is
  blocked in these contexts so its initial controller reload cannot interrupt
  a navigation; offline/PWA update behavior is not covered by this check.
- Automatic deployed UI checks now run that credential-free script on the exact
  PR commit. The old check created temporary Auth users and memberships in
  existing shops; that path is no longer automatic. Authenticated journeys now
  require a separately configured `lakbiz-staging` environment and explicitly
  named staging shops. The script refuses the production Supabase host before
  any network activity and no longer accepts a different deployed commit.

## Dependency hardening

The expanded audit found four vulnerable production packages (including a
critical framework advisory) and 12 flagged dependency entries overall in the
original lockfile. The branches pin Next.js and its lint configuration to
16.4.3 and refresh compatible transitive fixes. `npm audit --json` then reports
zero vulnerabilities across production and development dependencies. CI now
runs a dependency audit as well as lint/types/tests/build, using Node 22.

The framework maintainer's [image-optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)
and [cache-function advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr)
identify patched releases; the branch uses the later 16.4.3 release. This package
audit does not resolve the separate database-policy and application-ledger
findings below.

## Remaining production gates

This fixes the reported template-mixing paths. It does **not** approve a
production promotion. Authenticated owner/cashier end-to-end journeys still
need a separate staging project, and the previously recorded completed-ledger
permissions/snapshot-sync issues, fresh backup/full restore proof, database
migration deployment, native-language approval, Vercel log access and hardware
verification remain release gates. A green anonymous visual check is not a
substitute for those gates.
