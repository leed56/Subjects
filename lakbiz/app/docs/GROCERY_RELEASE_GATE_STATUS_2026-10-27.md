# LakBiz Grocery release gate — 27 October 2026

**Status: reviewable branch; production promotion blocked.** This branch is based
on `claude/world-class-banking-ui` at `2d3a9f0` and excludes the unrelated
changes in the original checkout. It does not change a live shop or apply a
production database migration.

## Prepared in this branch

- Optional owner-controlled imports for 36 grinding-mill and 9 meat-and-poultry
  templates. Imports target the current grocery shop only. Templates have
  stable SKUs and original individual illustrations; they start inactive,
  unpriced, zero-stock and barcode-free. The existing Chicken starter item is
  untouched. The server import runs in a single transaction with a per-shop
  lock and duplicate-SKU guard.
- Grocery checkout guards exclude inactive, unpriced and unavailable products
  in the interface and reject invalid sale lines in the database trigger.
  Cashier price overrides require an authorized role.
- Stock quantity corrections produce stock-log entries in the application
  path. Live durability and actor attribution await staging verification.
- Screen repairs from the five owner screenshots: readable two-column POS
  cards, contained product art, sidebar wrapping, compact empty states,
  localized plan and payment text, and deterministic plan date rendering.
- Source lists and a 45-row Sinhala/Tamil editorial worksheet are in
  `GRINDING_MILL_CATALOGUE.md`, `GROCERY_MEAT_CATALOGUE.md`, and
  `GROCERY_NATIVE_REVIEW.md`. The published sources support product range
  selection; native reviewer approval is still pending.

## Local evidence

| Gate | Result |
| --- | --- |
| `npm run verify` | Passed: ESLint zero errors and six existing warnings; typecheck; i18n parity against baseline (SI 0, EN 1, TA 1480 missing keys); 37 test files/230 tests; production build. |
| Local PostgreSQL rehearsal | Passed 36 mill and 9 meat imports, rollback/retry, queued simultaneous calls, shop isolation, product cap, owner-only import, and checkout guards. This is an in-memory rehearsal, not production or independent database concurrency proof. |
| Local browser | POS, dashboard and plans passed no-overflow and no-console-error checks at 1280px and 390px in English, Sinhala and Tamil (18 combinations). Stock optional import dialogs and artwork passed at both widths. Demo data only. |
| Screenshot review | `GROCERY_SCREENSHOT_QA_2026-10-26.md` maps each supplied issue to a branch correction and outstanding preview check. |
| Exact preview | GitHub `LakBiz Verify` and `LakBiz Deployed UI QA` completed successfully for the PR commit. Vercel reports a completed deployment at `https://subjects-git-codex-grocery-final-release-nexuserp.vercel.app/`; a direct browser read of `/sales` loaded the Grocery Retail POS. This is not an authenticated staging sale. |

## Read-only audit of the actual Supabase project

The connected `NmSupabase Class, and subject` account now exposes project
`zestppstpwjxriwcuykc` (`nexus-erp`, healthy, Postgres 17). Its migration
history contains 81 entries, ending with `20261011094954_general_ledger_foundation`.
Neither optional catalogue migration in this PR is applied. The table list
shows RLS enabled on all 107 public tables; sampled product, sale, sale-line
and stock-log policies refer to organization membership. This policy review is
not a cross-shop runtime penetration test. The eight flagged views contain
authentication and organization predicates, but run as definers and remain
open security findings until tested under real roles. Current policies also
permit the cashier role to update or delete `stock_logs` and sales rows;
append-only movement durability is therefore not established by RLS alone.

The security advisor reports **8 errors** for Security Definer Views
(`job_items`, `sale_lines`, `sales`, `products`, `contractors`, `vehicles`,
`ac_jobs`, `technicians`), **82 warnings** (81 executable privileged functions
and leaked-password protection), and 3 infos. See the [Supabase view finding](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).
The performance advisor reports 52 warnings and 173 infos. A read-only
dashboard inspection of this Free-plan project showed no scheduled backups;
no backup/restore test has been run. The existing live `sale_lines_base` table
does not yet have the new checkout guard trigger from this branch.

## Open release blockers

1. The actual Supabase project is now readable, but its eight Security Definer
   View findings and 82 warnings require triage and fixes before promotion.
   RLS policy inspection alone cannot prove cross-shop isolation. There is no
   verified backup and restore path for this Free-plan project.
2. There is no isolated, writable LakBiz staging shop/project available for
   the required owner/cashier checkout, return, interrupted import, independent
   concurrent import, product-limit and durable stock-movement tests. Do not
   run these write tests against Lanka Grocery, Ammar Farm Shop or production.
   Review cashier mutation permissions on sales and stock logs in that
   isolated environment and harden them without breaking returns.
3. Native Sinhala and Tamil reviewers have not signed off the 45 catalogue
   names, units, checkout labels and receipt wording. The wider Tamil
   translation baseline remains open.
4. Exact-commit CI, deployed UI QA and preview deployment pass. Direct Vercel
   runtime/build log inspection remains unavailable because this Codex Vercel
   connection lacks access to the `nexuserp` team. Backup/restore proof and a
   verified rollback drill are still required.
5. Barcode scanner and receipt-printer hardware have not been verified.

## Rollback preparation

Keep the last known good Vercel deployment and exact commit recorded before
promotion. If UI behavior fails, route production back to that deployment.
Database changes require a tested restore point before application; avoid a
blind down migration because imported owner products, sales and stock logs are
business records. If a migration issue appears, disable the import surface via
application rollback and repair with a reviewed forward migration after a
fresh backup. Rehearse the full procedure on the isolated staging project.

Production promotion must be presented to the owner only after all blockers
above close with evidence on the exact reviewed commit.
