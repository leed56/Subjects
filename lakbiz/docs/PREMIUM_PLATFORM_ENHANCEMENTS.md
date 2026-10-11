# LakBiz premium platform enhancement — 11 October 2026

The user-provided preview is https://subjects-git-claude-world-class-banking-ui-nexuserp.vercel.app/.
The implementation is based on `claude/world-class-banking-ui` at `7162b14` rather than the older `main` branch.
The repository's production database reference is `zestppstpwjxriwcuykc` (`nexus-erp`).

## Implemented in this change

Cosmetics & Beauty is a first-class industry template in provisioning, product forms, catalogue cards, dashboards, inventory configuration and cloud hydration. Fields cover brand, manufacturer, shade, pack size, volume, batch, expiry, origin and the labelled period after opening. The latter is reference metadata, not an opened-container expiry timer.

The default inventory mode is batch/lot with FEFO. Shade/pack variant lots are available for makeup lines; non-expiring accessories may explicitly use simple or variant stock. These reuse the existing identity receipt, checkout allocation, returns, quarantine and owner-only cost engines. This does not implement a new independent accounting engine.

The Cosmetics dashboard shows batch availability, near expiry, held/expired batches and reorder pressure. The navigation alert badge includes cosmetics expiry and holds. Operational snapshots contain no internal cost fields. Marketing industry copy and the industry name are available in English, Sinhala and Tamil; dashboard and product-form translations retain the existing application's broader translation limitations.

A batch-health correction also applies to Pharmacy: a lot whose stored status remains `available` is excluded from available quantities when its expiry date is before the Sri Lankan business day. An expired quarantined lot is counted once, not as both expired and held. The existing rule that a lot remains usable on its expiry date is retained. Batch snapshots now reuse the paginated reader with stable ordering rather than stopping at the Data API's first page.

## Database release

`20261011034029_cosmetics_sector_foundation.sql` adds the cosmetics provisioning entry and module matrix, widens the reference-catalogue sector constraint, and extends the existing product-profile defaults. It changes no existing quantities, profiles, invoices, financial permissions or tenant policies.

Apply the migration with the matching application release. Older application versions do not understand the new cosmetics sector and can fall back to grocery. The migration has NOT been applied to the live database in this change.

## Validation

- `npm run verify`: PASS — lint (six existing warnings, no errors), TypeScript, translation-key parity, 215 tests across 33 files, production build.
- The production build generates `/sectors/cosmetics` alongside existing industry pages.
- Isolated PostgreSQL/PGlite execution: PASS — migration syntax, cosmetics batch/FEFO and shade/pack defaults, unchanged Pharmacy defaults, preservation of existing profiles and quantities, module isolation, anonymous trigger-execution restriction, repeatable migration execution.
- The provided public preview opens successfully. Authenticated cosmetics workflows have not been exercised against the live database because this change is not released there.

## Existing work and remaining scope

The current preview already contains pharmacy identity tracking, textile roll/cutting/dispatch/credit/import workflows, returns and credit notes, subscriptions, owner/staff separation and the mobile Pulse route. An existing feature must be checked end to end before it is treated as production-certified; table presence alone does not prove full UI integration.

Older draft PRs #81–#84 contain procurement, workforce, Bills/VAT and vehicle redesigns based on an earlier branch state. They conflict with subsequent workflow changes on the provided Banking branch. They were not merged or overwritten by this change.

Further work for the original complete-platform goal:

1. Reconcile those UI drafts with current banking, returns and WhatsApp workflows, screen by screen.
2. Review general imports/landed-cost workflows outside the specialized textile and vehicle modules.
3. Verify actual branch/location inventory, transfers and consolidated owner summaries before advertising multi-branch support.
4. Complete owner, manager and cashier browser QA for each industry and mobile viewport.
5. Review subscription activation, expiry and entitlements end to end, including offline restrictions.
6. Validate the currently applicable Sri Lankan tax-invoice requirements against official guidance before making compliance claims.

This is the cosmetics-template and batch-health increment, not a claim that the entire original upgrade is finished.
