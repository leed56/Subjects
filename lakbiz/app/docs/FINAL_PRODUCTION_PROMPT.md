# Final production task for LakBiz Grocery

Continue in `C:\subject` from the current work. The owner chose an **optional
grocery catalogue**, not a separate grinding-mill shop type. Read
`lakbiz/app/docs/GRINDING_MILL_CATALOGUE.md` and
`lakbiz/app/docs/PRODUCTION_READINESS_AUDIT_2026-10-26.md` first. Do not claim
production readiness or promote a deployment until every gate below has
measured evidence.

1. Isolate the grocery changes in a clean branch/PR. Preserve unrelated local
   pharmacy, messaging, login and sidebar work; review the exact diff. The
   current branch has no open PR or GitHub verification run.
2. Verify the 36 unbranded grinding-mill templates against the cited Sri Lankan
   sources and obtain native Sinhala/Tamil review of names and pack units. Keep
   owner import explicit and restricted to the current grocery shop. Records
   must be editable, inactive, unpriced, zero-stock and without fabricated
   barcodes until the owner enters real values. Original SVG illustrations
   must render without stretching. Never seed another shop automatically.
3. Harden the import for real cloud use: make it idempotent per organisation
   and SKU at the database boundary; handle interrupted saves, retries,
   simultaneous owners, product-plan limits and sync conflicts without silent
   data loss or duplicates. Show an accurate saved/sync-pending result. Test
   this in an isolated staging grocery shop, including a forced mid-import
   failure and recovery.
4. Enforce valid selling state in the Stock editor, POS and server checkout:
   inactive or zero-price products must not be sold, stock cannot go negative,
   and cashier price overrides must follow permissions. Verify product edits
   update POS, cart, receipt, inventory value and low-stock alerts. Confirm
   every direct quantity correction and sale creates a durable stock log with
   actor and source information. Test returns and refunds against the same
   records.
5. Connect to the **actual** LakBiz Supabase project
   `zestppstpwjxriwcuykc` using authorized read-only access first. The
   currently connected account only exposes a different project. Check live
   migration history, RLS/tenant isolation, security and performance advisors,
   current backup and a tested restore path. Do not change production data to
   perform the audit. Use an isolated staging shop for writes.
6. Run the complete owner and cashier flow at 1280px and mobile widths in
   English, Sinhala and Tamil: opt-in import, duplicate import, pack/price/
   barcode edit, stock receipt, SKU/barcode search, cart, Cash/Card/Bank
   Transfer checkout, bill, stock deduction, reporting, low-stock and returns.
   Check keyboard use, focus, contrast, images and absence of horizontal
   overflow. Test scanner input and receipt print on representative hardware
   or report them as unverified. Disabled Hold/Recall controls must remain
   honestly labelled until implemented.
7. Run `npm run verify`, focused security checks, and the deployed UI QA on
   the **exact PR commit**. Fix new warnings and regressions; report the eight
   existing lint warnings and Tamil i18n baseline debt explicitly. Check
   Vercel preview logs, environment configuration and release rollback. Do
   not equate a green Vercel build with passing CI or completed business-flow
   verification.
8. Deliver a release report with pass/fail/blocker evidence, exact commit,
   PR and preview links, screenshots, staging test records, database/security
   findings, backup/restore proof, remaining risks and rollback steps. Once
   all blockers are closed, present the exact reviewed production promotion
   for final owner approval. Never silently import products into live shops.
