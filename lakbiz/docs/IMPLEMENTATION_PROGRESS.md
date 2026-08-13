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
verified, pushed — draft PR #36, awaiting review.

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

### Phase 12 — Editable team roles + member removal
Branch: `claude/lakbiz-phase12-team-roles`, stacked on `claude/lakbiz-phase11-expenses`
(PR #36, not yet merged — same stacking convention as Phases 6–11). Status:
implemented, build verified, pushed — draft PR #37, awaiting review.

**Scope call, same reason as Phases 6–11:** no spec text for this phase
either. Checked `/settings/team` first, since "Workforce/roles" is vague
on its own: invites already had a role picker
(data_entry/cashier/technician/manager), but the member list below it was
read-only — no way to change someone's role after inviting them, or
remove a member. Asked the repo owner directly; confirmed: fix exactly
that gap, on the existing page, not a bigger unification of Workforce
(technicians/contractors) with login-capable Team accounts.

**No new data model, no migration** — `org_members.role` already existed
and was already writable (invite-time only, until now); this phase adds
two more write paths to the same column plus a delete, all through the
same server-side, service-role-gated pattern `createTeamMember` already
established.

Files changed:
- `src/lib/org-role/create-team-member.ts` — added `updateTeamMemberRole`
  and `removeTeamMember`, mirroring `createTeamMember`'s shape and
  safety checks: both reject acting on the requesting owner's own
  `userId` (can't self-demote or self-remove through this UI) and reject
  acting on a target whose role is `"owner"` (can't touch the org's
  owner row at all) — checked server-side in the helper itself, not just
  hidden in the UI, so this holds even if the request didn't come from
  the page. `removeTeamMember` deletes the `org_members` row only, not
  the underlying Supabase auth account — revokes shop access without
  destroying an account that might be reused or restored by re-inviting,
  matching how "remove team member" works in most SaaS products.
- `src/app/api/settings/team/route.ts` — extended the existing
  action-based `POST` handler (already `"create"`/`"reset_password"`)
  with `"update_role"` and `"remove_member"`, same convention rather than
  introducing PATCH/DELETE verbs the rest of this route doesn't use.
  Still gated by the existing `requireOrgOwner()` check up front — no new
  permission surface.
- `src/app/settings/team/page.tsx` — each member row (except the current
  user's own and the owner's) now has an inline role `<select>` and a
  "Remove" action; removal goes through the existing `ConfirmDialog`
  primitive rather than a native `confirm()` popup, consistent with the
  modernization already applied to every other delete flow since Phase 2.

Tests performed:
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- `next build`: succeeds, still 46 routes (unchanged — this phase
  extended an existing page and API route, added no new ones).

Remaining risks: same "no browser" caveat as every UI phase since 1 —
the role-change and remove flows have not been visually verified end to
end (invite a real second user, change their role, remove them).

### Phase 13 — Messaging integration (Crews + Schedule)
Branch: `claude/lakbiz-phase13-messaging`, stacked on `claude/lakbiz-phase12-team-roles`
(PR #37, not yet merged — same stacking convention as Phases 6–12). Status:
implemented, build verified, pushed — draft PR #38, awaiting review.

**Scope call, same reason as Phases 6–12:** no spec text for this phase
either. Checked first: there's already a mature messaging system
(WhatsApp share, SMS via textlk, bulk composer, templates, notification
logs) wired throughout Jobs/Sales/Customers — but zero messaging
touchpoints in the four newer modules (Crews, Schedule, Job Costing,
Expenses). Asked the repo owner directly; confirmed scope: wire the two
operationally-relevant gaps — notify a customer when their job is
rescheduled, notify a technician/contractor when added to a crew — not a
UI modernization of `/settings/notifications`, and not a bigger rework.
Job Costing and Expenses are internal reports, not customer/team-facing,
so no natural messaging need there.

**No new backend, no new channel, no new template infrastructure** —
this reuses the existing `MessageSendButton` → `MessageComposer` flow
exactly as every other page already does.

- **Schedule:** reschedule a job → drawer switches to a confirmation view
  ("Rescheduled to {date}") with a `MessageSendButton` defaulting to the
  existing `job_scheduled` template (already used elsewhere for the same
  "install scheduled" concept — reused, not duplicated), instead of
  closing immediately. This was a deliberate UX choice over auto-sending:
  staff decide per-job whether the customer needs telling, and the
  composer still lets them edit the message before it goes out.
- **Crews:** each member row gets a `MessageSendButton` (icon variant)
  alongside the existing lead/remove `ActionMenu`. Uses the **existing**
  `"custom"` message context (`{type: "custom", business, customerName}`)
  rather than adding a new `"crew"` context type to the shared
  `MessageContext` union — extending that union would touch
  `variablesFromContext`/`defaultTemplateForContext`/`templatesForContext`
  in `messaging/compose.ts` and `templates.ts`, core to every other
  messaging surface in the app; reusing `"custom"` (already a supported,
  general-purpose context) gets a real "message this crew member" button
  today with zero risk to the shared messaging engine. A purpose-built
  "you've been added to a crew" template is a clean, isolated follow-up
  if wanted — flagged, not silently dropped.

Files changed:
- `src/app/schedule/page.tsx` — reschedule drawer gained a
  `justRescheduled` state that swaps the form for a confirmation +
  notify view on save; imports `MessageSendButton`.
- `src/app/teams/page.tsx` — added a `memberPhone` helper alongside the
  existing `memberName`; member rows gained a `MessageSendButton`.

Tests performed:
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- `next build`: succeeds, still 46 routes (unchanged — extended two
  existing pages, added no new routes).

Remaining risks: same "no browser" caveat as every UI phase since 1 —
the reschedule confirmation view and the crew member message button have
not been visually verified, and the `job_scheduled` template's wording
("install scheduled") reads slightly oddly for a *re*schedule of a
service/repair job rather than an installation — flagged as a
copy-polish item, not a functional bug (the underlying date/customer
data is always correct).

### Phase 14 — Business reports page

Branch: `claude/lakbiz-phase14-reports`, stacked on
`claude/lakbiz-phase13-messaging` (PR #38, not yet merged — same
stacking convention as Phases 6–13). Status: implemented, build
verified, pushed — draft PR #39 (https://github.com/leed56/Subjects/pull/39),
awaiting review.

**Scope call, same reason as Phases 6–13:** no spec text for this
phase either. Checked first: the app already has export infrastructure
(`src/lib/export/{csv,reports,print-report}.ts` —
`exportSalesCsv`/`exportVatCsv`/`printSalesReport`/etc.) but no in-app
page for actually *viewing* an analytical report — everything is
CSV/print-out only. Asked the repo owner directly; confirmed scope:
build a `/reports` page — sales-over-time trend, top products, top
customers, viewable in-app — aggregating existing local-first data,
owner/manager only, no new database table or migration.

**No new dependency, same philosophy as Phases 1/7:** confirmed via
`grep` that no charting library is in `package.json`; the trend chart
is a hand-rolled CSS bar chart (flex row of divs with `height` driven
by each day's total ÷ the 14-day max), not a new dependency.

- **Period filter:** 7 days / 30 days / this month / all time, applied
  to the metric cards, top-products table, and top-customers table.
  The 14-day daily trend chart always shows the most recent 14 days of
  activity regardless of the selected period (a multi-year bar chart
  under "all time" would be unreadable and isn't the point of that
  view — the metric cards above already cover totals for the full
  selected period).
- **Metrics:** total revenue, total profit, sales count, average sale
  — computed by reducing over `useAppStore()`'s local-first `sales`
  array, no server round-trip.
- **Top products / top customers:** aggregated client-side from
  `sale.lines` / `sale.customerId`, sorted descending, top 10 shown.
- **Access control:** same pattern as Job Costing and Expenses —
  `/reports` is added to the `ShopNavHref` union and the permission
  matrix comment, but deliberately **not** added to
  `SHOP_STAFF_ROUTES`/`DATA_ENTRY_ROUTES`/`TECHNICIAN_ROUTES` — the
  existing owner/manager unconditional bypass in `canAccessShopRoute`
  is the only path in. The page also has its own client-side
  `orgRole === "owner" || orgRole === "manager"` check with an
  `EmptyState` fallback so financial numbers never flash for other
  roles before the route guard redirects.
- **Nav placement:** Finance section, after Job Costing, ungated by
  plan `feature` (matches `/vat` and `/expenses` precedent — Reports
  aggregates general sales/customer data, not AC-jobs-specific data).
- New `ReportsIcon` (zig-zag trend line + plotted points inside an
  axis frame) — distinct from `CostingIcon`'s static rising bars.

Files changed:
- `src/app/reports/page.tsx` — new page.
- `src/lib/i18n/translations.ts` — added `reports.*` keys to both the
  Sinhala and English blocks.
- `src/components/ui/icons.tsx` — added `ReportsIcon`.
- `src/lib/nav-sections.ts` — added `/reports` to the Finance section.
- `src/components/shell/nav-icons.tsx` — wired `ReportsIcon` to
  `/reports`.
- `src/lib/org-role/permissions.ts` — added `/reports` to
  `ShopNavHref` and the permission matrix comment (owner/manager only,
  same mechanism as Job Costing/Expenses — no new route-list entries
  needed).
- `src/lib/supabase/middleware.ts` — added `/reports` to
  `GUARDED_SHOP_PREFIXES`.
- `src/components/shop-route-guard.tsx` — added `/reports` to
  `SHOP_PREFIXES`.

Tests performed:
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- `next build`: succeeds, 47 routes (`/reports` added as a new static
  route, same as Job Costing/Expenses).

Remaining risks: same "no browser" caveat as every UI phase since 1 —
the trend chart, metric cards, and top-products/top-customers tables
have not been visually verified. No new DB objects, so no RLS testing
was needed this phase (the page reads only from the already-RLS'd
local-first `sales` data already loaded by every other page).

### Phase 15 — Mobile field UX (tap-to-call / tap-to-navigate)

Branch: `claude/lakbiz-phase15-field-ux`, stacked on
`claude/lakbiz-phase14-reports` (PR #39, not yet merged — same
stacking convention as Phases 6–14). Status: implemented, build
verified, pushed — draft PR #40 (https://github.com/leed56/Subjects/pull/40),
awaiting review.

**Scope call, same reason as Phases 6–14:** no spec text for this
phase either. Checked first: the mobile nav/shell (Phase 1) is already
solid — responsive sidebar/drawer, touch-sized nav items — but every
job/customer phone number and address renders as plain text
everywhere; there is no `tel:` call link and no map/navigation link
anywhere in the app. That's the sharpest, most concrete gap for a
technician standing at (or driving to) a job site. Asked the repo
owner directly; confirmed scope: add tap-to-call and tap-to-navigate
links on the two screens technicians actually use on-site — Jobs and
Schedule — not an app-wide pass, and not the bigger offline
field-mode/sync-queue work (both flagged as follow-ups below).

**No new dependency:** `tel:` links need nothing; navigation uses a
plain `https://www.google.com/maps/search/?api=1&query=...` URL
(opens the user's default maps app on mobile, a new tab on desktop) —
deliberately the `/search` endpoint, not `/dir`, since only the job's
destination address is known, not the technician's live starting
point.

- New `CallLink`/`NavigateLink` components
  (`src/components/ui/field-links.tsx`) — `chip` variant (icon +
  label) and `icon` variant (36×36px tap target, icon only), styled
  to match the existing `ActionButton`/`MessageSendButton` chip
  convention rather than introducing a one-off larger touch-target
  size across the shared button set (a broad resize of existing
  shared components across every phase's shipped UI was judged too
  risky to make unverified — flagged as a follow-up below instead).
- New `PhoneIcon` and `NavigateIcon` (hand-rolled SVG, same
  philosophy as every icon in the set).
- **Jobs (`/jobs`):** job cards gained a navigate icon next to the
  address and a call chip next to the existing WhatsApp/SMS message
  button; the job-sheet detail drawer gained call + navigate chips
  next to "View invoice".
- **Schedule (`/schedule`):** the reschedule drawer's job-detail view
  (previously status + job type only) gained an address block with
  call + navigate chips, so a technician can see where they're going
  and how to get there before confirming a new date.
- New `common.call` / `common.navigate` i18n keys (both locales).

Files changed:
- `src/components/ui/field-links.tsx` — new `CallLink`/`NavigateLink`.
- `src/components/ui/icons.tsx` — new `PhoneIcon`, `NavigateIcon`.
- `src/lib/i18n/translations.ts` — `common.call`/`common.navigate`
  keys, both locales.
- `src/app/jobs/page.tsx` — call/navigate links on the job card and
  job-sheet drawer.
- `src/app/schedule/page.tsx` — call/navigate links in the reschedule
  drawer's job-detail view.

Tests performed:
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- `next build`: succeeds, still 47 routes (unchanged — extended two
  existing pages, added no new routes).

Remaining risks: same "no browser" caveat as every UI phase since 1 —
the call/navigate chips have not been visually verified, including on
an actual mobile device where `tel:`/maps deep-linking matters most
(this was built and typechecked in a container with no phone to test
the handoff to a dialer/maps app). A broader touch-target-size pass
over the *existing* shared action buttons (not just the two new link
components) is deferred, flagged above, to avoid an unverified layout
change across every already-shipped phase's UI.

### Phase 16 — Performance/a11y (message composer lazy-load + icon-only labels)

Branch: `claude/lakbiz-phase16-perf-a11y`, stacked on
`claude/lakbiz-phase15-field-ux` (PR #40, not yet merged — same
stacking convention as Phases 6–15). Status: implemented, build
verified, pushed — draft PR #41 (https://github.com/leed56/Subjects/pull/41),
awaiting review.

**Scope call, same reason as Phases 6–15:** no spec text for this
phase either. Checked first: Phase 1's design system already handles
most accessibility basics well — Drawer/Dialog trap Escape and set
`aria-modal`, `ActionMenu` has `aria-haspopup`/`aria-expanded`, form
inputs are label-wrapped. Two concrete, scoped gaps found instead of
a vague audit: an eagerly-bundled modal component, and icon-only
buttons with no accessible name. Asked the repo owner directly;
confirmed scope: fix both, not a broader unscoped sweep.

- **Performance:** `MessageSendButton` (used on Jobs, Schedule, and
  Teams) always rendered `MessageComposer` — templates, WhatsApp/SMS
  dispatch logic — in its JSX tree regardless of whether the user
  ever opened it, which pulls that weight into every page that
  renders a message button. Now lazy-loaded via `next/dynamic`
  (`ssr: false`) **and** only mounted into the tree after the first
  click (an `everOpened` flag) — rendering the dynamic-imported
  component unconditionally would still fetch its chunk on page load
  regardless of the `open` prop, since Next defers on first *render*,
  not on prop value.
- **Accessibility:** icon-only controls with no accessible name,
  found via a targeted sweep (not a full audit) of every `<button>`
  rendering only an icon with no sibling text:
  - `MessageSendButton`'s `icon` variant rendered a bare 💬 emoji with
    only a `title` attribute — added `aria-label`.
  - Schedule's week-navigation prev/next buttons (`ChevronRightIcon`,
    one mirrored) had no label at all — added `aria-label` from two
    new `schedule.prev_week`/`schedule.next_week` i18n keys.
  - Every other icon-only control checked (`ActionMenu`, Drawer/Dialog
    close buttons, mobile nav hamburger, toast dismiss, the Phase 15
    `CallLink`/`NavigateLink` icon variant) already had one — no
    change needed there.

Files changed:
- `src/components/messaging/message-send-button.tsx` — `next/dynamic`
  import of `MessageComposer`, `everOpened` gate, `aria-label` on the
  icon variant.
- `src/app/schedule/page.tsx` — `aria-label` on the two week-nav
  buttons.
- `src/lib/i18n/translations.ts` — `schedule.prev_week`/
  `schedule.next_week` keys, both locales.

Tests performed:
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- `next build`: succeeds, still 47 routes (unchanged — no new routes,
  only a code-split boundary added inside an existing component).

Remaining risks: same "no browser" caveat as every UI phase since 1 —
did not independently measure the exact per-page bundle-size delta
from the lazy-load (Turbopack's build output doesn't print a
per-route First Load JS breakdown the way classic webpack builds
did); the change follows the standard, well-established
`next/dynamic({ssr:false})` + conditional-mount pattern and both
`tsc`/`build` confirm it type-checks and compiles, but the actual
network-tab effect hasn't been watched in a real browser. The
icon-only sweep was targeted at controls rendering only an icon with
no sibling text, not an exhaustive accessibility audit (color-contrast
-only states, full keyboard-nav walkthrough, and screen-reader
testing are all still open — flagged below).

### Phase 17 — Final security audit

Branch: `claude/lakbiz-phase17-security-audit`, stacked on
`claude/lakbiz-phase16-perf-a11y` (PR #41, not yet merged — same
stacking convention as Phases 6–16). Status: implemented, verified
live against the production Supabase project, pushed — draft PR #42
(https://github.com/leed56/Subjects/pull/42), awaiting review.

**Scope, unusually well-grounded this time:** `docs/ARCHITECTURE_AUDIT.md`
(Phase 0) explicitly deferred two items to "Phase 17 (Final Security
Audit)" by name: a full API route-by-route authorization pass (§8) and
running live RLS cross-tenant verification, which had never actually
been run — "looks correct by inspection is not the bar the spec set"
(§11.1). Did both, then went further: ran a live Supabase
security-advisor scan against the production project
(`zestppstpwjxriwcuykc`) and fixed what it found. Confirmed scope with
the repo owner before applying any of the three DB changes below,
since they're schema/grant changes against a live production database.

**1. API route-by-route audit (all 11 `src/app/api/*/route.ts`):**
- `admin/*` (me, messaging, shops, shops/[id], templates): all gated
  by `requirePlatformAdmin()`.
- `settings/team`: gated by `requireOrgOwner()`; `organizationId` is
  always server-derived from the caller's own session, never trusted
  from the request body. Traced `updateTeamMemberRole`/
  `removeTeamMember` in `create-team-member.ts` — both re-verify the
  target user's actual membership row matches the caller's
  `organizationId` before mutating (no IDOR: a malicious owner can't
  pass another org's `userId` and touch it).
- `settings/notifications`, `messages/send`: session + org membership
  + `owner`/`manager` role checked before any write.
- `messages/status`: session-only gate, but exposes only a boolean
  config flag (no secrets, no tenant data) — correct proportional
  gating.
- `cron/*`: already covered in Phase 0 (§8) — `Authorization: Bearer
  $CRON_SECRET`, fail-closed if unset. Not re-audited, no changes
  since Phase 0.
- No findings. No code changes from this pass.

**2. Live cross-tenant RLS verification (never previously run — see
`ARCHITECTURE_AUDIT.md` §11.1):** used the SQL role-impersonation
technique proven out per-table in Phases 6/11
(`set local role authenticated; set local request.jwt.claims =
'{"sub":"<uuid>","role":"authenticated"}'`), run once across all 14
tenant tables (customers, sales, products, suppliers, ac_jobs,
bank_accounts, contractor_payments, cheques, crews, expenses,
ac_assets, contractors, vehicles, org_members) instead of
`scripts/qa-tenant-isolation.mjs` (which needs real ORG_A/ORG_B login
credentials this session doesn't have). Cross-tenant user
`fa02136e-4a07-4c39-8765-6b19dd0daf1e` (org
`38cdf377-beba-45f6-b785-bf0cdb91f3d4`) against owning org
`399fb19d-e562-4631-abbc-c5325015bebe`'s data:
- **SELECT**: 0 rows on all 14 tables — confirmed this isn't a false
  negative from empty tables by re-running as the *owning* user
  (`fbd6ebc8-55eb-4ac9-94a6-299a3335e671`), which correctly saw
  `ac_jobs: 8`, `org_members: 1`.
- **INSERT**: hard-rejected — `42501: new row violates row-level
  security policy for table "customers"`.
- **UPDATE**/**DELETE**: silently affect 0 rows (RLS-filtered rather
  than erroring) — confirmed via `... returning id` wrapped in
  `count(*)`, not just an unchecked "no error" assumption.

**3. Live Supabase security-advisor scan — 3 real findings, all fixed:**
- `public.schema_migrations` (internal deploy-tracking table — grepped
  `src/` first, confirmed no application code touches it at runtime)
  had RLS disabled entirely (`rls_disabled_in_public`, ERROR). Enabled
  RLS with zero policies — service_role/this session's migration
  connection is unaffected (bypasses RLS by default); anon/authenticated
  now hard-denied, which is correct since neither has any legitimate
  reason to read or write it.
- ~30 internal RPC/masked-view-trigger functions (the `*_view_insert`/
  `*_view_update`/`*_view_delete` INSTEAD OF trigger functions backing
  the updatable masked views, plus `is_org_member`/`can_see_org_
  financials`/`org_can_write`/etc.) were `EXECUTE`-able by the
  unauthenticated `anon` role. Verified each is safe *today* — every one
  reads `auth.uid()` (null for anon) and scopes to rows matching the
  caller, so an anon call returns false/empty rather than leaking data —
  but revoked anyway as defense-in-depth per the linter's own
  recommendation, since none has a legitimate logged-out caller.
  First pass (`revoke ... from anon`) only closed 5 of 30 — re-scanned
  and found the other 25 had `EXECUTE` granted to `PUBLIC` (Postgres's
  default for new functions, inherited by anon regardless of a
  role-specific revoke) — the exact same grant-hygiene bug class as
  `20250628000002_fix_masked_view_cross_tenant_leak.sql`/
  `20250628000003_fix_masked_view_grant_regression.sql` earlier in this
  repo's history. Follow-up migration revoked from `PUBLIC` too and
  explicitly re-granted `authenticated`. Re-scanned again: anon-executable
  warning count went 30 → 0.
- The single-membership migration (`20250628000001_org_members_single_
  membership.sql`, written in Phase 0, never applied — carried forward
  as a known risk through every phase since) — ran its guard query live
  first (`select user_id, count(*) ... having count(*) > 1`), got zero
  rows, then applied it.
- **Verified all 6 `security_definer_view` advisor ERRORs (sale_lines,
  products, sales, contractors, vehicles, ac_jobs) by reading their live
  definitions, not fixed:** every one re-applies its own
  `organization_id in (select ... from org_members where user_id =
  auth.uid())` scoping inside the view despite `SECURITY DEFINER`
  bypassing the base table's RLS — this is the deliberate column-masking
  pattern from Phases 0/6-11, correctly implemented, and the linter can't
  know that from the property alone. Left as-is; documented as
  reviewed-safe in `ARCHITECTURE_AUDIT.md` rather than "fixed" or ignored.
- **Flagged, not fixed:** "leaked password protection" (HaveIBeenPwned
  check) is disabled in Supabase Auth — a dashboard-only project setting,
  not a SQL/migration change, and no tool in this session's toolset can
  flip it. Needs the repo owner: Authentication → Providers → Email →
  Password → enable it manually.

Files changed:
- `supabase/migrations/20250702000001_schema_migrations_rls.sql` (new)
- `supabase/migrations/20250702000002_revoke_anon_execute_internal_functions.sql` (new)
- `supabase/migrations/20250702000003_revoke_public_execute_internal_functions.sql` (new)
- `supabase/migrations/20250628000001_org_members_single_membership.sql`
  (pre-existing, from Phase 0 — applied this phase, not modified)
- `docs/ARCHITECTURE_AUDIT.md` — §11 updated to mark items 1-2 resolved,
  new item 5 documenting the advisor-scan findings.
- No application source changes — every fix this phase is a database
  migration; nothing in `src/` needed to change (verified: no app code
  calls the revoked functions as the anon role — Supabase's browser
  client upgrades to the `authenticated` Postgres role automatically
  once signed in, and no logged-out page calls any of them).

Tests performed:
- `tsc --noEmit`: clean (no source changes, run as a sanity check).
- Live SQL against production (`zestppstpwjxriwcuykc`), documented
  above: duplicate-membership guard query, cross-tenant SELECT/INSERT/
  UPDATE/DELETE sweep across 14 tables, `pg_views`/`pg_proc` definition
  reads to verify the masking views and helper functions before
  concluding they're safe, security-advisor scan run 3 times (before,
  after the anon-only revoke, after the PUBLIC revoke) to confirm the
  fix actually took effect rather than assuming it from the migration
  succeeding.

Remaining risks: the CSP manual full-route pass flagged in
`ARCHITECTURE_AUDIT.md` §11.3 was not revisited this phase (out of
scope — that's a UI/rendering check, not a DB/auth one). Leaked
password protection remains disabled pending the repo owner's manual
toggle. This phase did not attempt a dependency/supply-chain audit
beyond confirming `npm audit` still reports 0 vulnerabilities (checked,
clean) — no deeper SBOM/provenance review was in scope.

### Phase 18 — Final QA

Branch: `claude/lakbiz-phase18-final-qa`, stacked on
`claude/lakbiz-phase17-security-audit` (PR #42, not yet merged — same
stacking convention as Phases 6–17). Status: implemented, verified,
pushed — draft PR #43 (https://github.com/leed56/Subjects/pull/43),
awaiting review. **Last phase of the 19-phase spec** (Phase 0 was the
baseline audit; Phases 1–18 are the numbered feature/QA phases).

**Attempted, and this is the one phase where the attempt itself is the
finding:** every UI phase since Phase 1 has carried a "no browser, not
visually verified" caveat. This session's environment finally has a
real browser (Chromium pre-installed, Playwright available), so Phase
18's plan was a full automated click-through of every flow added in
Phases 1–17 against a local dev server backed by the real production
Supabase project, using a throwaway signup so no real org's data was
touched.

**What actually happened:** the browser itself cannot reach any
external host from this sandbox. Diagnosed, not just observed — a
Playwright-driven Chromium POST to Supabase's signup endpoint hung
indefinitely (no response, no error event); a control test against
plain `https://example.com` failed identically
(`net::ERR_CONNECTION_RESET`), ruling out anything Supabase-specific;
the session's own proxy status endpoint
(`http://127.0.0.1:35673/__agentproxy/status`) showed
`recentRelayFailures` for Chromium's background requests being
rejected as "non-CONNECT" — this environment's egress proxy expects
CONNECT-tunneled HTTPS the way `curl`/Node's fetch send it, and
Chromium's request pattern through it doesn't match, most likely
compounded by the proxy's TLS re-termination (documented in
`/root/.ccr/README.md`) not being trusted by a freshly-launched
Chromium profile the way it's set up for "the" pre-configured browser.
No workaround was applied that would compromise TLS verification (that
door was deliberately not opened) — this is an environment constraint
to report, not a code bug to fix.

**Pivoted to what was actually achievable — and it's substantial:**
rather than stop at "couldn't test it," replicated the exact
signup → auto-confirm → `bootstrap_user_organization` → CRUD sequence
the browser would perform, using direct HTTPS calls (`curl`, which
*can* reach Supabase through this same proxy without issue) against
the live production project. This validates the real business logic —
Auth, RPC, RLS, REST — end to end, just without pixels:
- Signed up a throwaway account (`qa-e2e-phase18-*@example.com`) —
  confirmed Supabase Auth's `mailer_autoconfirm: true` means no email
  round-trip is needed, session token returned immediately.
- Called `bootstrap_user_organization` with the AC/HVAC sector — new
  org created, caller correctly seated as `owner`, `subscriptions` row
  created with `status: trialing` (matches the "14-day free trial"
  banner in the UI).
- Exercised the exact REST endpoints the app's pages call as this
  authenticated user: `GET`/`POST /rest/v1/crews` (Phase 6) and
  `GET`/`POST /rest/v1/expenses` (Phase 11) both succeeded (200/201)
  with rows scoped to the new org — confirms those two phases' data
  layer works through the real network path, not just via direct SQL.
  `GET /rest/v1/products`/`/rest/v1/sales` (the masked views) also
  returned 200 for the authenticated owner.
- **Directly re-verified the Phase 17 fix at the live REST layer**
  (stronger evidence than the SQL-level advisor re-scan alone): called
  `rpc/can_see_org_financials` as the authenticated owner → `true`;
  called the same RPC with **no bearer token** (anon) → `401`,
  `"permission denied for function can_see_org_financials"`. The
  anon-EXECUTE revoke from Phase 17 is confirmed enforced against the
  real, deployed API surface, not just inferred from the migration
  succeeding.
- Cleaned up afterward — deleted the test crew, expense, subscription,
  org_members row, organization, and auth user; verified 0 rows remain
  matching the test pattern. Production data is untouched.

**Final consolidated regression check** across the complete stacked
tree (everything from Phases 1–17 combined, since this branch is the
tip of the stack): `rm -rf .next node_modules/.cache && tsc --noEmit`
clean; `eslint` 0 errors, same 3 pre-existing warnings; `next build`
succeeds, 47 routes, no new routes this phase.

**Delivered `docs/QA_CHECKLIST.md`** — a manual QA checklist covering
exactly what Phase 18 couldn't verify itself: the specific unverified
visual items flagged across Phases 10/14/15/16 (dashboard MeterCard,
reports chart/period-filter/access-gate, mobile call/navigate links on
real hardware, the reschedule drawer's new address block, the
lazy-loaded message composer, keyboard/screen-reader checks on the new
week-nav labels), plus cross-cutting checks (full signup-to-first-sale
flow watched in a real browser, narrow-viewport layout, OS dark-mode).
Explicitly scopes out what does *not* need re-testing — RLS isolation
and API authorization, since Phase 17/18 already verified those live
against the real backend two different ways (SQL impersonation and
now direct REST calls).

Files changed:
- `docs/QA_CHECKLIST.md` (new)
- No application source changes.

Tests performed: everything described above — live signup/RPC/REST
flow against production Supabase (created and fully cleaned up), plus
`tsc`/`eslint`/`build` across the full stacked tree.

Remaining risks: this is the risk this phase exists to document — no
phase in this project, including this one, has had a human or working
browser actually look at the rendered UI for anything built since
Phase 0's `/` and `/login` check. Recommend the repo owner run
`docs/QA_CHECKLIST.md` in a normal (non-sandboxed) browser before
treating Phases 6–18 as production-ready, or run this same
Playwright-based signup+click-through script (the working parts of it,
in `/tmp/.../scratchpad` this session, not committed — trivial to
recreate from this doc) from an environment where the browser has real
outbound network access.

## HVAC operational platform (new spec, separate from the 26-phase dashboard-only work above)

data model (Customer → Site → AC Asset → Complaint → Diagnosis → Work
performed → Parts/materials used → Technician labor → Other costs →
Invoice → Job cost → Gross profit → Margin → Asset service history →
Dashboard intelligence) so the Owner Dashboard can answer real
operational questions, instead of another cosmetic dashboard pass. 26
phases; explicitly gated — "the dashboard redesign should happen only
after these real operational signals exist." This section is separate
from, and independent of, the "Dashboard command center" work (draft PR
#44, not yet merged) — Phase 2 here branches from `main`, not from that
branch, since the data-model work has no dependency on the pending
dashboard redesign.

### Phase 1 — Architecture audit (report before migrating)

Read the actual code/SQL (not memory) for every area the spec asked
about, before writing anything. Full findings were reported to the user
directly (see chat) rather than duplicated here in full; summary of the
load-bearing conclusions that shaped every phase after this one:

- **Job costing already has a real cost/charge split, just not itemized
  or stock-linked.** `job.quotedAmount` (customer charge) vs.
  `Σ job_items.lineTotal` (internal cost) already feeds `/job-costing`'s
  margin calc, and `job_items` is never shown on the customer invoice
  (`/jobs/[id]/invoice` renders only `quotedAmount`). What's missing:
  `job_items` has no `productId`, no stock decrement, no historical-cost
  snapshot, no stock/purchased-for-job/customer-supplied distinction.
- **Stock mutation is already centralized.** Every `stockQty` change
  goes through exactly four functions in `store/actions.ts`
  (`addProduct`, `adjustStock`, `createSale`, `createPurchase`), each
  writing a matching `StockLog` row. Grepped every other call site —
  nothing in UI code mutates `stockQty` directly. Phase 3 needs richer
  movement types/link fields, not a rebuild.
- **The historical-cost risk the spec warns about is real and
  currently live-but-latent.** `createPurchase` overwrites
  `product.buyPrice` with the new `unitCost` on every purchase — so the
  moment `job_items` gets linked to real products (Phase 4/5), an old
  job's cost must snapshot the unit cost at the time, not read today's
  (by-then-overwritten) `buyPrice`.
- **Categories are per-sector configurable, but the ac_hvac list was
  too shallow to be a real parts taxonomy**, and — this was a genuine
  bug worth knowing about — `normalizeProductCategory()` silently
  coerces any category string not in `categoriesForSector(sectorId)`
  back to the sector default. Fixed in Phase 2 by extending the list,
  not by removing the coercion (the coercion itself is legitimate
  defense against bad data).
- **Sector-specific fields are already a configurable dictionary**
  (`sector-fields.ts` + `sectors.ts`'s `extraFields`) — Phase 2 extends
  this dictionary rather than inventing a parallel parts-catalog schema.
- **No `active`/`notes` field existed on `Product` at all.** A real,
  clean gap — added in Phase 2.
- **`Technician` has no cost/rate field** (only `Contractor` does, via
  `rateType`/`rateAmount`) — confirms Phase 6 will need the smallest
  possible addition, not a rebuild.
- **`expenses` has no job linkage column** — confirms Phase 7 needs an
  additive nullable `job_id`, not a parallel "other costs" table.
- **No Site entity** — `ac_assets.site_address` and `customers.address`
  are both free text; one customer can have multiple asset-level site
  addresses today, just not a normalized, reusable Site table. Flagged
  as a decision point, not changed.
- **No multi-location/warehouse stock tracking** — a single `stockQty`
  per product, no per-location breakdown. The spec only asked for this
  "if supported" — it isn't, and this phase does not fabricate it.
- **VAT is a tenant-level flag/rate, not per-product** — no per-part
  VAT/tax-treatment field is needed; Phase 2 parts reuse the existing
  shop-level VAT model as-is.
- **`org_members.role='technician'` still has no FK to any
  `technicians.id` row** (re-confirmed, unchanged from the earlier
  19-phase project) — a technician-scoped view can only ever show
  "today's jobs," never "my jobs," with the current data model.

### Phase 2 — HVAC parts & materials catalog

Purely additive, built on the two existing configurable systems the
audit confirmed are sound (`categoriesForSector`/`sector-fields.ts`) —
no new catalogue table, no hardcoded category enum on top of what
already exists.

- `sectors.ts`: `categoriesForSector("ac_hvac")` expanded from 5 generic
  categories to ~19, covering every group named in the spec
  (compressors; condenser/evaporator coils; PCBs & control boards;
  capacitors/relays/contactors; motors & fans; sensors & thermostats;
  valves & refrigerant controls; refrigerant & gas; copper pipe &
  fittings; insulation & cladding; drain components; filters; bearings
  & mounts; terminal blocks/breakers/fuses/cables — grouped under one
  "Electrical" category rather than 4 near-empty ones; brackets &
  vibration pads). The original 5 strings are kept byte-for-byte first
  in the list — removing any of them would have silently
  reclassified already-saved production rows the next time
  `normalizeProductCategory()`/the edit form ran, since neither is
  additive-safe against a shrunk list.
- `sector-fields.ts`: added `compatibleModels` (text), `supplierPartNo`
  (text), and `serialRequired` (new **boolean** field type — the
  sector-field system only supported text/number/date before this;
  extended `SectorFieldType`, `sanitizeCustomFields`,
  `emptyCustomFieldsForSector`, and the form's checkbox rendering to
  match). Reused the already-existing `partNo`, `binLocation`, and
  `warrantyMonths` field defs by adding them to `ac_hvac.extraFields`
  instead of duplicating them.
- Deliberately **not** built: a separate manufacturer field (judged
  redundant with the existing `brand` field for a parts catalog — same
  concept, documented rather than duplicated); per-item VAT/tax
  treatment (no per-product VAT model exists anywhere in the app;
  parts reuse the shop-level VAT rate like everything else);
  warehouse/truck multi-location stock (no location concept exists at
  all — the spec said "if supported," and it isn't; fabricating one
  here would be a stock-model rebuild, not a Phase 2 addition);
  per-category dynamic field sets (the product form shows one field
  set per sector, not per category — a capacitor and a wall unit share
  the same field list today; splitting that is a bigger form redesign
  than this phase's scope).
- `Product`/`ProductInput` gained two **generic** (not sector-specific)
  fields the audit found genuinely missing: `active: boolean` (default
  `true` — discontinue a part without deleting it, since deleting would
  orphan any `job_items`/`stock_logs`/`sale_lines` history that
  references the product id) and `notes?: string`. Wired through
  `addProduct`/`updateProduct`, the product form (a checkbox shown only
  when editing, plus a notes textarea), `getLowStockProducts` (inactive
  items no longer generate reorder alerts), the `/sales` product picker
  (inactive items can't be sold), `/stock` (inactive items hidden by
  default behind a "count" toggle, badged when shown), and
  `sync-conflict.ts`'s product-diff check.
- Supabase migration `20250703000001_products_active_notes.sql`: adds
  `products_base.active`/`.notes`, and — since `products` is a masked
  view over `products_base` with `INSTEAD OF` triggers (hiding
  `buy_price` from non-financial roles, per
  `20250623000001_financial_data_rls.sql`) — appends both columns to
  the view and both trigger functions. Columns are appended at the end
  of the view's column list, not inserted, matching the same
  `CREATE OR REPLACE VIEW` constraint already documented in
  `20250629000001_ac_asset_lifecycle.sql`.
- `business-sync.ts`: both product push-mappers and the pull-mapper
  updated for the two new columns; pull defaults `active` to `true`
  when the column is null (pre-migration rows / older cached data).

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds with the same 47
routes (no new routes this phase). No browser verification performed —
same standing sandbox limitation as every prior phase (see Phase 18
above); this phase is schema/data-model/form work with no new page, so
the risk surface is smaller than a UI phase, but the checkbox rendering
and the expanded category `<select>` have not been visually confirmed.

Remaining limitations (disclosed): Site is still not a distinct entity;
multi-location stock is still not supported; per-category dynamic
fields still aren't split out; the "manufacturer" field the spec listed
separately from "brand" was deliberately not duplicated (documented
above, not an oversight).

### Phase 3 — Stock movements

The audit (Phase 1, above) found stock mutation already centralized —
every `stockQty` change goes through exactly one of `addProduct`,
`adjustStock`, `createSale`, `createPurchase` in `actions.ts`, each
writing a matching `StockLog` row — but `StockLog.type` only supported
`"in" | "out" | "sale"`, with no way to distinguish a purchase receipt
from a manual correction, no job/supplier linkage, and no record of who
performed a movement.

- All four mutating functions now funnel through one new internal
  `applyStockMovement()` — `adjustStock`/`writeOffStock`/
  `returnStockToSupplier` all call it; `createPurchase` was updated to
  call it via the same log-shape. "One place writes stockQty + a
  matching log" stays true as movement kinds grow, per the audit's own
  finding about this module.
- `StockMovementType` widened to `"in" | "out" | "sale" | "purchase" |
  "job_usage" | "job_return" | "supplier_return" | "write_off"`.
  `createPurchase`'s stock-in logs now tag `"purchase"` (previously
  `"in"` — old rows are left as-is, nothing reads `type` yet, confirmed
  by grep before making this change) and set the new
  `relatedSupplierId`. `job_usage`/`job_return` are defined here but not
  yet emitted by anything — Phase 4 (job → parts used) is what will
  create them.
- **Not modeled**: "transfer between locations" from the spec's movement
  list. The product model has no location/warehouse concept at all
  (confirmed in the Phase 1 audit) — a transfer type with nothing to
  transfer between would be fabricated, not real.
- Two new standalone movement kinds got real UI, since they don't
  depend on Phase 4: **Write off** (damaged/lost stock, decrements,
  `type: "write_off"`) and **Return to supplier** (decrements, tied to a
  `supplierId`, `type: "supplier_return"` — deliberately does not touch
  `suppliers.payableBalance`; reconciling a return against what's owed
  is an owner accounting decision, not something to infer silently).
  Both added to `/stock`'s row overflow menu, disabled when stock is
  already zero; "Return to supplier" only appears once at least one
  supplier exists.
- `userId` (the acting org member) is threaded through
  `adjustStock`/`writeOffStock`/`returnStockToSupplier`/`createPurchase`
  from `app-store-provider.tsx`, which has the authenticated Supabase
  user via `useAuth()` — `actions.ts` itself is a pure data-in/data-out
  module with no auth context, so this couldn't originate there.
  Deliberately **not** threaded onto `createSale`'s stock-out logging
  this phase — sales already have independent attribution via the Sale
  record itself, "user" wasn't in the spec's list of things a *sale*
  movement needs, and doing so would mean touching every one of
  `createSale`'s several call sites for a capture the spec didn't ask
  for here.
- Migration `20250704000001_stock_movement_types.sql`: drops and
  replaces `stock_logs`'s `log_type` CHECK constraint (previously
  limited to `in`/`out`/`sale` — every new movement kind would have been
  rejected outright without this), adds `related_job_id` (no FK — jobs
  are local-first text ids, same as `job_items.job_id`),
  `related_supplier_id`, and `user_id` columns.
- `business-sync.ts`: both the pull-mapper and both push-mapper call
  sites (there are two independent inline mappers for stock log rows,
  not one shared helper — updated both) carry the three new fields.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds with the same 47
routes. No browser verification performed — same standing sandbox
limitation as every prior phase.

Remaining limitations (disclosed): no movement-history UI exists
anywhere yet (grepped — `stockLogs` is written everywhere but read/
displayed nowhere in the app today; this phase didn't add one, since
the closest natural home is a per-product view that doesn't exist until
Phase 9's Job Detail redesign or a future reports addition). Multi-
location transfer remains unmodeled, as above.

### Phase 4/5 — Job → Parts Used, and the historical-cost snapshot

Combined into one PR/phase because they're inseparable in practice: you
cannot correctly wire job materials to real stock without simultaneously
solving how an old job's cost stays fixed after today's stock price
changes — the spec's own Phase 5 gate says as much. Branched from Phase
3 (`claude/lakbiz-hvac-phase3-stock-movements`), not `main` — this phase
needs the `job_usage`/`job_return` `StockMovementType` values Phase 3
defined but left unused, so a real dependency, unlike Phase 2 vs 3.

**Key realization that simplified the design**: `job_items` rows are
already immutable once created — the app has an Add and a Delete for
job items, no Edit. So a `JobItem.unitPrice` set once at creation
*already behaves as a historical snapshot* by construction, as long as
(a) it's populated from the product's cost at that moment and (b)
nothing ever goes back and rewrites it later (already true — grepped,
nothing does). No separate `costSnapshot` field was needed; `unitPrice`
itself just had to become authoritative instead of free-typed for
stock-sourced items.

- **Three material sources**, `JobItem.source` (only meaningful for
  `itemType: "part"`):
  - **`stock`** — the UI's product picker only offers real in-stock
    products; on save, `addJobItem` looks the product up itself and
    **overwrites `unitPrice` with the product's current `buyPrice`
    regardless of whatever the client sent** — this is the actual
    historical-cost guarantee, not client trust. Decrements
    `stockQty` once and writes a `job_usage` `StockLog` linked to the
    job (Phase 3's movement layer, finally used). Deleting the item
    reverses this with a `job_return` movement — the audit trail shows
    the material genuinely came back, not a silent `stockQty` edit.
  - **`purchased`** — a one-off buy for this specific job. Free-typed
    name/cost, optional supplier/reference/date. Deliberately **does
    not touch `products`/`stockQty` at all** ("do not pretend this item
    came from warehouse stock if it did not").
  - **`customer_supplied`** — free-typed name/qty, cost defaults to 0
    ("do not create fake costs"), overridable for the rare case the
    shop genuinely incurred a handling cost. No stock movement.
  - Labour/service items are completely unaffected — same free-text
    flow as before Phase 4, since "material source" is a parts-only
    concept.
- **`customerPrice`** (optional, per-line): what the customer is
  charged for that specific item, when the owner wants to track it.
  Deliberately **does not change the job invoice**, which still totals
  from `quotedAmount` as one flat figure — itemizing the customer
  invoice is a Job Detail redesign concern (Phase 9), not this one.
- **Duplicate-submit protection**: reused the existing `savingItem`
  guard already on the add-item form (pre-dates this phase) rather than
  inventing a second mechanism.
- **Job-costing math needed zero changes.** `/job-costing` already sums
  `Σ job_items.lineTotal` as cost regardless of where a line came from —
  the three sources just make that sum honest instead of free-typed.
- Migration `20250705000001_job_item_material_source.sql`: adds
  `source`, `product_id` (FK to `products_base`, nullable, set on
  delete), `supplier_id`, `purchase_ref`, `purchase_date`,
  `customer_price` to the existing `job_items` table.
- `business-sync.ts`: pull-mapper and both push call sites (the direct
  `jobItemRow()` helper and the second inline mapper used by the
  full-snapshot push path) carry the six new fields. `addJobItemToCloud`/
  `deleteJobItemToCloud` in `app-store-provider.tsx` now also push the
  affected product + new `StockLog` row via the existing
  `syncProductSnapshot()` whenever the item's source is `"stock"` —
  `syncJobItemSnapshot()` alone only pushes the `job_items` row itself,
  so without this the stock decrement/return would have stayed local-only.

## Deliberately not built this phase

- **`product.active` is not checked** when picking a stock source —
  that field lives in the still-unmerged Phase 2 PR (#45), not in this
  branch's lineage. One-line follow-up once #45 merges: also reject
  consuming a deactivated product in `addJobItem`.
- **"Purchased for this job" doesn't create an Expense/Purchase
  record.** It correctly feeds this job's own cost/profitability, but
  won't appear in shop-wide expense totals or VAT input-tax figures
  yet — a real, disclosed gap, not a silent one. Bridging it needs a
  deliberate design call (auto-create an Expense once Phase 7 adds
  `job_id` there? extend `Purchase` to allow a non-catalogued line?)
  that's bigger than "smallest necessary addition" for this phase.
- **Not itemizing the customer invoice** — `customerPrice` is captured
  per-line but the invoice still shows one flat `quotedAmount`, as
  discussed above.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds with the same 47
routes. No browser verification — standing sandbox limitation.

### Phase 6 — Job labor costing

Audited first (per the spec's own instruction): `Technician` had no
cost field at all; only `Contractor` did (`rateType`/`rateAmount`,
already used in job costing via `subcontractCost`). Confirms the spec's
prediction — added the smallest explicit configuration necessary,
nothing more.

- `Technician.hourlyRate?: number` — nullable, no fabricated cost for a
  technician with no configured rate.
- `JobItem.technicianId?: string` (labour-only) — a job already gets as
  many `job_items` rows as it needs, so **multiple technicians per job**
  needed no schema change to `ACJob`'s single `assigneeId`: just add
  several labour lines, each with a different `technicianId`.
- `JobItem.customerPrice` (added Phase 4 for parts) extended to labour
  lines too — this is exactly the "2hrs × Rs.1,000 internal cost vs
  Rs.4,000 customer charge, not the same concept" distinction the spec
  asked for. Job Sheet's labour form: pick a technician → `unitPrice`
  pre-fills from their `hourlyRate` (editable, not locked, unlike the
  stock-material snapshot — labor cost per job can legitimately vary
  from a technician's base rate) → optional customer-charge field.

**Found and fixed alongside this, not fabricated new scope**: `/workforce`
is in `TECHNICIAN_ROUTES` (technicians have route access), and the
route's own documented permission comment already says technicians get
"no financial fields" there — but the page had zero `canSeeFinancials`
gating anywhere. Contractor rate/payable balance, per-contractor margin,
and the page's outstanding-payout/total-margin stat cards were all
rendered unconditionally. Since Phase 6 was about to add a *second*
financial field (`hourlyRate`) to this exact page, shipping it without
fixing the existing leak would have been adding a new instance of the
bug next to an old one. Gated all of it behind `canSeeFinancials`
(learned from the Dashboard Command Center pass: adjusted the stat-card
grid's column count instead of leaving an empty track when 2 of 4 cards
disappear).

**DB-level masking, not just UI hiding**: RLS on `technicians`/`job_items`
only ever enforced tenant isolation, no column-level masking — meaning
a technician could read `hourly_rate`/`unit_price`/`line_total`/
`customer_price` directly via a REST call even with the UI gate above in
place. Migration `20250706000001_labor_costing.sql` renames both tables
to `_base` and adds masked views + `INSTEAD OF` triggers, the exact
pattern already proven for `products`
(`20250623000001_financial_data_rls.sql`) and `ac_jobs.subcontract_cost`.
This is the actual "do not expose company profit to unauthorized
technicians" guarantee — the client-side gate alone was never enough.

**Known pre-existing gap, disclosed not fixed here**: `contractors.rate_amount`/
`payable_balance` have the identical unmasked-at-the-DB-level problem
and predate this phase — same root cause, different table. Out of scope
for this migration since Phase 6 didn't touch `contractors`; flagged for
a dedicated follow-up (this maps to the spec's own later Phase 19/20).

- `business-sync.ts`: technician pull/push mappers and both job_items
  push mappers carry `hourlyRate`/`technicianId`.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds. No browser
verification — standing sandbox limitation.

### Phase 7 — Other job costs

Audited first: Expenses (built in the prior 19-phase spec's Phase 11)
already covers ad-hoc operating costs with category/amount/date/payment
method/vendor/notes — everything the spec's field list asked for except
a job link. One column, not a parallel "job costs" table.

- `expenses.job_id` (nullable text, no FK — same pattern as
  `job_items.job_id`). `/expenses`' form gets an optional "Link to a
  job" picker; the table gets a Job column.
- Three new expense categories genuinely missing before: `parking`,
  `equipment_rental`, `outsourced_repair`. **Deliberately no
  `subcontractor` category** — that cost already lives in
  `ACJob.subcontractCost` for contractor-assigned jobs; adding a second
  place to record the same cost would invite double-counting it, which
  the spec's absolute rules explicitly forbid.
- `/job-costing` (the existing profitability report) now fetches
  expenses (cloud-only, same pattern `/expenses` itself uses) and adds
  each job's linked-expense total as `otherCost`, folded into
  `totalCost` alongside `itemsCost`/`subcontractCost`. The cost column
  shows an "incl. other costs" hint when `otherCost > 0`, for
  transparency about what's in the number.
- Checked for the double-count risk explicitly: a job-linked expense
  still counts (correctly) toward the shop's month/fiscal-year expense
  totals on `/expenses` itself, and toward the income-tax deduction
  calc — that's not a bug, it's the same real cost viewed from two
  different questions ("what did the business spend" vs. "was this job
  profitable"), which is exactly the distinction the spec's Phase 20
  asks reporting layers to preserve. Nothing sums both totals *together*
  anywhere, which is the actual double-counting failure mode.

**Deliberately not built this phase**: wiring "other costs" into the Job
Sheet drawer (`/jobs`) itself — that page is already local-first only
and doesn't fetch cloud-only Expenses; adding a second fetch there
increases the risk surface of an already-large file for a view that's
naturally superseded by Phase 9's Job Detail redesign anyway.
`/job-costing` is the authoritative profitability view for now.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds. No browser
verification — standing sandbox limitation.

### Phase 8 — Job profitability engine

Extracted the formula every prior phase (4/5/6/7) had been feeding
inputs toward — `Total Job Cost = Material + Labor + Other`,
`Gross Profit = Revenue − Total Job Cost`,
`Gross Margin % = Gross Profit / Revenue × 100` (null, not a divide-by-
zero or a misleading 0%, when revenue is 0) — into one function,
`computeJobProfitability()` in a new `src/lib/job-profitability.ts`.
Before this phase the formula lived only inline inside `/job-costing`'s
page component.

- **Bucket mapping** (the spec's 3 buckets vs. this app's actual data
  shapes, documented in the function's own header comment): Material =
  Σ `job_items` where `itemType === "part"`. Labor = Σ `job_items` where
  `itemType === "labour"` **plus** `job.subcontractCost` when the job is
  contractor-assigned (paying an external party to do the work is still
  labor, just not in-house — folding it in here also matches how
  `/workforce`'s own margin stat already treated it). Other = Σ
  `job_items` where `itemType === "service"` **plus** the Phase 7
  job-linked Expenses total (passed in by the caller, since Expenses is
  cloud-only and this function stays a pure function over already-
  fetched data, not a fetcher itself).
- **VAT check, per the spec's explicit instruction**: audited
  `ACJob`/`ACJobInput` before writing this — no VAT field exists
  anywhere on an AC job. `quotedAmount` is a flat negotiated price with
  no VAT breakout, unlike `Sale.outputVat`/`Purchase.inputVat`. There is
  currently nothing to accidentally include; documented in the function
  header as the one place to revisit if AC jobs ever gain VAT tracking.
- `/job-costing` now calls this function instead of its own inline
  `costJob()` (deleted).
- **Job Sheet drawer** (`/jobs`) also switched from its own separate
  inline calc (`itemsTotal`/`subcontract`/`profit`, which conflated
  parts+labour+service into one undifferentiated figure and never
  included Phase 7 costs at all) to the same shared function — the
  drawer now shows Material cost and Labor cost as distinct figures
  instead of one combined "Parts/labour" number, a real improvement.
  Passes `linkedExpenseTotal = 0` since this view is local-first only
  and doesn't fetch cloud-only Expenses (same call this project made in
  Phase 7) — same formula, an admittedly incomplete input in this one
  view, not a second competing calculation. `/job-costing` remains the
  complete, authoritative profitability view until Phase 9's Job Detail
  redesign potentially changes that.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds. No browser
verification — standing sandbox limitation.

### Phase 9 — Job Detail experience redesign

The Job Sheet drawer was one long scroll — KPI row, Equipment, a combined
parts/labour items table, one add-item form covering every material
source and labor case at once, then status history — all rendered
unconditionally at the same visual weight. Restructured into 5 tabs
(`Overview`, `Parts & Materials`, `Labor & Other Costs`, `Job Economics`,
`Invoice & Payment`) using the existing `Tabs` primitive (already in the
design system, unused until now), mapping the spec's 10 named
sub-sections onto a smaller set of grouped tabs rather than 10
individual tabs, which would have been excessive:

- **Overview**: Identity (customer/phone/address, in the drawer header)
  + **Complaint** and **Diagnosis** (both genuinely new fields, see
  below) + Equipment (existing Phase 4/5 asset link) + Attachments
  (disclosed unavailable, not fabricated — see below) + Status history.
- **Parts & Materials**: the existing parts table + add-item form,
  filtered to `itemType === "part"`, source selector unchanged from
  Phase 4.
- **Labor & Other Costs**: the same table/form filtered to
  `itemType === "labour" || "service"` — a technician picker for
  labour lines (Phase 6), unchanged.
- **Job Economics**: full Material/Labor/Other/Total/Revenue/Gross
  Profit/Margin breakdown via `computeJobProfitability()` (Phase 8) —
  **now fed a real job-linked-expenses total**, fetched in this drawer
  for the first time (see below), so these numbers match `/job-costing`
  exactly instead of omitting Phase 7 costs as before.
- **Invoice & Payment**: the existing "View invoice" link plus
  quote/deposit/balance figures pulled out of the old always-visible
  header into their own tab.

The single add-item form (covering part/labour/service/source
combinations from Phases 4–6) was **not duplicated** across the Parts
and Labor tabs — the same form component is reused, with the item-type
selector's available options and the displayed item list both switching
on which tab is active, and a tab-change handler that resets the form
and picks a sensible default `itemType` for the new tab. One form, one
set of validation/submit logic, two contexts.

**Two genuinely new fields**: `ACJob.complaint` (what the customer
reported) and `ACJob.diagnosis` (what the technician found). Audited
first — `description` was assumed to be a "what's wrong" field before
checking; it's actually an **auto-generated equipment summary**
(brand/BTU/unit type, built in `addACJob`) with no editable UI input
anywhere in the app. Complaint and Diagnosis are real, new, editable
fields added to the job create/edit form, distinct from both
`description` and the free-text `notes` field that already existed.
Migration `20250708000001_job_complaint_diagnosis.sql` widens
`ac_jobs_base` and the masked `ac_jobs` view + its `INSTEAD OF` triggers
(same append-only `CREATE OR REPLACE VIEW` pattern as every prior
`ac_jobs` schema change) — both fields are plain text, not financial, so
no masking `case`/`when` was needed for them specifically.

**Closing a disclosed gap from Phases 7/8**: the Job Sheet drawer now
fetches job-linked Expenses itself (`fetchOrgExpenses`, filtered to this
job's id) instead of passing `linkedExpenseTotal = 0` to
`computeJobProfitability()` — both Phase 7's and Phase 8's docs
explicitly flagged this as deferred to "Phase 9's Job Detail redesign
potentially changing that." It has.

**Attachments — disclosed, not fabricated**: the Overview tab has an
Attachments section with a plain "not available yet" message. No photo/
document upload architecture exists anywhere in this codebase (confirmed
in the Phase 1 audit and re-confirmed here) — building real file
upload/storage is a substantial feature (Supabase Storage bucket, upload
UI, RLS policies for file access) that the spec's own "do not fabricate"
instructions rule out inventing as a side effect of a tab reshuffle.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds. No browser
verification — standing sandbox limitation, and this phase carries more
risk than most from that gap since it's a substantial, freeform JSX
restructure with no visual confirmation; reviewed the full render tree
manually line-by-line after the edit to check every tab's JSX opens and
closes correctly, but a real browser pass is the one thing that would
actually confirm the tabs render and switch as intended.

### Phase 10 — AC Asset service history

Audited first — `/assets` already had more than expected: an asset
profile drawer with a "Jobs" tab (`fetchAssetJobs`, direct read against
the masked `ac_jobs` view filtered by `asset_id`), just a thin list
(job number/status/date/description, no cost, no parts). No separate
manual "service log" to worry about duplicating — jobs were already the
source, exactly as the spec wants; this phase deepens that existing tab
rather than replacing anything.

- `AssetJob` extended with the Phase 9 fields (`complaint`, `diagnosis`)
  and enough financial context (`quotedAmount`, `assigneeType`,
  `subcontractCost`) to compute a real lifetime cost — all already
  exposed by the existing masked `ac_jobs` view, so no new masking
  logic was needed; `subcontract_cost` arrives pre-masked to `null` for
  non-financial roles and is trusted as-is.
- New `fetchAssetJobItems(jobIds)` — one query against the masked
  `job_items` view for every job linked to the asset. This is the real,
  stored basis for two things the spec asked for that had no home
  before:
  - **Components replaced**: parts (`itemType === "part"`) across every
    linked job, grouped by name, with a replacement count and the most
    recent date — not a separate manually-maintained list, derived
    entirely from real job material records (Phase 4/5).
  - **Lifetime repair cost**: `Σ job_items.lineTotal` (material + labor
    + service, already masked to 0 for non-financial roles by the view
    itself) **plus** `subcontractCost` for contractor-assigned linked
    jobs — the same Material+Labor bucket logic as
    `computeJobProfitability()` (Phase 8), reimplemented inline here
    rather than reused because `computeJobProfitability` takes a full
    `ACJob`, and `AssetJob` is a deliberately narrower read-only
    projection from a different client module; duplicating the two-line
    sum was judged lower-risk than reshaping either type to share it.
  - **Deliberately excluded from lifetime cost**: per-job Phase 7
    linked-Expenses totals. Including them would mean an extra query
    fetching and cross-referencing Expenses against every linked job's
    id, adding real complexity for a number that's already visible,
    correctly, on `/job-costing` and each job's own Job Economics tab
    (Phase 9). Disclosed here rather than silently included as "close
    enough."
- Visit history rows now show each visit's real complaint/diagnosis
  (Phase 9 fields, when recorded) and quoted amount, not just status/
  description as before.
- "Jobs" tab renamed "Service History" to match what it now actually
  shows.

**Not built this phase**: repeat-repair intelligence (e.g. "3 repairs in
90 days") — that's Phase 11's, and mixing it in here would risk
inventing the exact "likely failure" language the spec explicitly rules
out without the dedicated, deterministic-only design that phase
requires. This phase's per-asset job list is real data that Phase 11
will consume, not duplicate.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds. No browser
verification — standing sandbox limitation.

### Phase 11 — Repeat-repair intelligence

The spec's sharpest guardrail: deterministic only, no AI, no fabricated
"likely failure" claims, only messages exactly supported by stored data
— explicitly allowing exactly the shape "This unit has had 3 repair jobs
in the last 90 days."

New `src/lib/repeat-repair.ts`, `computeRepeatRepairSignal()` — a plain
count over real `AssetJob` records within a fixed window, nothing
predictive or inferred:

- **Window and threshold are explicit, disclosed choices, documented in
  the function's own header**: 2+ repair/service jobs within the last
  90 days. Two visits inside one quarter is a real, defensible "this
  keeps coming back" signal; one visit is just a repair, not a pattern.
  Picked and written down rather than left as an unstated magic number,
  per the spec's "do not invent the threshold silently" instruction
  (stated elsewhere in the spec for margin flagging, applied here to
  the same class of problem).
- **Only `jobType === "repair"` or `"service"` count.** Installation/
  inspection/warranty/other jobs aren't repeat *repairs* — counting
  them would make the message less exact than the spec's "exactly
  supported by stored data" instruction asks for. `AssetJob` gained a
  `jobType` field (already available on the underlying `ac_jobs` view,
  just not previously selected) to make this possible.
- Surfaced in the asset profile's Service History tab (the same tab
  Phase 10 built out) as a plain amber banner when triggered, using the
  spec's own example wording verbatim: "This unit has had {count}
  repair jobs in the last {days} days." No severity scoring, no
  "urgent"/"critical" language beyond that one factual sentence.
- Exported as a pure, reusable function (mirroring Phase 8's
  `computeJobProfitability` precedent) specifically so a future
  dashboard "Needs Attention" pass (Phases 14–18) can reuse the exact
  same signal instead of re-deriving a competing one.

**Not built this phase**: surfacing the signal inside the Job Sheet
drawer when a job is linked to a repeat-repair asset — would need
fetching that asset's job history from within `/jobs`, adding a second
data-fetch path for a signal that's already visible, correctly, on the
asset's own profile page. Deferred rather than duplicated.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds. No browser
verification — standing sandbox limitation.

## Not started

Deferred items: customer notes field,
Receive Stock / Stock Adjustment as real features, offline
support for AC Assets and Crews, the full field-service status/dispatch
model (New/Assigned/On the way/Awaiting parts/Invoiced/Paid), before/after
photos, customer signature, wiring `asset_id`/`crew_id` into the `/jobs`
create/edit form (this is also what blocks true crew-column grouping on
the Schedule board — see Phase 7), drag-and-drop rescheduling,
time-of-day scheduling (the data model is date-only right now),
per-job-type costing benchmarks/targets (Phase 8's report shows actuals
only), a distinct job-invoice numbering scheme (Phase 9 reuses `jobNo`
as the invoice reference), wiring the Phase 11 expenses deduction into
the Dashboard/VAT income-tax display (currently only `/expenses` itself
shows the tax impact), unifying Workforce (technicians/contractors) with
login-capable Team accounts (Phase 12 deliberately kept these separate),
a purpose-built crew-assignment message template (Phase 13 reuses the
generic `"custom"` context instead), a UI modernization pass on
`/settings/notifications` (still on bespoke pre-Phase-1 styling), and
(Phase 14) exporting the in-app report view as CSV/print directly from
`/reports` (the existing `src/lib/export/*` CSV/print helpers are
per-domain — sales, VAT, customers — and were not wired into this new
aggregate view), plus a longer trend window / month-over-month
comparison on the reports chart. (Phase 15) call/navigate links on
Customers/Suppliers/Vehicles/Teams (scoped to Jobs/Schedule only this
phase), the offline field-mode indicator + local sync queue for
job/schedule updates made while offline, and a broader touch-target
sizing pass over the existing shared action-button components (this
phase only sized the two new link components, to avoid an unverified
layout change across every already-shipped phase's UI). (Phase 16) a
full accessibility audit — color-contrast-only status states, a
complete keyboard-nav walkthrough, and real screen-reader testing (the
icon-only sweep this phase was targeted, not exhaustive) — and an
independently-measured per-route bundle-size delta from the
lazy-loaded message composer (Turbopack's build output doesn't print
the classic per-route First Load JS table, so this wasn't verified
beyond `tsc`/`build` passing).

## Next exact tasks

All 19 phases (0–18) of the product spec are now implemented and
pushed as 13 stacked draft PRs (#31–#43). Nothing left to build from
the spec — what's left is review and merge:

1. Manually enable "leaked password protection" in the Supabase
   dashboard (Authentication → Providers → Email → Password) — the
   one Phase 17 finding that needs a human with dashboard access, not
   a migration.
2. Run `docs/QA_CHECKLIST.md` in a real (non-sandboxed) browser — every
   item on it is something no phase in this project has had a human or
   working browser look at yet.
3. Review and merge the PR stack in order: #31→#32→#33→#34→#35→#36→
   #37→#38→#39→#40→#41→#42→#43. Each is stacked on the previous, so
   review/merge order matters — merging out of order will show
   unrelated diffs in later PRs until the base catches up.
4. After merging, re-run `npm audit` and the Phase 17 security-advisor
   scan once more against whatever becomes the new `main` — no changes
   are expected, but it's a cheap final confirmation after 13 PRs land.
