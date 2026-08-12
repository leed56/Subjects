# LakBiz Implementation Progress

Source of truth for resuming work across sessions. Update this file at the
end of every phase.

## Completed

### Phase 0 — Safety, architecture & baseline
Branch: `claude/lakbiz-phase0-audit-security`. Status: implemented, build
verified, **not yet pushed/PR'd** — see note at end of this file.

Files changed:
- `docs/ARCHITECTURE_AUDIT.md` (new) — full findings, see for detail.
- `app/public/sw.js` — stopped caching authenticated document responses;
  only `/` and `/login` may ever be cached/replayed offline.
- `app/next.config.ts` — added CSP + security headers (`X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`).
- `app/package.json` — bumped `next` 16.2.9 → 16.3.0 (patches 4 high-severity
  CVEs including a middleware/proxy bypass); added `typecheck` and `verify`
  scripts; `npm audit fix` for dev-tooling advisories. `npm audit`: 0 vulns.
- `app/scripts/qa-tenant-isolation.mjs` (new) — cross-tenant RLS QA harness,
  not yet run (needs two test-org credentials this session doesn't have).

Migrations created:
- `supabase/migrations/20250628000001_org_members_single_membership.sql` —
  additive `unique (user_id)` on `org_members`, formalizing the
  single-org-per-user model already assumed everywhere in the app code.
  **Not applied** — self-checks for duplicate memberships and raises a clear
  exception if found; that check has not been run against production
  (no DB connection available this session).

Behavior changed:
- PWA offline mode no longer serves any previously-cached authenticated page
  (dashboard, sales, customers, etc.) to a different user on a shared device.
- All responses now carry CSP/security headers.
- `next` patched to close known CVEs.

Tests performed:
- `npx tsc --noEmit`: clean before and after all changes.
- `npm run build`: succeeds, all 41 routes.
- `npm audit`: 0 vulnerabilities (was 4 high in Next.js alone before the bump).
- RLS tenant-isolation script written but **not executed** — no test
  credentials / DB access in this session. Must be run before relying on it.
- **CSP verified live** against the PR's Vercel preview deployment
  (`subjects-git-claude-lakbiz-phase0-audit-security-nexuserp.vercel.app`):
  `/` and `/login` both return HTTP 200 with all five security headers
  present, and the rendered HTML's `<script>` tags are all same-origin
  `/_next/static/...` (allowed by `script-src 'self'`), so the CSP does not
  block hydration. This closes remaining-risk item 3 below.

Remaining risks (see ARCHITECTURE_AUDIT.md §11 for full detail):
1. RLS cross-tenant isolation not live-verified this session.
2. Single-membership migration not applied — needs a duplicate check against
   production first.
3. ~~CSP not render-tested against a live deploy~~ — verified against the PR
   preview deployment (see Tests performed above). Still worth a full manual
   pass over every route once real Supabase env vars are attached to that
   preview, since this check only confirms headers + no blank page, not
   every feature.

### Phase 1 — Design system & application shell
Branch: `claude/lakbiz-phase1-design-shell`, stacked on Phase 0
(`claude/lakbiz-phase0-audit-security` — PR #24). Status: implemented, build
verified, not yet pushed/PR'd — same checkpoint pattern as Phase 0.

Files changed:
- **New:** `src/lib/nav-sections.ts` — single shared nav model (grouped
  Sales/Inventory/Service/Finance/Management sections + standalone
  Dashboard), replacing the flat array that used to be duplicated inline
  inside `site-header.tsx`. Trimmed to routes that exist today — no
  "Invoices"/"Payments"/"AC Assets"/"Schedule" entries, those are later-phase
  pages and a nav link to a page that doesn't exist would be a regression,
  not progress.
- **New:** `src/components/shell/` — `app-shell.tsx` (top-level shell:
  Sidebar + MobileNav + the existing Trial/Offline/CloudSync banners and PWA
  install prompt, unchanged), `sidebar.tsx` (desktop, persistent, grouped,
  with an org/user/role/sign-out footer), `mobile-nav.tsx` (compact top bar +
  slide-out drawer, same nav model), `use-shop-nav.ts` (shared
  permission-filtered nav — one place computing "what can this role see,"
  not two that could drift), `nav-icons.tsx` (href → icon lookup).
- **New:** `src/components/ui/icons.tsx` — 24 hand-rolled inline SVG icons
  (no new dependency — a full icon library for ~15 nav glyphs plus a dozen UI
  icons wasn't justified).
- **New:** `src/components/ui/{toast,overlay,primitives,form,table}.tsx` —
  the reusable primitive set the spec asked for: `ToastProvider`/`useToast`,
  `Drawer`/`Dialog`/`ConfirmDialog` (Escape-to-close, focus return, body
  scroll lock), `PageHeader`/`SectionHeader`/`MetricCard`/`EmptyState`/
  `StatusBadge`/`SearchInput`/`FilterBar`/`Tabs`/`ActionMenu`,
  `FormField`/`MoneyInput`/`DateInput`/`SelectInput`/`TextInput`,
  `DataTable` (desktop table ↔ mobile stacked-card same component). Design
  language: ~8-12px radius, subtle borders, minimal shadow — deliberately
  less rounded/less shadow-heavy than `pro-shell.tsx`'s existing
  `rounded-[2rem]`/`shadow-xl` look. `pro-shell.tsx` itself is untouched;
  pages migrate off it page-by-page in later phases, not in one sweep here.
- `src/app/layout.tsx` — mounted `ToastProvider` globally.
- `src/lib/i18n/translations.ts` — added `nav.section.*` and
  `nav.settings_shop` keys (si + en).
- **16 pages migrated** off the old per-page `<SiteHeader />` +
  `<ProPageShell>` to `<AppShell>`: dashboard, sales, stock, suppliers, jobs,
  workforce, vehicles, bills, bills/[id], customers, banking, vat,
  settings/team, settings/plans, settings/shop, settings/notifications.
  Mechanical, uniform swap (`<ProPageShell><SiteHeader />{content}` →
  `<AppShell>{content}`) verified file-by-file; page *content* inside
  `<ProMain>` is untouched — only the chrome around it moved. `login.tsx` and
  `sectors/*.tsx` intentionally left on the old header — they're
  public/marketing pages, not part of the authenticated shop shell.

Behavior changed:
- Every authenticated shop/settings page now shares one left sidebar
  (desktop, `lg:` breakpoint) or compact top bar + drawer (mobile) instead of
  each page independently rendering its own horizontal top nav. No more
  duplicated nav mounting logic across 16 files.
- A global toast system is available app-wide via `useToast()`.

Tests performed:
- `npx tsc --noEmit`: clean after every batch of page migrations (checked
  incrementally, not just once at the end).
- `npm run build`: succeeds, all 41 routes, including static prerender of
  every migrated page (Next.js would fail the build on a server render
  error — it didn't).
- `npm run lint`: 0 errors, same 3 pre-existing warnings as Phase 0 (none in
  Phase 1 files).
- Verified in the built static HTML output (`.next/server/app/*.html`) that
  the new `<aside>` sidebar actually renders on dashboard/customers/stock/
  sales/bills/vat/banking, and that the old top-nav's distinguishing classes
  are gone from all of them — not just "the build didn't error," an actual
  check that the intended element is present.
- **Not done:** a real browser/visual pass (no browser available in this
  session beyond curl + static HTML inspection). Recommend opening the PR's
  Vercel preview and clicking through every migrated page before merging —
  build success proves it renders without crashing, not that spacing/mobile
  breakpoints/every interactive state looks right.

Remaining risks / deliberately deferred:
1. No visual QA — see above.
2. `pro-shell.tsx`'s `ProCard`/`ProStatCard`/`ProPageHeader` components
   (rounded-[2rem], heavy shadows) are still used by every migrated page's
   *content* — only the surrounding chrome changed in Phase 1. Phases
   2/3/10 etc. replace page content with the new primitives as each of
   those pages gets its own redesign; doing it here too would have been the
   "uncontrolled whole-project refactor" the spec explicitly says not to do.
3. `NAV_SECTIONS` groups routes conceptually per the spec's target structure
   but is necessarily smaller than the spec's target nav (no Invoices,
   Payments, Installations, AC Assets, Teams, Schedule — those pages don't
   exist yet). Update `src/lib/nav-sections.ts` as each of those phases adds
   its page, not before.

### Phase 2 — Customer CRM redesign
Branch: `claude/lakbiz-phase2-customer-crm`, stacked on Phase 1
(`claude/lakbiz-phase1-design-shell` — PR #25, stacked on #24). Status:
implemented, build verified, not yet pushed/PR'd.

Files changed:
- `src/app/customers/page.tsx` — full interaction-model rewrite. Preserves
  every existing business behavior 1:1 (payment recording, B2B wholesale
  pricing, bulk WhatsApp, CSV export, per-customer WhatsApp send, ledger
  calculation via the existing `buildLedger()`) — only *how you reach* each
  of those changed, not what they do or how they call `useAppStore()`.
- `src/lib/i18n/translations.ts` — added `cust.tab_overview`,
  `cust.tab_messages`, `cust.total_sales`, `cust.last_activity`,
  `cust.no_invoices`, `cust.no_payments`, `cust.no_messages` (si + en).

What changed, mapped to the spec's acceptance criteria:
- **"Pressing + New Customer always makes the form immediately visible"** —
  the create/edit form used to be a permanently-rendered `<ProCard>` sitting
  in a 2-column grid next to the search card (not literally below the fold,
  but always visually present and mixed into browsing UI even when nobody
  wants to create anything). It's now a `Drawer` that only exists in the DOM
  while open, triggered by a `+ Add customer` button in the page header —
  opens instantly over the current view, every time, regardless of list
  length or scroll position.
- **Header + metrics** — `PageHeader` with the customer count/outstanding
  total in the description, and a `MetricCard` row (total customers,
  outstanding, over credit limit, recent payments) — same four numbers the
  spec asked for, same data source (`data.customers`/`data.customerPayments`
  reduces that already existed), just placed in the new primitive layout
  instead of `ProStatCard`.
- **Search + type filter** → `FilterBar` + `SearchInput` + the existing
  individual/company toggle, same filtering logic as before.
- **Customer profile** — new `CustomerProfileDrawer`, opened by clicking a
  customer's name in the table. Tabs: Overview, Invoices, Payments, Ledger,
  Messages — all real data, not mocked:
  - Invoices: `data.sales` filtered by `customerId`, linking to the existing
    `/bills/[id]` page.
  - Payments: `data.customerPayments` filtered by `customerId`.
  - Ledger: the same `buildLedger()` call the old standalone ledger modal
    used, now inside the profile drawer instead of a separate dialog.
  - Messages: `useNotificationLogs(org.id)` filtered by
    `contextId === customer.id` — this works today because
    `MessageSendButton` already tags every sent message with the
    customer's id as `contextId`.
  - **Equipment / Service tabs from the spec are intentionally omitted** —
    there is no AC-asset-to-customer data model yet (that's Phase 4). Adding
    those tabs now would mean fabricating empty placeholder UI for data that
    doesn't exist; they get added for real once Phase 4 lands.
- **Delete confirmation** — was a `window.confirm()`; now the `ConfirmDialog`
  primitive.
- **Toast feedback** — the old approach was a `message` string in local
  state rendered as an inline banner at the top of the page (invisible if
  you'd scrolled past it). Save/delete/payment/wholesale-price actions now
  call `useToast()` instead — visible regardless of scroll position, and
  consistent with the global toast system Phase 1 introduced.
- **Row actions** — consolidated into an `ActionMenu` dropdown (Ledger,
  Wholesale prices, Edit, Delete) plus two always-visible primary actions
  (Message, Record payment) — matches "very clear primary actions, avoid
  visual noise" rather than a wall of six equal-weight buttons per row.
- **Website field** — the spec says to stop showing/requesting it if it
  exists in the data model. Checked: it doesn't exist anywhere in
  `Customer`/the `customers` table/the create form. Nothing to remove; N/A.
- **Notes field** — the spec suggests one for individual customers.
  **Deliberately deferred**, not silently dropped: this is local-first data
  synced to Supabase (`useAppStore` → `saveCustomerToCloud` →
  `business-sync.ts`), so adding a field means a coordinated change across
  the additive migration, `Customer` type, cloud sync mapping, *and* local
  storage — a schema+sync change I can't verify round-trips correctly
  without a live database connection or a browser to test offline/online
  sync. Safer as its own tightly-scoped follow-up than bundled into a
  UI-focused phase on unverified faith.

Tests performed:
- `tsc --noEmit`: clean.
- `next build`: succeeds, all 41 routes, `/customers` still statically
  prerenders.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- Inspected `.next/server/app/customers.html`: confirms the `AppShell`
  chrome renders (sidebar present, mobile nav drawer markup present) and the
  old permanently-rendered create-form card is gone from the markup.
  **Caveat, stated precisely this time:** this page's real content (the
  `PageHeader`, `MetricCard`s, `DataTable`, both drawers) only exists after
  client-side data loads from local-first storage — Next's static prerender
  only ever captures the `ProLoadingState` branch for *any* page on this
  pattern (this was already true for every Phase 1 page too, not a Phase 2
  regression; I just checked more precisely this time). Build success proves
  the code compiles, type-checks, and bundles without error — it does not
  prove the table/drawer render correctly with real data. That needs either
  a live database connection or a browser, neither available this session.

Remaining risks:
1. No visual/runtime QA on the actual table + drawer content — see caveat
   above. This is the single most important thing to check on the preview
   before merging: open `/customers` signed in, confirm the metrics/table/
   both drawers render and the create → save → toast → list-updates flow
   actually works end to end.
2. Notes field deferred (see above) — revisit as its own phase if wanted.
3. Equipment/Service profile tabs arrive with Phase 4.

### Out-of-band — critical security fix (between Phase 2 and Phase 3)
Branch: `security/fix-masked-view-cross-tenant-leak`, based on `main`
directly (not stacked on the phase branches — needed to ship immediately).
**PR #27, not draft.**

While preparing to run the Phase 0 RLS-verification checks against the now-
connected production database, found and fixed a **critical, live,
currently-exploitable cross-tenant data leak**: the masked financial views
(`sales`, `sale_lines`, `products`, `ac_jobs`, `contractors`, `vehicles`)
were `security_invoker=false` with no row filter of their own, so any
authenticated user in any shop could read every other shop's customer
names, phones, addresses, job details, and sales through these views.
Confirmed empirically (not just from the linter), fixed directly on
production given severity, then a review comment on the PR caught a real
regression in the first fix attempt (the fix's own grant let clients bypass
column-level cost/profit masking) — corrected and re-verified before
merge. Full writeup: `docs/SECURITY_INCIDENT_2026-08-11.md`. See that PR's
two migrations for the complete, corrected fix.

### Phase 3 — Inventory / Add Stock UX
Branch: `claude/lakbiz-phase3-inventory-ux`, stacked on Phase 2
(`claude/lakbiz-phase2-customer-crm` — PR #26, stacked on #25, #24).
Status: implemented, build verified, not yet pushed/PR'd.

Files changed:
- `src/app/stock/page.tsx` — same interaction-model rewrite pattern as
  Phase 2's customers page. `showForm` used to default to `true` (the
  product create form was rendered unconditionally on page load, mid-page
  after the stat cards) — now a `Drawer`, closed by default, opened only by
  the `+ Add item` button. `ProductForm` itself (the actual field set —
  SKU, name, category, sector-specific fields, cost/sell price, reorder
  level) is untouched, just reused inside the drawer instead of an
  always-rendered `ProCard`.
- Stock In / Stock Out: were hand-rolled `fixed inset-0` overlay divs →
  now the `Dialog` primitive.
- Delete: `window.confirm()` → `ConfirmDialog`.
- Feedback: inline `message` state banner → global toast system.
- Header/metrics/search/filter/table: `PageHeader` + `MetricCard` +
  `FilterBar`/`SearchInput` + `DataTable` (desktop table ↔ mobile cards in
  one component, replacing the separate hand-written `ProductMobileCard`).
  Row actions consolidated: Stock In/Stock Out stay always-visible
  (most-used), Edit/Delete moved into an `ActionMenu`.

**Deliberately out of scope for this pass** (flagged, not silently
dropped): the spec's fuller "Receive Stock" (multi-line supplier GRN entry
— supplier, reference/PO number, date, multiple products, quantities, unit
costs, payment status in one transaction) and "Stock Adjustment" (reason
code + authorized-user audit trail) are **new features**, not a UX fix to
an existing one — `stockInToCloud`/`stockOutToCloud` only support one
product at a time today, with no supplier/reference/payment-status
concept. The DB schema already has unused `purchases`/`purchase_lines`
tables (visible in the base migrations) that look like they were meant for
exactly this, but nothing in the frontend reads or writes them yet.
Building a real multi-line GRN flow on top of them is a properly-scoped
feature (data model decisions, local-first sync plumbing, a new page) —
building it inside a UX-fix phase on unverified assumptions about how
those tables are meant to be used would be exactly the kind of "mocked
production functionality" the spec says not to do. Recommend it as its own
phase once the repo owner confirms whether `purchases`/`purchase_lines`
are meant to be revived for this.

Tests performed:
- `tsc --noEmit`: clean.
- `next build`: succeeds, all 41 routes, `/stock` still statically
  prerenders.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.

Remaining risks: same category as Phase 2 — no real browser/visual pass on
the actual table + drawer content with live data (build success proves it
compiles, not that it behaves correctly at runtime). Check on the preview
before merging: create → save → toast → list-updates, stock in/out dialogs,
edit, delete-confirm.

### Phase 4 — HVAC asset lifecycle management
Branch: `claude/lakbiz-phase4-ac-assets`, stacked on Phase 3
(`claude/lakbiz-phase3-inventory-ux` — PR #28, stacked on #26, #25, #24).
Status: implemented, DB layer empirically verified against production, build
verified, not yet pushed/PR'd.

**Architectural decision, made deliberately and stated up front:** this
module is **cloud-only** — it reads/writes straight to Supabase via a new
`src/lib/supabase/ac-assets-client.ts`, the same simple direct-client
pattern already used by `org-settings.ts` and `notification-log-client.ts`,
rather than the local-first sync engine (`business-sync.ts` at 2,622 lines,
`app-store-provider.tsx` at 3,482 lines) every other entity goes through.
Wiring a new entity into that engine correctly — with no browser available
to verify the offline/sync round-trip — was judged higher risk than
shipping a real, RLS-verified module now that requires being online. See
the migration file for the full reasoning. Revisit adding offline support
once it can be tested properly.

Migrations created (both applied directly to production and empirically
verified — not just written):
- `20250629000001_ac_asset_lifecycle.sql` — new `ac_assets` table (brand,
  model, serials, BTU, AC type, refrigerant, install date, warranty expiry,
  location, status, next service date, notes; optional `customer_id` FK),
  RLS following the exact `organization_id in (select ... from org_members
  where user_id = auth.uid())` pattern from `rls_hardening.sql`. Also adds
  a nullable `asset_id` FK on `ac_jobs_base` (and the `ac_jobs` view) so a
  job *can* reference the asset it's servicing.
- **Verified empirically before writing any frontend code** (same
  technique as the security incident): inserted a real asset as the IMT
  owner: succeeded. Queried/inserted as a different organization's user:
  0 rows on SELECT, RLS-violation error on INSERT. Confirmed the `ac_jobs`
  view still returns correctly with the new `asset_id` column (null, as
  expected — no job references an asset yet). Test row cleaned up after.

Files changed (frontend):
- `src/lib/supabase/ac-assets-client.ts` (new) — CRUD functions
  (`fetchOrgAssets`, `fetchCustomerAssets`, `createAsset`, `updateAsset`,
  `deleteAsset`, `fetchAssetJobs`) plus the `AcAsset`/`AcAssetInput` types.
- `src/app/assets/page.tsx` (new) — list page on the Phase 1/2/3
  primitives (`PageHeader`/`MetricCard`/`FilterBar`/`DataTable`), a
  create/edit `Drawer`, and an asset profile `Drawer` with Overview + Jobs
  tabs (Jobs tab is a real query against `ac_jobs` filtered by `asset_id`,
  not mocked — currently empty for every asset since no job-creation UI
  can set `asset_id` yet, see below).
- `src/app/customers/page.tsx` — the "Equipment" tab left as a stub in
  Phase 2 is now real: fetches and lists the customer's assets via
  `fetchCustomerAssets`.
- **Route wiring** (`/assets` added everywhere `/vehicles` etc. already
  were, so it's properly guarded, not an accidental hole):
  `src/lib/supabase/middleware.ts` (server-side guard),
  `src/components/shop-route-guard.tsx` (client-side), `src/lib/org-role/permissions.ts`
  (data_entry + technician can access, matching `/jobs`), `src/lib/subscription/can.ts`
  (gated behind the `ac_jobs` plan feature, same as Jobs/Workforce),
  `src/lib/nav-sections.ts` + `src/components/shell/nav-icons.tsx` (Service
  nav group).

**Deliberately out of scope, flagged not dropped:** the existing `/jobs`
page can't yet let someone pick an asset when creating/viewing a job — that
page runs through the local-first sync engine, whose `ACJob` type doesn't
know about `asset_id`. Extending it is the same class of decision as the
cloud-only choice above, just not made yet; the DB and the read path
(Jobs tab on an asset) are ready for it. Until then, `asset_id` can only be
set by a direct DB write.

Tests performed:
- DB layer: verified empirically against production, see above — the
  strongest verification of any phase so far, since I now have direct DB
  access.
- `tsc --noEmit`: clean (after fixing one real error — a `||`/`??`
  precedence issue caught by the compiler).
- `eslint`: 0 errors (after fixing two real `react-hooks/purity` errors —
  the new React Compiler lint correctly caught `Date.now()` being called
  inline in the component body during render; moved those computations
  into plain module-level helper functions instead). Same 3 pre-existing
  warnings, none new.
- `next build`: succeeds, 42 routes now (was 41), `/assets` statically
  prerenders.

Remaining risks: same "no browser" caveat as Phases 2–3 for the frontend.
The DB/RLS layer is unusually well-verified this time; the UI rendering
correctly with live data is not.

### Phase 5 — Service jobs rebuild
Branch: `claude/lakbiz-phase5-service-jobs`, stacked on Phase 4
(`claude/lakbiz-phase4-ac-assets` — PR #29, stacked on #28, #26, #25, #24).
Status: implemented, build verified, write path empirically verified,
not yet pushed/PR'd.

**Scope call, made explicit up front:** the spec's full field-service
status model (New/Scheduled/Assigned/On the way/In progress/Awaiting parts/
Completed/Invoiced/Paid/Cancelled) is **not** implemented this phase. What
was already there — `quote → deposit_received → scheduled → installed →
service_due → completed → cancelled` — is a real, working, actively-used
lifecycle: it drives service-due reminders, the cron job, and messaging
templates throughout `ac-service.ts`/`messaging/*`. Replacing it wholesale
would ripple through the local-first sync engine, the dashboard stats,
and the notification/cron system in ways I can't safely verify without a
browser — exactly the risk class every phase this session has been
declining to take on blind. This phase is the **interaction-model
modernization + safe additive improvements**, not the full status-model
rebuild the spec describes; that's flagged as follow-up work, not silently
dropped.

Files changed:
- `src/app/jobs/page.tsx` — full interaction-model rewrite, same pattern as
  Phases 2/3: create/edit form (previously an inline `ProCard` toggled by
  `showForm`) → `Drawer`; the job-sheet "work order" view (previously a
  fixed-overlay dialog with financials, parts/labour, and status history —
  already a solid work-order view before this phase) → `Drawer`; delete →
  `ConfirmDialog`; feedback → toast. `JobCard`'s dense, already-good
  work-order-style layout is functionally untouched, only its inline
  styling was brought in line with the new design language (less rounded,
  less heavy shadow). All existing business logic — job items, status
  history, service-due tracking, reminder timeline, messaging dispatch,
  financial masking — preserved exactly.
- `src/lib/ac-job-types.ts` — added `inspection`, `warranty`, `other` job
  types, additively. **Not** added: a separate "maintenance" type — the
  existing `service` type already covers that (relabeled "Service /
  maintenance"); service-due tracking and cron/messaging key off the
  literal string `"service"` in enough places that renaming or duplicating
  it would need an audit this session can't safely do blind. Confirmed via
  grep that nothing does an exhaustive switch over `ACJobType`, so the
  additive values are safe.
- `src/lib/supabase/ac-assets-client.ts` — three new functions
  (`fetchAsset`, `fetchJobAssetId`, `linkJobAsset`) closing the Phase 4 gap:
  a job can now reference an AC asset. Deliberately a **direct, narrow
  patch on the `ac_jobs` view's `asset_id` column** rather than extending
  the local-first `ACJob` type/`business-sync.ts` — same reasoning as
  Phase 4's cloud-only decision, scoped even tighter here (one column, not
  a whole entity).
- **Verified empirically before trusting it in the UI** (same technique as
  Phase 4/the security incident): updated `asset_id` on a real job as its
  owning org → succeeded; attempted the same update as a different
  organization's user → 0 rows affected, correctly blocked by the existing
  RLS on `ac_jobs_base`.
- Job-sheet drawer now has an **Equipment section**: shows the linked
  asset if any (via `fetchJobAssetId` + `fetchAsset`), or lets an
  operator pick from the job's customer's assets (via
  `fetchCustomerAssets`, already built in Phase 4) and link one.

Tests performed:
- DB write path (asset linking): empirically verified against production,
  same rigor as Phase 4.
- `tsc --noEmit`: clean.
- `eslint`: 0 errors — cleaned up one real dead-prop warning surfaced while
  merging the job-sheet's two item-entry forms into one (the merge is
  behaviorally identical: price field only shown when `canSeeFinancials`,
  gated by `canOperateJobs`, reproducing the original's
  owner/manager-sees-price vs. data-entry-no-price split exactly).
- `next build`: succeeds, 42 routes, `/jobs` statically prerenders.

Remaining risks: same "no browser" caveat as every UI phase since 1. The
job-sheet's item-entry form merge is a real logic change (two forms → one)
that deserves a closer look on the preview, not just "the build passed."

### Phase 6 — Installation & maintenance crews
Branch: `claude/lakbiz-phase6-crews`, stacked on `main` (Phases 0–5 and the
security fix are all merged as of this phase). Status: implemented, DB
layer empirically verified against production, build verified, pushed —
draft PR #31, awaiting review.

**Scope call, made explicitly because the original spec text for this
phase was no longer available this session** (it was only ever pasted into
chat, never saved to a file, and had scrolled out of context by the time
this phase started — see the doc's own note in earlier phases about this
risk). Asked the repo owner directly rather than guess at a feature this
size; they confirmed: build a real net-new "crew" grouping concept, not a
reskin of the existing Workforce page.

**Naming, stated up front:** deliberately called "crew," not "team" — the
app already overloads "team" to mean "in-house technician" as opposed to
"contractor" (`JobAssigneeType = "team" | "contractor"` on `ac_jobs`, and
the Workforce page's own copy, e.g. `work.team` = "My team"). A crew is a
genuinely different thing: a *named group* of technicians and/or
contractors who work installation or maintenance jobs together. Reusing
"team" for both would have been actively confusing in the UI.

**Architectural decision:** cloud-only, same call as Phase 4's `ac_assets`
— reads/writes go straight to Supabase via `src/lib/supabase/crews-client.ts`,
not the local-first sync engine. See the migration file for the full
reasoning (unchanged from Phase 4's).

Migrations created (applied directly to production and empirically
verified, same technique as every phase since the security incident):
- `20250630000001_crews.sql` — new `crews` table (name, crew_type:
  installation/maintenance/mixed, active, notes) and `crew_members` (a
  polymorphic join — a member is either a `technicians` row or a
  `contractors_base` row, two separate tables, so `member_type` +
  `member_id` rather than a single FK; `organization_id` denormalized onto
  `crew_members` too, so its RLS policy never has to join back to `crews`
  to decide visibility). RLS follows the exact
  `organization_id in (select ... from org_members where user_id =
  auth.uid())` pattern from every prior migration. Also adds a nullable
  `crew_id` FK on `ac_jobs_base` (and the `ac_jobs` view), mirroring
  Phase 4's `asset_id` — a job *can* reference the crew assigned to it.
- **Verified empirically before writing any frontend code:** inserted a
  real crew and a crew member as an IMT-org user: succeeded. Queried and
  attempted to insert as a different organization's user: 0 rows on
  SELECT, RLS-violation error on INSERT, for both `crews` and
  `crew_members`. Confirmed the `ac_jobs` view still returns correctly
  with the new `crew_id` column. Test rows cleaned up after.

Files changed (frontend):
- `src/lib/supabase/crews-client.ts` (new) — CRUD for crews and crew
  membership (`fetchOrgCrews`, `createCrew`, `updateCrew`, `deleteCrew`,
  `fetchCrewMembers`, `fetchOrgCrewMembers`, `addCrewMember`,
  `setCrewMemberLead`, `removeCrewMember`, `fetchCrewJobs`).
- `src/app/teams/page.tsx` (new) — list page on the Phase 1–5 primitives
  (`PageHeader`/`MetricCard`/`FilterBar`/`DataTable`), a create/edit
  `Drawer`, and a crew profile `Drawer` with Members (add/remove
  technicians or contractors, mark a lead) and Jobs (real query against
  `ac_jobs` filtered by `crew_id`, not mocked — currently empty for every
  crew since no job-creation UI can set `crew_id` yet, same caveat as
  Phase 4's asset-jobs tab) tabs.
- **Route wiring**, same treatment `/assets` got in Phase 4:
  `src/lib/supabase/middleware.ts`, `src/components/shop-route-guard.tsx`,
  `src/lib/org-role/permissions.ts` (crews follow `/workforce`'s access
  level — owner/manager/technician, *not* data_entry — since this is
  staffing/scheduling configuration, not front-desk job intake, a
  deliberate distinction from how `/assets` was gated),
  `src/lib/subscription/can.ts` (gated behind the `ac_jobs` plan feature,
  same as Jobs/Workforce/Assets), `src/lib/nav-sections.ts` +
  `src/components/shell/nav-icons.tsx` (Service nav group, after
  Workforce) + `src/components/ui/icons.tsx` (new `CrewIcon` — three
  clustered heads, distinct from `WorkforceIcon`'s two side-by-side
  individuals and from `TeamIcon`, which `/settings/team` already uses).

**Deliberately out of scope, flagged not dropped:** same as Phase 4's
asset_id — the `/jobs` create/edit form can't yet let someone pick a crew,
because that page runs through the local-first sync engine, whose
`ACJobInput` type doesn't know about `crew_id`. The DB and the read path
(a crew's assigned-jobs list) are ready for it; wiring the write side into
the job form is follow-up work, same class of decision as Phase 4's.

Tests performed:
- DB layer: verified empirically against production, see above.
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new (one dead
  function parameter and one `exhaustive-deps` warning surfaced and fixed
  during development — the latter by depending on the full `profileCrew`
  object rather than just its `.id`, matching the pattern Phase 4's
  `AssetsPage` already established for its own profile-drawer effect).
- `next build`: succeeds, 43 routes (was 42), `/teams` statically
  prerenders.

Remaining risks: same "no browser" caveat as every UI phase since 1 — the
member-picker UI (add/remove technician or contractor, set lead) has not
been visually verified.

### Phase 7 — Scheduling (calendar/dispatch board)
Branch: `claude/lakbiz-phase7-schedule`, stacked on `claude/lakbiz-phase6-crews`
(PR #31, not yet merged — same stacking convention Phases 1–5 used pre-merge).
Status: implemented, build verified, pushed — draft PR #32, awaiting review.

**Scope call, same reason as Phase 6:** no spec text available for this
phase either. Asked the repo owner directly; confirmed: a visual
day/week calendar of AC Jobs, not just a filtered list view.

**Architectural decision — the interesting one this phase:** unlike
Phases 4 and 6, this is **not** a cloud-only module. It's built entirely
on the existing local-first `data.acJobs` store (`useAppStore()`), reading
the `scheduledDate`/`status`/`assigneeType`/`assigneeId` fields every job
already has, and rescheduling by calling the *existing*
`updateACJobToCloud(jobId, { scheduledDate })` — the exact same write path
`/jobs` itself already uses for every other field. No new table, no new
migration, no bypass client. The reason Phase 4/6 went cloud-only was
specifically that `asset_id`/`crew_id` are fields the local-first
`ACJobInput` type doesn't know about; scheduling only touches fields that
were already there, so there's no such constraint here — the safer,
simpler choice was to just use the store like every other page does.

Files changed:
- `src/app/schedule/page.tsx` (new) — week view (Mon–Sun, prev/next/this-week
  navigation), one column per day, each showing that day's jobs
  (customer, job type, assignee, status badge, reusing `jobStatusClass`/
  `jobStatusLabel`/`jobTypeLabel` from the existing `ac-jobs.ts`/
  `ac-job-types.ts` helpers rather than reinventing status styling). A
  separate "Unscheduled" strip surfaces quote/deposit_received jobs with
  no date yet. An assignee filter (technician or contractor) narrows the
  whole board. Clicking a job card opens a small reschedule `Drawer` (not
  drag-and-drop — no new dependency for a feature this size, and the data
  model has no time-of-day field to make a hover-drag grid meaningful
  yet, only a date).
- **Route wiring**, same treatment as every prior Service-section page:
  `src/lib/supabase/middleware.ts`, `src/components/shop-route-guard.tsx`,
  `src/lib/org-role/permissions.ts` (access follows `/jobs`'s level —
  owner/manager/data_entry/technician, not cashier; the reschedule
  *action* itself is further restricted to owner/manager/data_entry inside
  the page, technicians get read-only view of the board),
  `src/lib/subscription/can.ts` (`ac_jobs` feature gate, same as
  Jobs/Workforce/Assets/Teams), `src/lib/nav-sections.ts` (placed right
  after Jobs — it's a view over the same data) +
  `src/components/shell/nav-icons.tsx` (reused the existing `CalendarIcon`,
  no new icon needed).

**Deliberately out of scope, flagged not dropped:** crew-column grouping
(the "optionally by crew" half of the original scope question). `crew_id`
lives only in the cloud `ac_jobs` view (Phase 6), not in the local-first
`ACJob` type the rest of this page reads — mixing a local-first list with
a per-row cloud lookup for one column was judged more complexity than this
phase's value justified. Grouping by *assignee* (technician/contractor)
ships now since that data is already on the local-first `ACJob` type
(`assigneeType`/`assigneeId`); true crew-column grouping is a natural
follow-up once/if `crew_id` gets wired into `ACJobInput` (see the
`asset_id`/`crew_id` deferred item below — this is the same underlying
gap, not a new one).

Tests performed:
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new (three real
  dead-variable warnings surfaced and fixed during development — an
  unused status-set constant and two unused date strings left over from
  an earlier draft of the header).
- `next build`: succeeds, 44 routes (was 43), `/schedule` statically
  prerenders.

Remaining risks: same "no browser" caveat as every UI phase since 1 — the
week-grid layout (horizontal scroll on narrow viewports, via
`overflow-x-auto`) and the reschedule drawer have not been visually
verified.

### Phase 8 — Job costing report
Branch: `claude/lakbiz-phase8-job-costing`, stacked on `claude/lakbiz-phase7-schedule`
(PR #32, not yet merged — same stacking convention as Phases 6/7). Status:
implemented, build verified, pushed — draft PR #33, awaiting review.

**Scope call, same reason as Phases 6/7:** no spec text for this phase
either. Asked the repo owner directly; confirmed: a job profitability
report (quoted vs actual cost vs margin across jobs), not just a per-job
breakdown bolted onto the existing Job Sheet.

**No new data needed — this is a pure aggregation.** Every number the
report shows already exists in the local-first store: `job.quotedAmount`
(what the customer was quoted), `data.jobItems` filtered by `jobId` and
summed by `lineTotal` (materials/labour/subcontracted-service line items
already entered on the Job Sheet in Phase 5 — and already hidden from
`data_entry` there via `canSeeFinancials`, i.e. this report surfaces
numbers that were always cost data, just never aggregated), and
`job.subcontractCost` for contractor-assigned jobs. `margin = quotedAmount
− (itemsCost + subcontractCost)`. No migration, no new table, same
"just read the local-first store" pattern Phase 7 used.

Files changed:
- `src/app/job-costing/page.tsx` (new) — metrics row (total quoted, total
  cost, total margin, average margin %), search + status/type/sort
  filters, a table of jobs with quoted/cost/margin per row (margin in red
  when negative). **Access gated to owner/manager only**, both server-side
  (route guard, same mechanism as every other gated page — deliberately
  *not* added to `data_entry`'s or `technician`'s route lists, so the
  existing owner/manager bypass in `canAccessShopRoute` is the only path
  in, no special-casing needed) and client-side (an explicit
  `EmptyState` fallback if the role check somehow fails, so cost/margin
  numbers never flash on screen for a non-financial role even briefly).
- **New `CostingIcon`** (bar chart, rising trend) in `src/components/ui/icons.tsx`
  — distinct from `VatIcon`'s document shape.
- **Route wiring**: `src/lib/supabase/middleware.ts`,
  `src/components/shop-route-guard.tsx`, `src/lib/org-role/permissions.ts`
  (documented as owner/manager-only in the role matrix at the top of the
  file), `src/lib/subscription/can.ts` (`ac_jobs` feature gate),
  `src/lib/nav-sections.ts` — placed in the **Finance** section (after
  VAT), not Service, since it's a financial report like Banking/VAT, not
  a job-operations surface like Jobs/Schedule/Assets/Teams.

Tests performed:
- `tsc --noEmit`: clean (one real error caught and fixed — `ACJobType` is
  exported from `ac-job-types.ts`, not re-exported from `store/types.ts`
  the way `ACJob` is; fixed the import path).
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- `next build`: succeeds, 45 routes (was 44), `/job-costing` statically
  prerenders.

Remaining risks: same "no browser" caveat as every UI phase since 1 — the
margin math itself was reasoned through carefully (traced exactly where
`unitPrice`/`lineTotal` come from in the existing Job Sheet code to confirm
they represent internal cost, not a customer-facing price) but has not
been checked against real job data with real items attached.

### Phase 9 — AC job invoicing
Branch: `claude/lakbiz-phase9-job-invoicing`, stacked on `claude/lakbiz-phase8-job-costing`
(PR #33, not yet merged — same stacking convention as Phases 6–8). Status:
implemented, build verified, pushed — draft PR #34, awaiting review.

**Scope call, same reason as Phases 6–8:** no spec text for this phase
either. Asked the repo owner directly, with context: Sales already has a
full printable/WhatsApp-shareable invoice system (`InvoiceView` +
`invoice.ts`), but it's typed directly against `Sale`'s `lines`/`billNo`/
`discount` shape — AC Jobs have no equivalent, just a single
`quotedAmount` number and a rich set of WhatsApp *text* templates (quote,
deposit, scheduled, installed, completed) but no formal printable
*document*. Confirmed scope: build that missing document, same
look/UX as the Sales invoice, not a smaller "balance due" summary bolted
onto the Job Sheet.

**Important architectural decision, checked carefully before writing any
UI:** the invoice does **not** itemize from `data.jobItems` (the
materials/labour/subcontract lines entered on the Job Sheet in Phase 5).
Traced exactly where those numbers come from in `jobs/page.tsx` first —
`unitPrice` on a job item is hidden from `data_entry` behind
`canSeeFinancials` when adding one, and the running total feeds the Job
Sheet's internal profit metric (`quotedAmount − itemsTotal −
subcontractCost`, see Phase 8). That's the shop's cost basis, not a
customer-facing price breakdown. Printing it on a document handed to the
customer would leak margin. The invoice instead has one line item — job
type + description — at the single `quotedAmount` the customer actually
agreed to, with deposit paid and balance due shown underneath. This is
the same number every job WhatsApp template already treats as "what the
customer owes" (`variablesFromContext`'s `balance = quotedAmount −
depositAmount` in `messaging/compose.ts`), just formatted as a proper
printable/shareable document instead of only a chat message.

Reuses `job.jobNo` as the invoice reference rather than adding a separate
invoice-number column/sequence — no new migration this phase either,
continuing Phase 7/8's "just build on what's already there" pattern.

Files changed:
- `src/lib/job-invoice.ts` (new) — `taxInvoiceAmountsForJob` and
  `buildJobInvoiceText`, mirroring `invoice.ts`'s `Sale` functions but
  built fresh for `ACJob` rather than sharing code (the existing functions
  are typed too tightly against `Sale`'s shape to share safely).
- `src/components/job-invoice-view.tsx` (new) — `JobInvoiceView`, visually
  mirrors `InvoiceView` line-for-line (tax-invoice legal box, seller/buyer
  blocks, print + WhatsApp actions, amount-in-words) so a job invoice and
  a sales bill look like the same document family.
- `src/app/jobs/[id]/invoice/page.tsx` (new) — mirrors `/bills/[id]`'s
  structure exactly. Reached only via a "View invoice" link added to the
  Job Sheet drawer in `jobs/page.tsx` (`import Link from "next/link"`
  added there) — not a new nav entry, same as `/bills/[id]` isn't one
  either.
- **No route-wiring changes needed anywhere** — `/jobs/[id]/invoice`
  already falls under the existing `"/jobs"` prefix match in
  `middleware.ts`/`shop-route-guard.tsx`/`permissions.ts` (all three use
  `pathname.startsWith(prefix + "/")`), so it inherits `/jobs`'s exact
  existing access level (owner/manager/data_entry/technician, not
  cashier) automatically. Deliberately no financial-role restriction on
  the invoice itself, since it only ever shows the customer-facing total/
  deposit/balance, never cost or margin.

Tests performed:
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new (one real
  unused import caught and fixed — `buildJobInvoiceText` imported but
  only used indirectly via `jobInvoiceWhatsappUrl`).
- `next build`: succeeds. `/jobs/[id]/invoice` is dynamic (ƒ), same as
  `/bills/[id]` — the static-page count stayed at 45 (unchanged from
  Phase 8) since dynamic routes aren't part of that count, not because
  nothing was added.

Remaining risks: same "no browser" caveat as every UI phase since 1 — the
print layout, the tax-invoice legal box, and the WhatsApp share text have
not been visually checked against a real job.

### Phase 10 — Dashboard rebuild
Branch: `claude/lakbiz-phase10-dashboard`, stacked on `claude/lakbiz-phase9-job-invoicing`
(PR #34, not yet merged — same stacking convention as Phases 6–9). Status:
implemented, build verified, pushed — draft PR #35, awaiting review.

**Scope call, same reason as Phases 6–9:** no spec text for this phase
either. Asked the repo owner directly; confirmed: UI modernization only —
same pattern as Phases 2/3/5 (migrate onto the Phase 1 design system,
same widgets/data, no new features, behavior preserved 1:1), not a
rethink of what the dashboard shows. The dashboard was the one page
Phase 1 deliberately left on `pro-shell.tsx` primitives — it already had
real, working content and migrating it alongside 16 pages' chrome swap in
one sweep was judged too much surface area for that phase; this is the
follow-up.

**Every stat, panel, and piece of business logic is unchanged** —
`getDashboardStats`, `getVatQuarterSummary`, `getIncomeTaxYearSummary`,
the accountant CSV export (identical label set, identical
`exportAccountantPack` call), `AcServiceDuePanel`, `AcServiceDoneDialog`,
`OfflineSyncNotice`, and the reset-all-data flow are all reused exactly
as they were — only the visual chrome around them moved onto
`PageHeader`/`MetricCard`/`SectionHeader`/`EmptyState`/`StatusBadge`.
Two small, deliberate modernizations in the same spirit as Phase 2's
"delete confirmation: `window.confirm()` → `ConfirmDialog`": the
reset-all-data button now opens the `ConfirmDialog` primitive instead of
a native `confirm()` popup, and the quick-action tiles' emoji icons
(🧾📦👥🏦) became the existing hand-rolled SVG icon set
(`SalesIcon`/`StockIcon`/`CustomersIcon`/`BankingIcon`), matching the "no
emoji as primary production icons" direction from Phase 1 — the
VAT/income-tax meter cards keep their dark accent styling (the one
deliberate departure from the flat card look, since it's a meaningful
visual highlight, not decoration) via a small local `MeterCard` helper
rather than `ProCard`'s heavier shadow/radius.

Files changed:
- `src/app/dashboard/page.tsx` — full rewrite onto Phase 1 primitives;
  `ProPageHeader`/`ProStatCard`/`ProCard`/`ProBadge`/`ProButton`/
  `ProEmptyState` all replaced. No data/store-hook changes.

Tests performed:
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- `next build`: succeeds, `/dashboard` still statically prerenders (same
  as before — it was already static).
- **Verified in the built static HTML** (`.next/server/app/dashboard.html`,
  same technique Phase 1 used): zero occurrences of the old
  `rounded-[2rem]` pro-shell signature class, 12 occurrences of the new
  `rounded-xl` primitive style — confirms the migration actually took
  effect in the rendered output, not just "the build didn't error."

Remaining risks: same "no browser" caveat as every UI phase since 1 —
this is the densest page migrated so far (12+ stat cards, three
list panels, two accent meter cards, conditional vehicles/AC-jobs
sections, the service-due panel), and the static-HTML check above only
confirms markup presence, not that every conditional section
(`canSeeFinancials`, `showVehicles`, `showAcJobs`, empty-state branches)
renders correctly with real data across roles.

**Post-ship fix:** a real layout bug was caught from a screenshot of the
live preview after this phase shipped — the income-tax meter card's
eyebrow text ("Estimated income tax · 30%") was rendering as a vertical
sliver of single words instead of a normal line. Root cause: `MeterCard`
laid the eyebrow/title block and the action `Link` out side-by-side with
`flex` + `justify-between`, text column `min-w-0` and the button
`shrink-0` — a `shrink-0` element never yields width back to its
`min-w-0` sibling, so the button's long label ("Company income tax
estimate", much longer than the VAT card's "VAT return") squeezed the
text column down to almost nothing. Fixed by moving the button to its
own row below the eyebrow/title instead of beside it, so it can never
compete for horizontal space regardless of container width or label
length. This is exactly the class of bug the "no browser" caveat above
keeps flagging — worth noting that it was a real, user-visible bug, not
a hypothetical one.

### Phase 11 — Business expense tracking
Branch: `claude/lakbiz-phase11-expenses`, stacked on `claude/lakbiz-phase10-dashboard`
(PR #35, not yet merged — same stacking convention as Phases 6–10). Status:
implemented, DB layer empirically verified against production, build
verified, not yet pushed/PR'd.

**Scope call, same reason as Phases 6–10:** no spec text for this phase
either. Checked the codebase first — there was no general expense-tracking
feature at all, only `subcontractExpense`, a single derived number folded
into the income-tax estimate. Asked the repo owner directly; confirmed:
a full tracking module (category/amount/date/payment method, list +
filter + totals), not just a single manually-entered "other expenses"
figure.

**Architectural decision:** cloud-only, same call as Phases 4/6 — reads/
writes go straight to Supabase via `src/lib/supabase/expenses-client.ts`,
not the local-first sync engine. See the migration file for the full
reasoning (unchanged from those phases').

**Access level:** owner/manager only, same mechanism as Phase 8's job
costing report (absent from every non-financial role's route list, so
the existing owner/manager bypass in `canAccessShopRoute` is the only
path in) — expense amounts are exactly the kind of cost data already kept
from `data_entry` everywhere else in the app.

**The income-tax integration, and why it's scoped narrower than first
proposed:** `getIncomeTaxYearSummary` (used by both the Dashboard and
`/vat`) is a pure function over the local-first `AppData` snapshot;
expenses live in a separate cloud table, so they can't be computed inside
it the way `subcontractExpense` is. Added an optional `otherExpenses`
parameter (defaults to 0, so both existing callers are unaffected unless
they opt in) rather than touching the sync engine. Deliberately did
**not** wire a cloud fetch into the Dashboard or `/vat` pages this
phase — both are currently synchronous renders straight off already-loaded
local-first data, and adding async cloud state to two already-shipped,
working, financially-sensitive pages (introducing a real loading-state
window where the estimate could visibly jump once expenses arrive) was
judged higher-risk than shipping a working, self-contained module now,
same reasoning Phase 4 gave for not wiring `asset_id` into the `/jobs`
form. Instead, `/expenses` itself is the one place that calls
`getIncomeTaxYearSummary` twice (with and without the fiscal-year expense
total) and shows the delta as a "Tax impact" metric — real use of the new
parameter, proving it works, without touching either existing caller.

Migrations created (applied directly to production and empirically
verified, same technique as every phase since the security incident):
- `20250701000001_expenses.sql` — new `expenses` table (category — a
  fixed set: rent/utilities/salaries/fuel/transport/supplies/maintenance/
  insurance/marketing/other — amount, date, payment method, vendor,
  notes). RLS follows the exact `organization_id in (select ... from
  org_members where user_id = auth.uid())` pattern from every prior
  migration.
- **Verified empirically before writing any frontend code:** inserted a
  real expense as an IMT-org user: succeeded. Queried and attempted to
  insert as a different organization's user: 0 rows on SELECT,
  RLS-violation error on INSERT. Test row cleaned up after.

Files changed:
- `src/lib/supabase/expenses-client.ts` (new) — CRUD (`fetchOrgExpenses`,
  `createExpense`, `updateExpense`, `deleteExpense`).
- `src/app/expenses/page.tsx` (new) — list on the Phase 1–10 primitives
  (`PageHeader`/`MetricCard`/`FilterBar`/`DataTable`), a create/edit
  `Drawer`, metrics for this month / this fiscal year / estimated tax
  impact.
- `src/lib/income-tax.ts` — added the optional `otherExpenses` parameter
  described above; `IncomeTaxYearSummary` gained an `otherExpenses` field
  for transparency. No changes to either existing caller
  (`dashboard/page.tsx`, `vat/page.tsx`).
- **New `ExpenseIcon`** (banknote with a value emblem) in
  `src/components/ui/icons.tsx` — distinct from `BillsIcon`'s receipt
  (money in) and `BankingIcon`'s bank front.
- **Route wiring**, same treatment as Phase 8's `/job-costing`:
  `src/lib/supabase/middleware.ts`, `src/components/shop-route-guard.tsx`,
  `src/lib/org-role/permissions.ts` (documented owner/manager-only in the
  role matrix), `src/lib/nav-sections.ts` — placed in the **Finance**
  section between VAT and Job Costing (record money out, next to record
  money in, before the profitability report), deliberately **ungated by
  plan feature** (no `feature` key), matching `/vat`'s own precedent —
  both are core accounting surfaces, not an AC-jobs-specific or
  addon-gated module.

Tests performed:
- DB layer: verified empirically against production, see above.
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- `next build`: succeeds, 46 routes (was 45), `/expenses` statically
  prerenders.

Remaining risks: same "no browser" caveat as every UI phase since 1 —
the create/edit drawer and the tax-impact calculation have not been
visually verified. The Dashboard/VAT pages still show the income-tax
estimate *without* the expenses deduction — see the architectural
decision above; this is a stated, deliberate scope boundary for this
phase, not an oversight.

## Not started

Phases 12–18 (workforce/roles, messaging integration, reporting, mobile
field UX, performance/a11y, final security audit, final QA). Plus
deferred items: customer notes field, Receive Stock / Stock Adjustment as
real features, `schema_migrations` RLS (single-membership migration
`20250628000001` also still unapplied — needs a duplicate-membership
check against production first), offline support for AC Assets and
Crews, the full field-service status/dispatch model (New/Assigned/On the
way/Awaiting parts/Invoiced/Paid), before/after photos, customer
signature, wiring `asset_id`/`crew_id` into the `/jobs` create/edit form
(this is also what blocks true crew-column grouping on the Schedule
board — see Phase 7), drag-and-drop rescheduling, time-of-day scheduling
(the data model is date-only right now), per-job-type costing
benchmarks/targets (Phase 8's report shows actuals only), a distinct
job-invoice numbering scheme (Phase 9 reuses `jobNo` as the invoice
reference), and wiring the Phase 11 expenses deduction into the
Dashboard/VAT income-tax display (currently only `/expenses` itself
shows the tax impact).

## Next exact tasks

1. Push `claude/lakbiz-phase11-expenses`, open a draft PR stacked on
   `claude/lakbiz-phase10-dashboard` (PR #35 — merge #31→#32→#33→#34→#35
   first, or review this one with that in mind).
2. Visual/click-through pass on the Phase 11 preview, signed in as an
   owner/manager — add a real expense, check the this-month/this-fiscal-
   year totals, and confirm the tax-impact figure matches
   `expense-total × income-tax rate`.
3. Begin Phase 12 (Workforce/roles) as its own branch/PR once Phase 11 is
   reviewed — get the actual spec text for it from the repo owner first
   if it's not already available, same as Phases 6–11 had to.
