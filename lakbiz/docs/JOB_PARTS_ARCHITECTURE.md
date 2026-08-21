# HVAC Job Parts, Materials & Profitability — Architecture

**Scope:** Deepen the AC job parts/materials/labor workflow (source types,
replacement + warranty tracking, external-purchase → expense/inventory
bridging, itemized invoicing, job economics) on top of the already-shipped
job-costing foundation. **Additive only** — no historical migration is
edited; every schema change here is a new migration file. No UI primitive
from the premium-polish pass (Drawer/Dialog/Button/FormSection/ActionMenu/
DataTable) is reverted or bypassed.

---

## 1. Existing model (confirmed by reading the actual code, not assumed)

This repo already implements most of a job-parts architecture, built
across HVAC platform Phases 1–20 (see `IMPLEMENTATION_PROGRESS.md`). It is
**not** a blank slate:

- **`job_items`** (masked view over `job_items_base`) already carries:
  `id, jobId, itemType(part|labour|service), name, qty, unitPrice,
  lineTotal, source(stock|purchased|customer_supplied), productId,
  supplierId, purchaseRef, purchaseDate, customerPrice, technicianId`.
- **Historical-cost guarantee already exists at the DB layer, not just the
  client.** `job_items_view_insert()` (current version:
  `20250712000002_job_items_insert_financial_masking.sql`) derives
  `unit_price` for `source='stock'` lines from `products_base.buy_price`
  **server-side**, ignoring whatever the client sent — the single
  strongest guarantee that an old job's cost never drifts when today's
  stock price changes.
- **Role-aware write AND read enforcement already exists**, layered across
  three migrations (`20250712000001/2/3`): `job_items_base` has `select`
  revoked from `authenticated` entirely (the `job_items` view is the only
  read path), INSERT/UPDATE/DELETE require
  `org_member_can_write_module(org_id,'ac_jobs') AND org_member_role_in(
  org_id, ['owner','manager','data_entry','technician'])` (cashier
  excluded — matches the app's own permission matrix), and
  `unit_price`/`line_total`/`customer_price` are masked to `0`/`null` for
  any role `can_see_org_financials()` says shouldn't see them, on both
  SELECT and UPDATE.
- **Stock movement is centralized** (`applyStockMovement()` in
  `actions.ts`, HVAC Phase 3) with a typed `StockMovementType` including
  `purchase`/`job_usage`/`job_return`/`supplier_return`/`write_off`, each
  writing a `stock_logs` row carrying `related_job_id`/`related_supplier_id`/
  `user_id`. Adding a stock-sourced job item already decrements stock and
  writes a `job_usage` log; deleting one already reverses it with a
  `job_return` log (see `addJobItem`/`deleteJobItem`, `actions.ts`).
- **`computeJobProfitability()`** (`job-profitability.ts`) is the one
  authoritative Material+Labor+Other → Gross Profit → Margin calculation,
  already reused by `/job-costing`, the Job Sheet's Economics tab, Reports,
  and the Dashboard. It already includes a documented double-count guard
  (an `outsourced_repair` Expense on a contractor job that already has
  `subcontractCost` set is excluded) and a documented, disclosed low-margin
  rule (`isLowMarginJob`, 15% floor).
- **Purchase Orders** (`purchase_orders`/`purchase_order_lines`, HVAC
  Phase 13) already model "ordered but not yet delivered," with partial
  receiving, and deliberately do not auto-create a GRN on receipt (to
  avoid double-counting a delivery against a manually-entered supplier
  bill).
- **Expenses** (`expenses`, cloud-only) already has a nullable `job_id`
  (HVAC Phase 7) and is already folded into `computeJobProfitability`'s
  "Other" bucket via the caller-supplied `linkedExpenses` array.
- **AC Asset warranty** already exists as a whole-unit field
  (`ac_assets.warranty_expiry`, a real date with UI on `/assets`) — this
  is a different concept from per-*component* warranty (a replaced part's
  own warranty), which does not exist yet.
- **Product-level `warrantyMonths`** already exists as an `ac_hvac`
  sector custom field on `Product` (HVAC Phase 2) but is **not read
  anywhere** — a catalog attribute with no consumer yet.
- **Job invoice is deliberately non-itemized today** — `JobInvoiceView`
  renders exactly one line (`jobType — description` at flat
  `quotedAmount`), by explicit design documented in `job-invoice.ts`'s own
  header comment ("printing job_items would hand the shop's cost basis
  straight to the customer"). `job_items.customerPrice` is captured but
  never flows into this document. This is the real gap Part 12 of the
  brief targets.
- **Job Costing report** (`/job-costing`) already has search/status/type
  filters, margin-based sorting, and a low-margin badge — it does not yet
  have a date range, technician/team filter, or "external purchases by
  supplier" list.
- **Suppliers/Purchases/PurchaseOrders are local-first** (part of
  `AppData`, synced via `business-sync.ts`), unlike Expenses/AC-Assets
  which are cloud-only direct-Supabase clients. This matters for where new
  write logic lives (`actions.ts` pure reducers + `app-store-provider.tsx`
  cloud sync, not a new REST client).
- **No file/photo upload architecture exists anywhere in this codebase**
  (re-confirmed here, same finding as HVAC Phase 9's audit) — Supabase
  Storage is not configured, there is no upload UI, no storage RLS policy.
  Attachments (Part 22) stay explicitly out of scope this phase, same
  disclosed-not-fabricated treatment Phase 9 already gave this exact gap
  for job photos.

### Disclosed gaps this phase closes

1. `job_items.source` has no "manual" concept distinct from "purchased"
   (a quick ad-hoc material entry vs. a tracked external purchase with
   supplier/reference).
2. "Purchased for this job" never creates an Expense or moves inventory —
   explicitly flagged as a gap in HVAC Phase 4/5's own documentation.
3. No replacement/warranty tracking on a job line at all.
4. No component taxonomy (free text only, no consistency for reporting).
5. Invoice is never itemized from real job lines.
6. Job Economics doesn't distinguish Quote vs. actual Invoice vs.
   Collected vs. Balance — it only ever shows Quote as "Revenue."
7. No "purchased for this job" filter/view.
8. No non-blocking cost-recording reminder at job completion.
9. Job Costing report has no date range or technician filter.

---

## 2. Proposed model — additive, reuses everything above

### 2.1 `job_items` — widened, not replaced

New/changed enum values and columns on the existing table (all nullable
or defaulted, all backward-compatible with every existing row):

| Column | Type | Notes |
|---|---|---|
| `item_type` | *(widen CHECK)* add `transport`, `other` to `part\|labour\|service` | Part 9's Transport/Other charge concepts get their own bucket instead of overloading `service`. |
| `source` | *(widen CHECK)* add `manual` to `stock\|purchased\|customer_supplied` | `purchased` = "External Purchase" (Part 5) — kept as the existing DB value, relabeled in UI. `manual` (Part 4) is new: no product record, no purchase tracking, just a typed line. `customer_supplied` is kept (real existing data), reachable as a secondary option inside the Manual form rather than its own top-level button, per the brief's 3-primary-button design. |
| `unit` | `text`, nullable | e.g. "pcs", "m", "hrs" — free text with a small preset list in the UI, not a rigid enum (spec: "manual free text MUST always remain possible"). |
| `discount` | `numeric(14,2)`, nullable, default 0 | Flat LKR amount subtracted from `qty × customerPrice` for this line — matches every other discount field in this codebase (amount, not percentage). |
| `invoiceable` | `boolean`, not null, default `true` | Whether this line may appear on the customer invoice. Defaults true for customer-facing items; the UI defaults it **false** for internal-only cost lines (e.g. a "purchased" line's raw purchase cost row is never itself a customer line — see §2.3). |
| `purchased_for_job` | `boolean`, not null, default `false` | Set true when a `source='stock'` line's stock was received specifically for this job via the External-Purchase→Add-to-Inventory path (§2.2), even though its *source* is correctly `stock` once received. Powers the Part 16 Purchased-for-Job filter without conflating "was in the warehouse already" with "we just bought this for you." |
| `is_replacement` | `boolean`, not null, default `false` | Part 6. |
| `old_component_name` | `text`, nullable | Free text; paired with the taxonomy picklist in the UI (§2.4), never forced to it. |
| `old_component_serial` | `text`, nullable | |
| `old_component_disposition` | `text`, nullable, CHECK `returned_to_customer\|retained_by_company\|sent_for_warranty\|disposed\|repairable_core_return\|unknown` | |
| `new_component_serial` | `text`, nullable | |
| `warranty_type` | `text`, nullable, CHECK `none\|company\|supplier\|manufacturer` | |
| `warranty_days` | `integer`, nullable | Stored in days (not months) — matches the existing `serviceIntervalDays`/`computeServiceDueFromDays` convention already used for AC service scheduling (`ac-service.ts`), so warranty-expiry math reuses the same "days from a date" helper shape instead of inventing a parallel months-based one. The UI offers day *and* month presets (30/90/180/365 days, matching the existing service-interval preset pattern) and converts. |
| `warranty_start_date` | `date`, nullable | Defaults to job completion date in the UI; overridable. |
| `warranty_expiry_date` | `date`, nullable | Computed client-side at save time (`warranty_start_date + warranty_days`) and stored, not computed on every read — same "store the derived date" pattern `ac_jobs.service_due_date` already uses, for cheap querying/sorting later. |
| `notes` | `text`, nullable | Part-line notes, distinct from the job's own `notes`. |

All new columns are added via `alter table ... add column if not exists`
in a **new** migration; the two CHECK constraints on `item_type`/`source`
are widened via `alter table ... drop constraint ...` + `add constraint`
(both additive operations — no existing row can violate a widened
constraint). The `job_items` view and its three `INSTEAD OF` trigger
functions are rebuilt with `create or replace` to include the new columns,
preserving **every** existing role/financial-masking check verbatim (see
§5) — nothing about who-can-write-what changes, only what fields exist to
write.

**Deliberately not a new table.** A "job part line" is still one
`job_items` row — replacement/warranty/discount/invoiceable are
attributes *of* a line, not a second entity that would need its own
join, its own RLS, and its own place to go out of sync with the line it
describes.

### 2.2 External purchase → inventory/expense bridge (Part 5, Part 4/5's disclosed gap)

Two distinct outcomes, chosen explicitly in the UI (spec: "Allow two
choices"), both reusing existing write paths rather than inventing new
ones:

- **"Expense only"** — `source='purchased'`, no stock movement (unchanged
  behavior), **plus** a new `createExpense()` call
  (`category: 'parts_purchase'` — a new `ExpenseCategory` value,
  distinct from `outsourced_repair` which already means "paid a
  subcontractor," and distinct from `equipment_rental`/`parking`) with
  `jobId` set to this job. Closes HVAC Phase 4/5's own disclosed gap
  ("won't appear in shop-wide expense totals or VAT input-tax figures
  yet") using the exact mechanism Phase 7 already built for exactly this
  purpose. **Double-count guard**: `computeJobProfitability` already
  treats "Other" as `Σ job_items(service/transport/other) + linked
  Expenses`; a `parts_purchase`-category linked Expense is summed once,
  same as any other linked Expense — and the `purchased` job_items line
  itself is what already counts as Material cost (§ formula in
  `job-profitability.ts`), so the *Expense record* created here is
  **purely for shop-wide expense/VAT-input reporting**, not fed a second
  time into this job's own Material cost. Documented inline in the new
  code exactly like the existing `outsourced_repair` guard is.
- **"Add to Inventory"** — the purchased quantity is received into a real
  product via the existing `applyStockMovement()` (`type: 'purchase'`,
  `direction: 'in'`, `relatedJobId`, `relatedSupplierId`), and
  `product.buyPrice` is updated to the purchase's unit cost — the exact
  two effects `createPurchase` (GRN) already has, reused rather than
  reimplemented (`createPurchase` itself isn't reused directly because it
  requires a full multi-line GRN with VAT/cheque/credit-balance handling
  that doesn't fit "I bought one compressor for one job" — the shared
  primitive both already call, `applyStockMovement` + the same
  `buyPrice = unitCost` assignment, is what's reused). If no matching
  product exists yet, one is created first via the same shape
  `addProduct` already builds (name/category/buyPrice/sellPrice, `unit`
  field from Phase 2's sector-fields). The job line itself is then a
  normal `source='stock'` line (so the existing historical-cost snapshot
  guarantee applies to it identically), with `purchasedForJob: true` so
  it's still distinguishable in the Purchased-for-Job filter (§2.1). The
  "quantity purchased" and "quantity used on this job" are separate
  fields in the UI (default equal) — a technician who buys 2 capacitors
  and uses 1 ends up with 1 real unit of spare stock, not a phantom
  deficit.

### 2.3 Invoice integration (Part 12)

`JobInvoiceView` gains a second rendering path:

- **New jobs with itemized lines**: when the job has any
  `job_items` where `invoiceable = true`, render one invoice line per
  item (`name`, `qty`, `unit`, `customerPrice` as unit price, `discount`,
  line total = `qty × customerPrice − discount`), summed to a subtotal
  that becomes the invoice total — **not** `job.quotedAmount` directly,
  since Quote and actual itemized Invoice are allowed to differ (Part 10's
  explicit instruction). Internal-only lines (`invoiceable = false` —
  every `unitPrice`/purchase-cost figure) **never** reach this component;
  it only ever receives the already-masked `customerPrice`/`invoiceable`
  fields, the same defense-in-depth the rest of this app relies on
  (financial masking happens at the DB view layer regardless of what the
  UI does with the response).
- **Old/simple jobs with no itemized lines** (every job created before
  this phase, and any job where the owner never itemizes): unchanged —
  one line at flat `quotedAmount`, exactly as today. No backfill migration
  needed; this is a per-job, at-render-time branch on whether invoiceable
  items exist, not a schema flag.
- `taxInvoiceAmountsForJob` (VAT splitting) keeps operating on whichever
  total actually applies (itemized subtotal or flat quotedAmount) — VAT
  math itself is unchanged, only its input total varies now.

### 2.4 Component taxonomy (Part 7)

A plain client-side constant list (`HVAC_COMPONENT_TYPES` in a new
`src/lib/hvac-components.ts`), used as a `<datalist>`-style suggestion set
for the "old component" / "new component" name fields — **not** a new DB
table, **not** a rigid `<select>`. Matches the existing pattern this
codebase already uses for AC part categories (`categoriesForSector`) and
brands (`AC_BRANDS`): a maintained list that improves consistency without
blocking free text.

### 2.5 Job Economics (Part 10/11)

`computeJobProfitability`'s formula (Material+Labor+Other → Gross
Profit → Margin) is **unchanged** — it's already correct and this phase
doesn't touch job cost math. What's added is a clearer *presentation*
layer distinguishing:

- **Quote** — `job.quotedAmount` (the estimate), unchanged meaning.
- **Invoice (actual billed)** — the itemized-invoice subtotal from §2.3
  when itemized lines exist, else `job.quotedAmount` (§2.3's exact
  fallback), explicitly labeled "projected" when no itemized invoice
  exists yet, per the brief's "do not assume Quote equals Revenue"
  instruction.
- **Collected** — `job.depositAmount`, unchanged (this app has no
  separate payments-against-invoice ledger for AC jobs; `depositAmount`
  has always been "amount collected so far," documented as such since
  the UI-polish pass).
- **Balance** — Invoice(actual) − Collected, not Quote − Collected (a
  real, small behavior correction: today's header metric computes balance
  from `quotedAmount`, which is wrong the moment an itemized invoice
  total differs from the quote).

### 2.6 Purchased-for-Job filter (Part 16)

A client-side filter over already-loaded `job_items` for the current job
— `all | stock | purchased | manual`, where:
- `stock` = `source === 'stock' && !purchasedForJob`
- `purchased` = `source === 'purchased' || purchasedForJob`
- `manual` = `source === 'manual'`

No new query, no new table — the same distinction §2.1/§2.2 already
store.

### 2.7 AC Asset history + warranty follow-up (Part 14/15)

`fetchAssetJobItems` (HVAC Phase 10, already fetches every job_item for
every job linked to an asset) gains the new replacement/warranty columns
for free once the view exposes them (§2.1) — no new query shape. The
asset's Service History gets a compact "warranty" column per replaced
component; a new small "Active warranties" panel lists
`old/new component, installed date, expiry, source (company/supplier/
manufacturer), supplier` for warranties not yet expired, sorted soonest-
expiring first. **No cron/background job** — per the brief's own
instruction ("do not add unnecessary background cron behavior unless
appropriate") and this codebase's standing pattern (no cron infra exists
for anything comparable — reminders are computed at render time, e.g.
service-due banners), this is a read-time computation over stored dates,
not a scheduled notification. Messaging integration is explicitly
deferred, as the brief allows.

---

## 3. Accounting implications — audited against the double-counting rule

Every new cost-bearing path was checked against
`computeJobProfitability`'s existing buckets before being added, per this
engagement's absolute rule against double-counting:

- **External-purchase "Add to Inventory"**: cost enters Material via the
  normal `source='stock'` line (unchanged mechanism) — the receiving
  movement itself does not touch `job_items`, so it cannot be summed
  twice.
- **External-purchase "Expense only"**: cost enters Material via the
  `source='purchased'` line's `lineTotal` (unchanged mechanism); the new
  linked Expense record is for shop-wide/VAT reporting only and is
  **not** double-summed into this job's own cost (see §2.2's guard,
  mirroring the existing `outsourced_repair`/`subcontractCost` guard
  already in `job-profitability.ts`).
- **`transport`/`other` item types**: fold into the existing "Other"
  bucket exactly like `service` already does — `computeJobProfitability`
  needs one small, mechanical change (its `else` branch already catches
  everything that isn't `part`/`labour` into `otherCost`; widening
  `item_type`'s CHECK doesn't require touching this function's logic at
  all, since `part`/`labour` are the only two special-cased branches and
  everything else already falls through to Other).
- **`discount`**: reduces the *invoice* total (§2.3), never the *cost*
  figures — Material/Labor/Other cost buckets are unaffected by a
  customer-facing discount, matching real accounting (discounting what
  you charge doesn't change what you spent).

## 4. Invoice behavior summary

See §2.3. One more explicit rule, per the brief's Part 12: internal cost
fields (`unitPrice`, `lineTotal`, `discount`'s cost-side sibling, purchase
references) are structurally absent from what `JobInvoiceView` receives —
the itemized-line renderer is only ever given `{name, qty, unit,
customerPrice, discount, invoiceable}`, a narrowed projection built at the
call site, not the full `JobItem`. This makes "internal cost leaks onto
the invoice" a type-level impossibility, not just a rendering choice.

## 5. Role permissions & RLS strategy

No new role is introduced. This codebase's role model is
`owner | manager | data_entry | cashier | technician`
(`src/lib/subscription/types.ts` / `org-role/permissions.ts`) — there is
no separate "accountant" role; `canSeeFinancials()` (owner + manager) is
the existing financial-visibility boundary and is reused as-is for every
new financial field (discount amount reasoning, purchase cost, warranty
*cost* if ever tracked — warranty *dates* are not financial and stay
visible to technician, matching how `ac_assets.warranty_expiry` already
behaves).

- **New `job_items` columns follow the existing masking split exactly**:
  `unit`, `invoiceable`, `discount`'s presence-flag, replacement/warranty
  fields (dates, names, disposition, serial numbers) are **operational**
  data a technician legitimately needs (matches the brief's own Part 20:
  "TECHNICIAN should see parts needed/used, quantity... should NOT
  automatically see gross profit, business margin, purchase cost") — left
  unmasked in the view, like `name`/`qty`/`source` already are.
  `discount` (a money amount) is masked the same way `customer_price`
  already is (`case when can_see_org_financials(...) then i.discount else
  null end`).
- **Insert/Update/Delete role gate is unchanged**:
  `org_member_can_write_module(org_id,'ac_jobs') AND org_member_role_in(
  org_id, ['owner','manager','data_entry','technician'])`. The new
  trigger functions widen the column list they read/write; they do not
  touch this check.
- **Stock-price server-derivation is unchanged and extends naturally**:
  the External-Purchase-to-Inventory path still ends with an ordinary
  `source='stock'` job_items row, so `job_items_view_insert`'s existing
  "derive unit_price from products_base.buy_price server-side" logic
  applies to it automatically — no new server-side price-trust logic is
  needed for that path.
- **New `expenses.category` value** (`parts_purchase`) needs its CHECK
  constraint widened the same additive way as `job_items.source`/
  `item_type` above; `expenses`' existing RLS (financial-role SELECT,
  member INSERT gated by module) is untouched.
- **Cross-tenant isolation**: every new column lives on an existing,
  already-tenant-scoped table (`job_items_base`, `expenses`,
  `products_base`, `stock_logs`) — no new table means no new tenant-scope
  surface to get wrong. The one genuinely new write path
  (External-Purchase's product-creation branch) reuses `addProduct`'s
  existing shape, which is written through the same `products` masked
  view + `organization_id`-stamped insert every other product create
  already uses.
- **Verification plan**: after the migration is written, apply it to the
  live Supabase project (if session access allows) and run the security
  advisor (`get_advisors`) — the same verification method used for every
  prior HVAC-phase migration in this engagement — checking specifically
  that (a) the widened `job_items`/`expenses` CHECK constraints don't
  reject any existing row, (b) the rebuilt `job_items` view still shows
  `security_invoker=false` with its tenant `WHERE` clause intact, (c) no
  new anon/public-executable function appears (the exact class of gap
  found and fixed twice already in this engagement's history for
  workforce-adjacent trigger functions). If live DB access is not
  available or not safe in this session, this is disclosed rather than
  claimed as verified.

### Verification actually performed (job-parts-materials phase)

- **Static re-audit, done**: re-read both new migration files in full
  against the checklist above. Confirmed: (a) every `alter table`/`add
  constraint`/`create or replace` is additive — no existing column,
  constraint, grant, or RLS policy is dropped without an equivalent
  replacement in the same statement; (b) `job_items`' rebuilt view keeps
  `security_barrier = true` + `security_invoker = false` and the same
  `organization_id in (select ... from org_members where user_id =
  auth.uid())` clause, unchanged; (c) all three rebuilt trigger functions
  keep the exact `org_member_can_write_module(...,'ac_jobs') AND
  org_member_role_in(...,['owner','manager','data_entry','technician'])`
  gate, character-for-character, and no new function is created — only
  three existing ones are replaced; (d) the financial-masking `case when
  can_see_org_financials(...)` treatment is applied to every new money
  column (`discount`) and correctly *not* applied to every new
  operational column (component names/serials/disposition, warranty
  dates/type, `unit`, `invoiceable`, `purchased_for_job`) — matching Part
  20's technician-visibility rule exactly.
- **Live DB check (advisor / empirical cross-tenant test), not
  performed**: this session's available Supabase MCP connection lists
  only two projects ("Class" and "nexus-erp"), neither of which is this
  repository's project — there is no live LakBiz Supabase project
  reachable from this session to safely apply these migrations to or run
  `get_advisors` against. Applying them to either listed project would
  mean writing this schema into an unrelated live database, which was
  not done. This is a genuine gap, not a skipped step: whoever deploys
  this phase should apply `20250714000001`/`20250714000002` through
  their normal migration flow against the real LakBiz project and run
  `get_advisors` immediately after, per the checklist above, before
  considering this phase's RLS posture confirmed in production.

## 6. Migration plan (additive files, in dependency order)

1. `job_items` — widen `item_type`/`source` CHECKs, add all new columns
   from §2.1, `create or replace view public.job_items` with the new
   columns, `create or replace function` for all three triggers
   (preserving every existing check verbatim).
2. `expenses` — widen `category` CHECK to add `parts_purchase`.
3. (If needed) a small index on `job_items(warranty_expiry_date)` for the
   Active-warranties panel's soonest-first sort at scale.

No backfill is required — every new column is nullable or has a safe
default (`invoiceable default true`, `purchased_for_job default false`),
so every pre-existing row is valid the instant the migration runs, and
every pre-existing job continues to invoice exactly as it does today
(§2.3's fallback path).

---

*Audit and architecture complete. Proceeding to implementation per §2,
schema first.*
