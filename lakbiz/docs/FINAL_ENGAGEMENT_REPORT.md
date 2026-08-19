# LakBiz — Final Engagement Report

**Repository:** `leed56/subjects` (`lakbiz/` subdirectory)
**Production Supabase project:** `zestppstpwjxriwcuykc` ("nexus-erp")
**Production deployment:** `subjects-nexuserp.vercel.app` / `subjects-ten.vercel.app`
**As of:** 2026-08-19

This is Phase 26 — the final consolidated report for the whole engagement,
requested after the earlier phases below were complete. It is a summary
and index, not a replacement for `docs/IMPLEMENTATION_PROGRESS.md`, which
remains the detailed, line-by-line source of truth (3,600+ lines,
organized phase by phase in the order the work actually happened). Every
claim below is backed by a section there, a merged PR, or a live database
check — nothing here is reconstructed from memory or asserted without a
receipt.

## What LakBiz is today

LakBiz started as a general-purpose SME dashboard (sales, stock,
customers, suppliers, banking, VAT) and was rebuilt, in two large
tracked efforts, into a full HVAC/AC repair, maintenance, inventory, and
job-costing operations platform — while keeping the original retail/SME
modules intact and functional for shops in other sectors (grocery,
electronics, electricals, spare parts, car sales). A single codebase
serves every sector; which modules a given organization sees is driven
by a data-driven `sector_modules` table plus a subscription plan, not a
fork.

The data model that makes HVAC job costing real (not cosmetic):
**Customer → Site → AC Asset → Complaint → Diagnosis → Work performed →
Parts/materials used → Technician/contractor labor → Other job costs →
Invoice → Job cost → Gross profit → Margin → Asset service history →
Dashboard/Reports intelligence.** Every number surfaced anywhere in the
app about a job's cost or profit traces back to real line items
(`job_items`), real linked expenses, and one authoritative calculation
(`computeJobProfitability` in `app/src/lib/job-profitability.ts`) — never
a fabricated or estimated figure, per the engagement's standing rule
against invented "repair intelligence."

## Engagement timeline

### Era 1 — Dashboard rebuild (Phases 0–18, plus "Dashboard command center")
The original SME dashboard modernization: design system, customer CRM,
inventory UX, HVAC asset lifecycle, service jobs, crews, scheduling, job
costing (first version), AC job invoicing, dashboard rebuild, expense
tracking, team roles, messaging, business reports, mobile field UX,
performance/a11y, a final security audit (Phase 17), and a final QA pass
(Phase 18). See `IMPLEMENTATION_PROGRESS.md` §"Completed" for the full
phase-by-phase record.

### Era 2 — HVAC operational platform data-model rebuild (Phases 1–15)
Explicitly gated on the principle "the dashboard redesign should happen
only after these real operational signals exist" — i.e., **do not
redesign before modeling data**, the engagement's first standing rule.
Built the parts/materials catalog, stock movements, job→parts linkage
with historical cost snapshots, job labor costing, other job costs, the
job profitability engine, a redesigned Job Detail experience, AC asset
service history, repeat-repair intelligence (built only from real
repair-history data, never fabricated), low-stock/reordering, purchase
orders, and the first two dashboard-redesign slices (job profitability,
purchase order pipeline). See `IMPLEMENTATION_PROGRESS.md`
§"HVAC operational platform" for the full record.

### Era 3 — Critical live-bug fixes (post-merge)
Real production bugs found after the above phases landed, each
root-caused and fixed, including: a live database schema-drift gap where
several migrations were written but never actually applied to
production (Phases 3/4/5/6/7/9/13 — closed in a dedicated infra fix);
and a technicians/job_items cloud-save failure ("no unique or exclusion
constraint...") caused by write paths that predated a later
masked-view migration.

### Era 4 — Security & correctness hardening (this session)
The most recent, most security/correctness-focused stretch of work,
each item merged as its own PR:

| # | PR | What |
|---|----|------|
| 1 | [#59](https://github.com/leed56/Subjects/pull/59) | Retracted an incorrect prior claim that contractors' financial data was unmasked — verified it was already correctly masked since Phase 6 |
| 2 | [#60](https://github.com/leed56/Subjects/pull/60)–[#62](https://github.com/leed56/Subjects/pull/62) | Fixed 3 live production bugs: technicians/job_items upsert-conflict, `stock_logs.user_id` client-spoofable, `products.active`/`notes` migration never applied |
| 3 | [#63](https://github.com/leed56/Subjects/pull/63) | **Phase 19** — found and closed a live masking bypass (`technicians_base`/`job_items_base` SELECT grant never revoked) and role-blind writes across 22 tables (RLS checked org membership + plan, never the calling member's *role*) |
| 4 | [#64](https://github.com/leed56/Subjects/pull/64) | Closed a disclosed `job_items` INSERT financial-masking gap (corrected mid-flight before shipping — first draft would have zeroed real stock-part costs) |
| 5 | [#65](https://github.com/leed56/Subjects/pull/65) | **Phase 19 read side** — role-aware SELECT enforcement to match the write-side fix |
| 6 | [#66](https://github.com/leed56/Subjects/pull/66) | **Phase 20** — fixed a real accounting double-count (`outsourced_repair` expenses vs. `subcontractCost`) |
| 7 | [#67](https://github.com/leed56/Subjects/pull/67) | **Phase 25** — fixed N+1 round-trip bugs in the full-snapshot cloud sync (sequential line-item writes, sequential masked-view updates) |
| 8 | [#68](https://github.com/leed56/Subjects/pull/68) | Fixed AC job revenue/cost being completely absent from the income-tax estimate |
| 9 | [#69](https://github.com/leed56/Subjects/pull/69) | Closed the masked-view sync N+1 for real — a Postgres RPC does bulk updates in one round trip instead of one request per row |
| 10 | [#70](https://github.com/leed56/Subjects/pull/70) | Corrected the record: "leaked password protection" is Supabase-plan-gated (Free plan doesn't support it), not just a dashboard click away |
| 11 | [#71](https://github.com/leed56/Subjects/pull/71) | **Phase 21** — systematic data-migration safety review; no issues found |
| 12 | [#72](https://github.com/leed56/Subjects/pull/72) | **Phase 22** — this project's first automated tests (21 tests, `vitest`) |
| 13 | [#73](https://github.com/leed56/Subjects/pull/73) | **Phase 24** — AC job performance section added to the Reports page |

Every one of these is merged into `main` and its production Vercel
deployment has been individually confirmed `READY` (or, for database-only
migrations, applied live and verified via `get_advisors`) — see
`IMPLEMENTATION_PROGRESS.md` for each item's own testing section.

## Security posture

- **Tenant isolation**: every org-scoped table enforces
  `organization_id`-based RLS; masked financial views (sales, products,
  ac_jobs, contractors, vehicles, technicians, job_items, sale_lines)
  additionally mask cost/profit columns from roles that shouldn't see
  company financials (technician, cashier, data_entry), verified live
  against the production database, not just by code inspection.
- **Role enforcement now lives at the database layer**, not just in
  client-side route guards — closed in Phase 19 across write (66
  policies + 24 trigger functions, 22 tables) and read (6 tables + 2
  views) paths.
- **Every masked view's INSTEAD OF trigger performs its own explicit
  permission check** — necessary because `SECURITY DEFINER` triggers
  bypass the base table's own RLS entirely; this was the root cause of
  the Phase 19 masking-bypass finding.
- A live Supabase security-advisor scan has been re-run after every
  schema change this session; the only standing WARN/ERROR categories
  are the accepted, by-design ones (`security_definer_view` on masked
  views, `authenticated_security_definer_function_executable` on
  internal helper/trigger functions) and, separately, "leaked password
  protection disabled" — confirmed Supabase-Pro-plan-gated (see PR #70),
  not an engineering gap.

## Correctness & data-integrity posture

- **One authoritative job-cost/profit formula**
  (`computeJobProfitability`), reused everywhere a job's cost or margin
  is shown (Job Sheet, `/job-costing`, `/jobs`, `/dashboard`, `/vat`,
  `/reports`) — never re-derived per page.
- **One authoritative low-margin rule** (`isLowMarginJob`, 15% gross
  margin threshold) — never invented per screen.
- **Two real double-counting bugs found and fixed** by re-reading the
  cost-rollup code end to end rather than trusting existing comments:
  `outsourced_repair` expenses vs. `subcontractCost` (Phase 20), and AC
  job revenue/cost being entirely absent from the income-tax estimate
  (fix-all pass).
- **First automated test suite** (Phase 22, 21 tests) locks down both of
  the above fixes plus the core profitability/tax-estimate formulas, so
  a future change that reintroduces either bug fails a test immediately
  instead of shipping silently.
- **Data-migration safety reviewed** (Phase 21): all 64 tracked
  migrations checked for destructive operations; the only 3 genuine
  `DROP TABLE`/`DROP COLUMN` operations were each verified safe against
  live app-code usage, not just trusted from their own comments.

## Known limitations (explicitly deferred, not silently dropped)

**Still genuinely blocked in this environment:**
- **No browser** in this sandbox at any point in the engagement — every
  fix has been verified by `tsc`/`eslint`/`next build`/`vitest` plus live
  database introspection, never by actually rendering a page. Phase 23
  (real browser/visual QA) has never been attempted for this reason.
- **Leaked password protection** (Supabase Auth) cannot be enabled — the
  org is on Supabase's Free plan, which doesn't support HaveIBeenPwned
  integration regardless of dashboard access. Confirmed with the repo
  owner (PR #70); revisit only if the org upgrades to Pro.

**Deferred by deliberate scope decisions**, most from the original
dashboard/HVAC rebuild spec (see `IMPLEMENTATION_PROGRESS.md`
§"Not started" for the complete original list — reproduced in spirit,
not verbatim, since some of these have since been addressed; the one
confirmed exception is called out below):
- Customer notes field; Receive Stock / Stock Adjustment as first-class
  features; offline support for AC Assets and Crews; a full field-service
  dispatch status model (New/Assigned/On the way/Awaiting parts/etc.);
  before/after photos; customer signature capture; wiring `asset_id`/
  `crew_id` into the Jobs create/edit form; drag-and-drop rescheduling;
  time-of-day scheduling; per-job-type costing benchmarks; a distinct
  job-invoice numbering scheme; unifying Workforce with login-capable
  Team accounts; CSV/print export directly from `/reports`; a full
  accessibility audit beyond the icon-only sweep already done.
  - **One confirmed exception**: "wiring the Phase 11 expenses deduction
    into the Dashboard/VAT income-tax display" was originally on this
    list as not-started — it has since been done, and gone further (full
    AC job revenue/cost, not just the expenses deduction), across
    `/vat`, `/expenses`, and `/dashboard` (fix-all pass, PR #68).
- **Reports/VAT/income-tax remain three separate views**, not one fully
  unified reporting page — Phase 24 deliberately added AC job
  performance to `/reports` without also folding in VAT/income-tax,
  since those already have full standalone UI (rate selection,
  disclaimers) that merging in would have meant redesigning too. A
  natural next step, not an oversight.
- **Test coverage is a real start, not a complete suite**: `vat.ts`, the
  role/permission matrix, and the RLS-layer SQL itself have no automated
  tests yet (the SQL would need a real Postgres connection this
  environment doesn't have — e.g., Supabase's local CLI stack).
- **Phase 19's audit, while thorough on what it checked, was not an
  exhaustive table-by-table sweep of the entire schema** — there could
  be other role/masking gaps of the same shape not yet found.

## Where to look for more detail

- **`docs/IMPLEMENTATION_PROGRESS.md`** — the full, phase-by-phase
  record; every fix in this report has its own detailed section there,
  including root-cause analysis, alternatives considered, and exact
  testing performed.
- **`docs/ARCHITECTURE_AUDIT.md`** (Phase 0) — the original architecture
  audit that set the ground rules this whole engagement followed.
- **GitHub PRs #59–#73** — the exact diff for every fix summarized above,
  each with its own detailed description.
- **Supabase project `zestppstpwjxriwcuykc`** — the live source of truth
  for schema/RLS state; `get_advisors` is the trustworthy way to check
  current security lint status (`list_migrations` has been repeatedly
  confirmed unreliable as an "is this applied" check — always verify
  against live schema, not migration-tracking metadata).
