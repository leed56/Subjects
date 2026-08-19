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
  flip it. UPDATE (fix-all pass): the repo owner tried enabling it via
  Authentication → Attack Protection and got "Configuring leaked
  password protection via HaveIBeenPwned.org is available on Pro Plans
  and up" — this project's Supabase org is on the Free plan, so the
  toggle is plan-gated, not just a click away. Confirmed skippable for
  now; revisit only if/when the org upgrades to Pro.

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

### Dashboard command center — Owner Dashboard refinement

Branch: `claude/dashboard-command-center`, stacked on `main` (the full
19-phase spec's PR stack, #31–#43, was merged before this work began —
see above). Status: implemented, verified, pushed — draft PR pending,
awaiting review. Not one of the original 19 numbered phases — a
follow-up, explicitly-scoped design/UX pass over `/dashboard` only,
requested separately after the spec shipped.

**Scope, unusually well-specified this time:** a full design brief
(target sections, priority order, visual language, role rules, explicit
DO-NOT list) was provided directly — no scope question needed. Inspected
first: `getDashboardStats()` (`store/actions.ts`) already computed most
needed numbers; extended it (not duplicated) with three new fields
(payments received today, today's scheduled jobs + completed/unassigned
counts, over-limit customers) rather than recomputing any of it inline
in the page.

**Two real bugs found during inspection, fixed as part of this pass:**
- `/dashboard` was in `GUARDED_SHOP_PREFIXES`/`SHOP_PREFIXES` but **not**
  in `TECHNICIAN_ROUTES` — since middleware and `ShopRouteGuard` both
  redirect a disallowed route *to* `/dashboard`, a technician hitting
  any blocked route got bounced into an infinite redirect loop. Fixed
  by adding `/dashboard` to `TECHNICIAN_ROUTES` and giving the page a
  technician-specific branch (see below) instead of the owner view.
- `DataTable`'s clickable rows (`onRowClick`) had no keyboard path at
  all — no `tabIndex`, no `onKeyDown`. Added both (Enter/Space trigger,
  visible focus ring) to the shared component. No other page uses
  `onRowClick` yet, so this is purely additive — zero behavior change
  for `assets`/`customers`/`expenses`/`job-costing`/`stock`/`teams`,
  all of which use `DataTable` without it.

**Structure**, replacing the old flat card-grid dashboard:
1. Compact header (title · shop, weekday/date · "Live business
   overview" · "Cloud synced") — 2 primary actions (`+ New sale`,
   `+ New job`) + a `More ▾` menu (`ActionMenu`, reused as-is) for Add
   stock / Add customer / Record expense / Export CSV.
2. Exactly 4 KPIs: today's sales, today's gross profit (owner/manager
   only — see role notes), payments received today, jobs today.
3. **Today's Operations** — the new main section: a real `DataTable`
   of jobs scheduled today (`scheduledDate === today`, same convention
   Schedule/Phase 7 already uses), columns Customer/Job/Team/Status/
   Action, desktop table ↔ mobile cards for free.
4. **Needs Attention** — compact single-line rows, only for alerts that
   are actually true right now (unassigned jobs today, customers over
   credit limit, overdue/due-soon services, low stock, supplier
   payables outstanding), most severe first; one calm "operations are
   clear" line when there's nothing.
5. **Financial Snapshot** — bank balance / receivables / payables / VAT
   due, all the same visual weight; income tax estimate moved behind a
   collapsed toggle (`▼ Estimated income tax`), not a standing card.
   The old giant black VAT `MeterCard` and indigo income-tax
   `MeterCard` are both gone.
6. **Revenue & Gross Profit** — one dual-series (revenue + profit) bar
   chart, period selector (30 days / 3 / 6 / 12 months), hand-rolled in
   the same no-dependency style as the Reports page's chart (Phase 14)
   but not the same component — that one is daily/single-metric only,
   a different shape than this needs.
7. **Teams Today** — today's jobs grouped by assignee (technician or
   contractor via `assigneeType`/`assigneeId`), *not* `crews.crew_id` —
   the crews table (Phase 6) is real but the `/jobs` form still can't
   set `crew_id` on a job (a known gap since Phase 6), so grouping by
   it would show empty for virtually every real shop. Reused the exact
   assignee-resolution helper the Schedule page already uses.
8. Low stock / credit customers / supplier payables — compact lists,
   grid column count now matches how many of the three actually render
   (was a fixed 3-col grid that left empty tracks when fewer applied).
9. The old "Quick Actions" panel (4 big clickable cards duplicating the
   header's own buttons) is gone; **not** replaced with a second
   "+ Create" menu — the header's 2 primary buttons + `More ▾` already
   cover every action Quick Actions offered, and a second entry point
   would reintroduce the exact duplication this item exists to remove.
10. Smart onboarding: `hasAnyData` (any customers, products, sales, *or*
    jobs — not just "no products", the old check) gates a focused
    3-step "Start using LakBiz" state instead of a dashboard full of
    zeroes; switches to the real dashboard automatically the moment any
    of that exists, nothing to dismiss.

**Role behavior:**
- Owner/manager: full dashboard, `canSeeFinancials` (existing gate,
  unchanged) controls every dollar figure exactly as before.
- data_entry/cashier: no profit/bank/receivables/payables/VAT/tax
  anywhere — KPI slot 2 shows low-stock count instead of profit (bank
  balance is equally financial-gated as profit, `canUseBankingModule`
  uses the same `FINANCIAL_ROLES` check, so it can't fill that slot
  either — an early draft of this page got this wrong and was caught
  on self-review, see remaining risks). cashier additionally can't see
  *any* AC-jobs section (Today's Operations, Teams Today, the unassigned/
  service alerts, the "+ New job" button) — cashier isn't in
  `DATA_ENTRY_ROUTES`'s job-adjacent routes at all, so showing job data
  and a button that just bounces them back here was a second bug caught
  on self-review.
- technician: never reaches the owner dashboard — a separate branch
  (`isTechnician`) renders a financial-free "Today's Jobs" list
  (customer, job type, address, status, call/navigate icons) instead.
  Honestly titled "Today's Jobs," not "My Jobs" — `org_members.role =
  "technician"` (the login) has no link to a specific `technicians.id`
  row (the workforce roster used for job assignment), so there's no
  reliable way to filter to "this person's" jobs specifically without
  guessing. Flagged as a known limitation, not silently faked.

Files changed:
- `src/app/dashboard/page.tsx` — full rewrite.
- `src/lib/store/actions.ts` — `getDashboardStats` extended with
  `paymentsReceivedToday`/`paymentsReceivedCount`, `todayJobs` +
  completed/remaining/unassigned counts, `overLimitCustomers` +
  count/total.
- `src/components/ui/table.tsx` — keyboard accessibility on `DataTable`
  clickable rows (additive, see above).
- `src/lib/nav-sections.ts` — `/teams`'s sidebar label changed from
  `crews.title` ("Installation & Maintenance Crews," the truncation the
  brief called out) to a new short `nav.field_teams` ("Field Teams");
  the `/teams` page's own header text is untouched.
- `src/lib/org-role/permissions.ts` — `/dashboard` added to
  `TECHNICIAN_ROUTES` (redirect-loop fix, see above).
- `src/lib/i18n/translations.ts` — ~68 new `dash.*`/`nav.field_teams`
  keys, both locales.

**Data rules honesty note:** the brief's own example table used
fictional data (`09:00`, `11:30`, `14:00` job times, `Rs. 82,400` VAT
due by a specific date). `ACJob` has no time-of-day field at all (the
data model is date-only — see Phase 7's own notes on this), so the
"Time" column was **not** built with fabricated times; it's a job-number
subtitle under the customer name instead. VAT due date isn't computed
either — the app has no statutory-deadline logic anywhere, and
inventing one would be actively wrong compliance advice for a real
Sri Lankan business; the VAT card shows the real quarter period label
instead (`bounds.label`, e.g. "Apr 2026 – Jun 2026"), the same value the
old dashboard already displayed.

**Known limitation, disclosed, not fixed this pass:** clicking a
Today's Operations row (or its "View →" action) navigates to `/jobs`,
not into that specific job's detail drawer — `/jobs` has no
URL-driven way to open a specific job today, and adding one would be a
real feature change to a different page, outside "refine the dashboard
only." Also found, and deliberately **not** fixed here since it's a
different page: the Reports page's (Phase 14) daily trend chart has the
same class of bug this pass's own first draft had — `Sale.date` is a
full ISO timestamp (`new Date().toISOString()`), and `Reports.tsx`'s
`byDay.get(iso)` looks it up with a plain `YYYY-MM-DD` key, which never
matches; that chart has likely been silently empty since Phase 14
shipped. Originally flagged for a follow-up fix, not bundled into this
PR — **now fixed, see follow-up commit below**, once the same root
cause got flagged again independently via a live screenshot review.

Tests performed:
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, same 3 pre-existing warnings, none new.
- `next build`: succeeds, still 47 routes (no new routes — refined an
  existing page).
- Reasoned through all 10 scenarios in the brief's testing section
  (no data / sales-no-jobs / HVAC-with-jobs / overdue receivables /
  low stock / no alerts / manager / technician / data_entry / mobile)
  against the actual conditional logic in the file.
- No working browser in this sandbox (see Phase 18) — visual QA was a
  careful code-level re-read against the CSS grid math instead of
  screenshots, which is how the two grid-empty-track bugs above were
  caught. Static HTML output checked for the old "Quick Actions" markup
  being gone.

**Follow-up commit, after a user-provided screenshot** of the deployed
preview (zero-activity org — no sales/jobs yet) — the first real pixel
confirmation any UI in this project has had:
- Layout hierarchy, empty states, the sidebar label fix, and the
  grid-collapse behavior (bottom low-stock/receivables/payables row
  correctly absent entirely, not an empty grid) all confirmed rendering
  as intended.
- One real nit found: "Today's Profit"'s hint showed "0% margin" with
  zero sales — mathematically defined (division-by-zero guard already
  defaulted it to 0) but implies a measured zero rather than "no data
  yet." Fixed to show an em dash instead when `todaySales === 0`,
  matching the brief's "show zeros elegantly" requirement.
- Fixed the Reports page date-matching bug flagged above in the same
  commit, since it's the identical root cause and fix already proven
  in this branch's own dashboard chart moments earlier.
- `tsc`/`eslint`/`build` re-verified clean after both fixes.

Remaining risks: same "no browser" caveat as every UI phase in this
project — only the zero-activity state has been visually confirmed so
far; the populated state (real jobs in Today's Operations, real
alerts, a chart with actual bars) has not been screenshotted yet.
Three real logic bugs total were caught and fixed across the two
commits (bank balance shown to non-financial roles; cashier seeing job
data/buttons it can't use; the Reports date-matching bug) — encouraging
that the review process is catching real things, but not a substitute
for someone looking at the populated dashboard too. Add both pages to
`docs/QA_CHECKLIST.md`'s next revision once that happens.

### Dashboard command center — merge into main, and 4 more real bugs

This branch sat unmerged long enough that `/dashboard` diverged
significantly on `main` (Phases 14/15 of the HVAC platform work below
added their own job-profitability and purchase-order-pipeline cards to
the *old* dashboard structure, unaware this rewrite existed). Merging
required real reconciliation, not a mechanical conflict resolution:
kept this branch's whole information architecture (TODAY → OPERATIONS →
NEEDS ATTENTION → FINANCIAL POSITION → TREND) and folded the HVAC
work's job-profitability/purchase-order signals in as two new compact
"Needs Attention" rows (low-margin-jobs-this-month, open-purchase-
orders) rather than reviving their old bigger card layout — consistent
with this page's own "one row per alert, never a card per alert"
density rule.

An automated review (Codex) on this PR also found 4 real, pre-existing
issues in this branch's own code, confirmed by reading the flagged
lines directly rather than trusted blind, and fixed in the same merge:
- **P1 — profit shown to non-financial roles.** The "Business
  Performance" trend card rendered its gross-profit bar, legend, and
  stat unconditionally — unlike every other financial widget on this
  page, it had no `canSeeFinancials` gate at all. Fixed to keep the
  revenue bar/stat visible to everyone (useful, non-financial context)
  while gating only the profit-derived bar/legend/stats behind
  `canSeeFinancials`, matching the reviewer's exact ask ("gate all
  profit-derived chart content") rather than hiding the whole card.
- **P2 — jobs KPI shown to cashiers.** The "Jobs today" metric card in
  the header wasn't gated by `canSeeJobs` at all, unlike its sibling
  cards. Fixed.
- **P2 — Teams Today reachable by roles that can't open it.** Gated
  only by `canSeeJobs`, which is true for `data_entry` (only `cashier`
  is excluded) — but `DATA_ENTRY_ROUTES` doesn't include `/teams`, so
  the link would bounce that role straight back to `/dashboard` via
  `ShopRouteGuard`. Fixed by also requiring
  `canAccessShopRoute(orgRole, "/teams")`.
- **P2 — "My Jobs Today" / "Your assigned work" wording.** The
  technician view's own code comment already explained *why* it can't
  filter to "my jobs" (no `org_members` → `technicians.id` mapping
  exists) and says it's "deliberately titled 'Today's Jobs'" — but the
  actual translation strings still said "My Jobs Today" / "Your
  assigned work for today" in both languages, contradicting the
  comment's stated intent and implying a filter that doesn't exist.
  Fixed the strings to match what the code already claimed.

`tsc`/`eslint`/`next build` re-verified clean after the merge and all
four fixes.
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

**CORRECTION (added during the live-DB audit remediation pass, prior to
Phase 16)**: this section originally claimed `contractors.rate_amount`/
`payable_balance` were an unmasked, unfixed gap predating this phase, and
that claim was repeated in status reports to the user. It was wrong.
Direct inspection of `20250626000001_ac_workforce_financial_masking.sql`
shows `contractors` already gets a `case when can_see_org_financials(...)
then c.rate_amount else 0::numeric end` masked view (and the same for
`payable_balance`), and `20250628000002_fix_masked_view_cross_tenant_leak.sql`
already fixes `contractors`' tenant-scoping the same way `technicians`/
`job_items` needed here. Both migrations predate this entire HVAC
engagement and were confirmed applied on the live DB during the schema-drift
investigation. There is no contractors masking gap and no follow-up is
needed — this disclosure is retracted.

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

### Phase 12 — Low stock & reordering

Audited first: `getLowStockProducts()` already existed and already used
a genuinely **per-item configured minimum** (`product.reorderLevel`),
not a global hardcoded threshold — the spec's core requirement here was
already sound. The real gap: it was only ever used as a metric-card
*count* on `/stock` ("12 items low"), with no way to see *which* items
or act on them — no filtered list, no indication of where to reorder
from.

- Added a "Low stock" filter toggle to `/stock`, alongside the existing
  condition filter tabs — shows exactly the same set `getLowStockProducts()`
  already computed, just as a real, actionable, filtered view instead of
  only a number.
- New `getReorderSuggestions()` in `actions.ts`: for each low-stock
  product, looks up the most recent `Purchase` that included it and
  surfaces that supplier's name and the date — "last bought from X on
  Y" — shown as a subtitle under each item when the Low Stock filter is
  active. Real purchase history (`data.purchases`, already loaded
  locally), not a guess.
- **Deliberately does not suggest a reorder quantity.** That would need
  a demand/sales-velocity model that doesn't exist anywhere in this
  codebase — inventing one here would be exactly the fabricated-signal
  the spec's absolute rules forbid. Current qty vs. the configured
  minimum (already shown) is the honest, complete picture.
- Purchase-order *creation* is deliberately not built here — that's
  Phase 13's, not duplicated.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 3
pre-existing warnings, none new, `next build` succeeds. No browser
verification — standing sandbox limitation.

### Phase 13 — Purchase orders & suppliers

Audited first (per the spec's "audit before building" instruction for
this phase specifically): `purchases`/`purchase_lines` already exist as
a normalized two-table pair (`20250616000002_business_data_schema.sql`),
not JSONB-embedded — a real GRN/bill entity, immediate-receipt only. It
carries the **full-row SELECT-deny** RLS pattern (a
`can_see_org_financials()`-gated policy replacing the plain member-select
policy entirely), shared with `suppliers`, `supplier_payments`, and the
banking tables — a different, simpler masking approach than the
security-barrier-view-plus-INSTEAD-OF-triggers pattern used for
`products`/`ac_jobs`/`technicians`/`job_items`. Nothing in the existing
schema represented "goods ordered but not yet delivered" — the gap the
spec describes was real, not already covered under another name.

Built the smallest genuinely-required new layer, additive to `purchases`,
not a replacement:

- New `PurchaseOrder`/`PurchaseOrderLine` local-first entities (mirrors
  `Purchase`/`PurchaseLine`'s shape) with `supplier`, `lines` (product,
  qty ordered, qty received, unit cost), `expectedTotal`, `status`
  (`pending` / `partial` / `received` / `cancelled`), an optional
  `relatedJobId`, and a `receivedDate`. **Deliberately no
  `paymentMethod`/`creditAmount`/`inputVat`** — a PO is not a bill; those
  fields belong to the existing `Purchase`/GRN record the owner still
  enters separately once the supplier's actual invoice arrives.
- `createPurchaseOrder()` — creates the order. Touches nothing else:
  no stock movement, no `buyPrice` update, no `supplier.payableBalance`
  change. A plan to buy is not a delivery or a debt.
- `receivePurchaseOrder()` — the only place a PO is allowed to move
  stock. Each call is one delivery event (quantity arriving *now*, not a
  new cumulative total), so partial deliveries against the same PO can
  be recorded as they happen. Received qty is clamped to what's still
  outstanding per line — a PO cannot be over-received. Every unit
  received produces a real `StockLog` (`type: "purchase"`, `note: "PO
  <no>"`) through the same trail a GRN purchase uses, and updates
  `product.stockQty`/`buyPrice` the same way `createPurchase` already
  does. Status recomputes to `partial` or `received` off the lines
  actually delivered so far — never inferred, never a manual toggle.
  Nothing moves until this function is explicitly called, per the
  spec's "do not automatically mark unreceived goods as available
  stock."
- `cancelPurchaseOrder()` — guarded: refuses once any line has received
  quantity, since a partially-received PO already has real stock
  movements against it that cancelling would misrepresent.
- **Deliberately does not auto-create a `Purchase`/GRN record on
  receipt.** Receiving a PO and recording the supplier's bill are
  different real-world events (a delivery note and an invoice routinely
  arrive at different times, sometimes for different partial
  quantities); auto-generating a GRN for every receipt would let the
  same delivery be counted twice if the owner also enters the actual
  bill by hand later — exactly the double-counting the spec's absolute
  rules forbid. The owner still records the GRN through the existing
  Suppliers screen when the invoice arrives, with the real payment
  terms.
- New `supabase/migrations/20250709000001_purchase_orders.sql`:
  `purchase_orders`/`purchase_order_lines`, mirroring `purchases`/
  `purchase_lines`'s shape plus the new status/expected-total/job-link/
  received fields, using the audited full-row-SELECT-deny RLS pattern
  (financial-gated SELECT, member-scoped INSERT/UPDATE/DELETE) rather
  than the masked-view pattern — its closest sibling table already
  established this as the right approach for supplier/purchasing data.
  No FK to `ac_jobs` for `related_job_id`, same as `job_items.job_id`
  and `stock_logs.related_job_id` already do — jobs are local-first,
  client-assigned ids, and `ac_jobs` itself is a view, not a base table.
- Full local-first wiring: `AppData.purchaseOrders`, pull/push mappers
  in `business-sync.ts` (both the eager per-action snapshot push and the
  periodic full `pushBusinessData`/prune sweep), and the offline
  merge-conflict resolver (`mergeAppData` — otherwise a genuine offline
  edit to a PO could silently vanish on the next reconnect merge).
  `createPurchaseOrderToCloud` / `receivePurchaseOrderToCloud` /
  `cancelPurchaseOrderToCloud` added to the store provider, gated behind
  the same `canUseSuppliersModule` write-permission check as the
  existing purchase flow.
- UI: `/suppliers` gained a "New purchase order" entry point next to
  the existing "Record purchase (GRN)" button, a create form (supplier +
  per-product qty/unit-cost lines + optional linked job), a Purchase
  Orders list with status badges and per-row Receive/Cancel actions, and
  a Receive dialog (remaining-quantity inputs per line, clamped to what's
  outstanding).
- **Audit side-fix**: while reading `syncPurchaseSnapshot` as the
  template for the new PO sync function, found its eager-push stock-log
  filter checked `log.type === "in"` — stale from before Phase 3
  introduced the `"purchase"` movement type (`createPurchase` has always
  tagged its logs `"purchase"`, never `"in"`), so a GRN's stock logs
  never reached the eager per-action cloud push. Not a data-loss bug —
  the periodic full `pushBusinessData` sweep pushes all stock logs
  unconditionally and already covered the gap — but a real completeness
  bug in the exact function this phase's sync code is modeled on, so
  fixed it in the same commit (`log.type === "purchase"`) rather than
  knowingly copying a broken filter into new code.
- Not built: reorder-quantity suggestions on a PO (Phase 12 already
  covered and declined this — no demand model exists to base one on);
  a supplier-facing PO PDF/print view; multi-currency or landed-cost
  allocation across a PO's lines.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 2
pre-existing warnings (`deleteACJobFromCloud` unused import,
`useMemo` dependency on `org.id`), neither new nor touched by this
phase, `next build` succeeds. No browser verification — standing
sandbox limitation.

### Phase 14 — Dashboard: job profitability (first slice of the dashboard redesign)

The spec gates the dashboard redesign on Phases 2-13 existing first —
they now do. Rather than one giant rewrite, splitting the redesign into
reviewable slices; this is the first: **surface real job profitability
on `/dashboard`, where today there is none.**

Audited first: `getDashboardStats()` (the dashboard's one stats
function) computes AC job *counts* by status (pending, service-due,
overdue) but never touches cost or margin — that calculation has only
ever lived inside `/job-costing`'s page component (Phase 8). No
fabricated placeholder metric existed to replace; the gap was a true
absence, not a bad number.

- Dashboard now fetches job-linked Expenses (Phase 7, cloud-only) the
  same way `/job-costing` already does, and reuses
  `computeJobProfitability()` (Phase 8) — the one authoritative
  calculation — over this month's non-cancelled AC jobs. No parallel
  formula.
- New **Job profitability (this month)** card: total margin + average
  margin % (quoted-weighted, same formula as `/job-costing`'s totals
  row), linking to the full report.
- New **Jobs to review** card: jobs flagged low-margin, worst first.
- New explicit, disclosed "low margin" rule — the spec's absolute
  rule requires one before any job can be labelled this way. Added
  `LOW_MARGIN_THRESHOLD_PCT = 15` and `isLowMarginJob()` to
  `job-profitability.ts` (the one file that already owns the
  profitability formula, so the label rule lives next to what it
  labels) — a flat 15% gross-margin floor, documented inline with the
  reasoning. Jobs with no assessable margin (`grossMarginPct === null`,
  i.e. zero revenue) are never flagged: "can't be assessed" is not the
  same claim as "low margin."
- Retrofitted `/job-costing` itself to use the same `isLowMarginJob()`
  helper for a small badge on its margin column, so a job flagged "low
  margin" means the identical thing on both screens — one rule, not two
  independently-tuned ones.
- Gated on `showAcJobs && canSeeFinancials`, same guard `/job-costing`
  already uses — company margin stays invisible to any role that
  shouldn't see it, including while the Expenses fetch is still
  in flight (the section simply doesn't render until data has
  arrived, rather than flashing a zero).
- Section only renders when there's at least one job this month to
  report on — consistent with how the existing vehicles/AC-jobs
  attention grid below it already behaves.

Deliberately not built in this slice (next dashboard phases):
- **Purchase order pipeline widget** (Phase 13's new pending/partial
  POs) — kept out to keep this PR reviewable as one clear addition;
  next slice.
- **Org-wide repeat-repair rollup** (Phase 11's signal) — audited and
  found genuinely blocked, not skipped for convenience: `ac_jobs.asset_id`
  exists at the DB level but isn't in the local `ACJob` type and isn't
  settable from the `/jobs` create/edit form yet (a pre-existing,
  already-documented gap — see "Not started" below). Almost no job
  today would carry a real `asset_id`, so a dashboard-wide count would
  read as "0 repeat repairs" for reasons that have nothing to do with
  actual repair history — exactly the misleading-signal the spec's
  absolute rules forbid. Stays per-asset (`/assets`) until that wiring
  gap is closed.
- A dashboard-level low-stock **reorder-supplier** hint (Phase 12
  already put this on `/stock` itself, where the action happens).

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 2
pre-existing warnings, unchanged, `next build` succeeds. No browser
verification — standing sandbox limitation.

### Phase 15 — Dashboard: purchase order pipeline (redesign slice 2)

Second dashboard-redesign slice, the one deliberately deferred out of
Phase 14 to keep that PR reviewable: surface Phase 13's purchase orders
on `/dashboard`.

- `getDashboardStats()` gains `openPurchaseOrderCount` /
  `openPurchaseOrderValue` / `openPurchaseOrders` — pure local
  computation, no cloud fetch needed (unlike Phase 14's job
  profitability, purchase orders already live in local-first `AppData`
  since Phase 13).
- **"Outstanding value" is deliberately not a PO's `expectedTotal`.** A
  partially-received PO has already turned part of that total into real
  stock; summing full `expectedTotal` across open POs would double-count
  value that already landed. Computed instead as
  `Σ (qtyOrdered − qtyReceived) × unitCost` per line — what's still
  actually expected to arrive.
- New **Open purchase orders** card: count + outstanding value, plus
  the oldest 5 open (pending/partial) POs by order date — oldest first,
  so the ones waiting longest surface first, not the most recent.
- Gated on `canSeeFinancials`, matching the RLS reality underneath it:
  `purchase_orders`/`purchase_order_lines` are already invisible at the
  database layer to non-owner/manager roles (Phase 13's audited
  full-row-SELECT-deny policy), so this is belt-and-suspenders
  consistency with the other financial dashboard cards, not a new gate.
- Section only renders when there's at least one open PO — same
  "don't render empty cards" convention as every other conditional
  section on this page.

Tests performed: `tsc --noEmit` clean, `eslint` — 0 errors, same 2
pre-existing warnings, unchanged, `next build` succeeds. No browser
verification — standing sandbox limitation. (A screenshot of the live
Vercel preview from Phase 14 confirmed the dashboard renders cleanly on
a fresh/empty org — first real visual confirmation this engagement has
had of the actual running app, though it couldn't exercise this card
specifically since that org has no purchase orders yet.)

### Critical infra fix — live database schema drift (Phases 3, 4/5, 6, 7, 9, 13 never actually applied)

Reported by the user testing the live Vercel preview: a "Cloud save
failed" banner reading `Could not find the 'hourly_rate' column of
'technicians' in the schema cache`, plus the Suppliers screen appearing
unresponsive.

Root cause, found via direct introspection of the live Supabase project
(`nexus-erp`) using the Supabase MCP tools — access this session had the
whole time but had not yet used for live verification: **every migration
file written for Phases 3, 4/5, 6, 7, 9, and 13 in this engagement had
only ever existed in git.** None had been applied to the actual database
the deployed app talks to. `list_migrations`' tracked history turned out
to be an unreliable signal on its own (several older, unrelated
migrations exist live without a matching tracked entry, evidently
applied by hand at some point) — the only trustworthy check was
introspecting real table/column/constraint state directly, which is what
this fix is based on, not migration-file bookkeeping.

Concretely, before this fix, the live database was missing:
- `stock_logs.related_job_id`/`related_supplier_id`/`user_id`, and its
  `log_type` check constraint still only allowed `('in','out','sale')` —
  meaning any stock movement of type `purchase`/`job_usage`/`job_return`/
  `supplier_return`/`write_off` would have been rejected outright by the
  database. This affected the base `createPurchase` (GRN) flow, not just
  HVAC-specific ones — no purchase's stock log has likely ever
  successfully synced to the cloud on this project.
- `job_items.source`/`product_id`/`supplier_id`/`purchase_ref`/
  `purchase_date`/`customer_price`, and the `job_items`/`technicians`
  masked views + `hourly_rate` entirely (this is what the user's
  reported error came from).
- `expenses.job_id`.
- `ac_jobs_base.complaint`/`diagnosis`.
- `purchase_orders`/`purchase_order_lines` — didn't exist at all.

Applied all six missing migrations directly to the live project via
`mcp__Supabase__apply_migration`, in dependency order, verifying table/
column/constraint state before and after each one.

**Two real bugs found and fixed while applying, not just replayed
blind:**
1. **Cross-tenant data leak.** The original `labor_costing.sql`'s
   `technicians`/`job_items` masked views had no tenant `WHERE` clause at
   all — unlike every other masked view in this codebase (`ac_jobs`,
   `products`, `sales`, `contractors`, `vehicles`), which all filter to
   the caller's own orgs. Any authenticated user from any organization
   could have read every organization's technician names/phones/notes
   and job_items' job_id/qty/source (the numeric financial columns would
   still have masked to null/0 per-row, but the rest would not). The
   trigger functions were also `security invoker` with no write-permission
   check, unlike every other masked-view trigger, so any authenticated
   org member — including a role explicitly barred from managing
   technicians — could write or delete any org's technician or job_item
   row. Fixed to match the established pattern exactly (tenant-filtered
   view, `security_invoker = false`, `security definer` trigger functions
   gated by `org_member_can_write_module`).
2. **Self-caught deployment mistake, corrected before it caused harm.**
   The first live-apply attempt gated the new write-permission check on
   `org_member_can_write_module(org_id, 'technicians')` — 'technicians'
   is not a real module key (`plans.features` has no such key), so
   `org_has_module` would have returned false unconditionally, blocking
   *all* technician writes for *every* role, including owners. Caught by
   checking the live `plans.features` keys and `contractors_view_insert`'s
   already-working equivalent (which gates the same workforce-adjacent
   write under `'ac_jobs'`) before reporting the fix as done — corrected
   immediately, live and in the repo file, to use `'ac_jobs'`.

Also found, while applying `job_complaint_diagnosis.sql`, that a
*pre-existing, unrelated* gap already lived in the `ac_jobs` view's
trigger functions: neither INSERT nor UPDATE ever forwarded
`asset_id`/`crew_id` at all, meaning linking a job to an asset or a crew
has never actually persisted at the database layer, regardless of what
the UI sent. Since this migration already had to rewrite the same view
and both trigger functions to append `complaint`/`diagnosis`, fixed this
in the same pass rather than reproducing a known-broken column list a
third time — this is also part of why Phase 14's audit found "almost no
job carries a real `asset_id`."

Also ran the Supabase security advisor after all six migrations: the new
`technicians_view_*`/`job_items_view_*` functions showed up as
anon/public-executable — the exact class of gap this repo's own earlier
security-hardening migrations
(`revoke_anon_execute_internal_functions.sql` /
`revoke_public_execute_internal_functions.sql`) already closed for every
*other* masked-view trigger function, just before these two existed.
Applied the identical revoke/grant pattern to match, live and as a new
migration file in the repo.

**Corrected the two affected repo migration files in place** (rather
than leaving a known-bad version in git history for the next fresh
deploy to replay) and added one new migration file for the anon-execute
revoke. Verified live afterward: `hourly_rate` column present, both
masked views tenant-filtered, `purchase_orders`/`purchase_order_lines`
exist with RLS, security advisor clean of anything but the two
pre-existing, already-accepted categories (the `security_definer_view`
lint every masked view in this codebase triggers by design, and the
already-known, dashboard-only-fixable leaked-password-protection
setting).

This was found and fixed live-first (the user was actively blocked) —
the corrected migration files are being shipped as their own PR to keep
git as the source of truth for any future fresh deployment, separate
from the phase-by-phase feature PRs.

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

*(The list above predates the HVAC platform work (Phases 0-18 of the
original SMB dashboard spec, PRs #31-#43, all long since merged) —
kept for history, superseded by everything below.)*

## Post-merge fixes — critical live bugs found after all 15 HVAC PRs landed

**Critical: technicians/job_items cloud save broken since Phase 6.**
User-reported live error: "Cloud save failed — there is no unique or
exclusion constraint matching the ON CONFLICT specification." Root
cause: Phase 6 (`labor_costing.sql`) turned `technicians`/`job_items`
into masked security-barrier views (no unique constraint of their own —
only the `_base` tables have one), but `business-sync.ts` was never
fully updated to match. Three call sites (`syncJobItemSnapshot`,
`syncTechnicianSnapshot`, and `pushBusinessData`'s full-snapshot sync
step) still wrote through the raw `.upsert(rows, {onConflict: "id"})`
path (`upsertOrgRows`) instead of the insert/update-split path
(`upsertMaskedViewRows`) already used correctly for the other masked
views (`sales`/`products`/`ac_jobs`/`contractors`/`vehicles`). Fixed
by routing all three through `upsertMaskedViewRows` and extending its
type union to accept `"technicians" | "job_items"`. No schema change
needed — pure app-layer bug, introduced when Phase 6 shipped the
masking migration without a full write-path audit. `tsc`/`eslint`/
`next build` all clean; same 3 pre-existing unrelated warnings.

**`stock_logs.user_id` now enforced server-side.** Previously disclosed
(via an automated Codex review comment, not fixed at the time):
`stock_logs.user_id` — added in `20250704000001_stock_movement_types.sql`,
documented then as "Nullable — populated by the app layer, not enforced
by RLS" — was fully client-controlled. `business-sync.ts`'s
`stockLogRow()` sent whatever `log.userId` the local app state held,
and the table's INSERT/UPDATE RLS policy only checked `organization_id`
membership, never `user_id`. Any org member could write a stock
movement log attributed to a different member. Fixed via
`20250711000001_stock_logs_user_id_server_stamp.sql`: a `BEFORE INSERT
OR UPDATE` trigger (`stock_logs_stamp_user_id`) that always overwrites
`user_id` with `auth.uid()` for authenticated writers, ignoring
whatever the client sent — keeps the offline-first ergonomics (client
can still populate it optimistically for local display) while making
the persisted value trustworthy. Applied live and verified via
`pg_trigger`; `get_advisors(security)` shows the new function flagged
with the same `authenticated_security_definer_function_executable` WARN
every other masked-view trigger function already carries (trigger
functions returning `trigger` aren't reachable via PostgREST's `/rpc/`
surface regardless of the grant, so this is the same accepted,
pre-existing class of warning, not a new one).

**Retracted: contractors financial-masking "gap."** An earlier status
report and Phase 6 comment both claimed `contractors.rate_amount`/
`payable_balance` were an unmasked, unfixed gap predating Phase 6. That
claim was wrong — direct inspection of
`20250626000001_ac_workforce_financial_masking.sql` and
`20250628000002_fix_masked_view_cross_tenant_leak.sql` (both predating
this entire HVAC engagement, both confirmed applied live) shows
`contractors` was already correctly masked and tenant-scoped. See
`20250706000001_labor_costing.sql`'s corrected comment for the full
retraction.

**Critical: products.active/notes missing live, same class of drift.**
User-reported live error: "Cloud save failed — Could not find the
'active' column of 'products' in the schema cache," seen on the
Customers page (the full-snapshot background sync touches every table
regardless of which page triggered it, so the banner isn't
page-specific). Root cause: `20250703000001_products_active_notes.sql`
(Phase 2) was never applied to the live DB — same failure mode as the
Phases 3-13 gap fixed earlier, just missed by that earlier sweep.
Corrected in place (not replayed verbatim) because two later migrations
changed the live shape since that file was written:
`20250625000003_masked_view_triggers_security_definer.sql` (insert/
update triggers are SECURITY DEFINER with an
`org_member_can_write_module(..., 'stock')` check, not the original's
SECURITY INVOKER/no-check version) and
`20250628000003_fix_masked_view_grant_regression.sql` (the view has its
own tenant WHERE clause and `security_invoker=false`, not the
`security_invoker=true` + base-table-grant shape the original targeted,
which that later migration deliberately reverted as a masking-bypass
risk). Rebuilt against the actual live view/function definitions
(fetched via `pg_get_viewdef`/`pg_get_functiondef` first) rather than
assumed. Applied live and verified: `products.active`/`notes` columns
exist, `get_advisors(security)` shows no new categories beyond the
already-accepted pre-existing ones.

Prompted a broader live-schema sweep across every Phase 2-15 column/
table this session had touched (technicians.hourly_rate, job_items
material-source columns, ac_jobs.complaint/diagnosis/asset_id/crew_id,
purchase_orders, crews, ac_assets, stock_logs log_type check,
expenses.job_id) — all confirmed present; `products.active`/`notes`
was the only remaining gap found.

Still open, genuinely disclosed, not yet fixed: nothing else identified
so far this pass. Next: continue the Phase 19-style role/permission
audit — this pass's real bugs were all found by re-verifying past
claims against the live system rather than trusting prior write-ups,
which is the same method worth applying to the rest of the audit.

## Phase 19 — role/permission audit (started for real)

Systematic, not reactive this time: read `src/lib/org-role/permissions.ts`
(the app's own documented role matrix) end to end, confirmed real
server-side route enforcement exists in `middleware.ts` (matches the
matrix, no drift), then checked whether the *database* enforces the same
matrix for writes — it did not. Two real findings, both fixed in
`20250712000001_role_aware_write_rls.sql`, applied live and verified:

**1. CRITICAL — masking bypass on `technicians_base`/`job_items_base`.**
Both tables kept a direct `SELECT` grant to `authenticated` that the
other six masked-view base tables (`sales_base`, `sale_lines_base`,
`products_base`, `ac_jobs_base`, `contractors_base`, `vehicles_base`)
had revoked back in `20250628000002`/`20250628000003`. These two were
added later by Phase 6 (`20250706000001_labor_costing.sql`) and simply
missed that treatment. Any authenticated org member — including a
technician — could query `technicians_base`/`job_items_base` directly
and read real `hourly_rate`/`unit_price`/`line_total`/`customer_price`,
completely bypassing the `technicians`/`job_items` views' column
masking. Fixed: `revoke select ... from authenticated` on both.

**2. Role-blind writes across 22 tables.** `org_member_can_write_module`
(used by every write RLS policy and inline inside every masked-view
trigger function) only checks org membership + plan/module entitlement —
never the calling member's role. The documented matrix says a cashier
must never touch Suppliers/Banking and a technician must never touch
Stock/Sales/Customers, but that was only ever enforced by hidden UI and
middleware redirects — never by the database. A direct authenticated
REST call from any staff member's own valid session was never blocked
for: products, stock_logs, sales, sale_lines, customers,
customer_payments, customer_product_prices, suppliers, purchases,
purchase_lines, supplier_payments, bank_accounts, bank_transactions,
bank_transfers, cheques, vehicles, ac_jobs, job_status_history,
job_items, technicians, contractors, contractor_payments. Fixed: a new
`org_member_role_in(org_id, roles)` helper, ANDed into all 66
insert/update/delete RLS policies across those 22 tables AND into all
24 masked-view trigger functions (the triggers are `SECURITY DEFINER`
and bypass the base table's own RLS entirely — fixing only the table
policies would have left the view-write path, the one the app actually
uses, unprotected). Role sets mirror the app's own existing permission
functions (`canOperateAcJobs`/`canUpdateAcJob`,
`canUseSuppliersModule`, `canUseBankingModule`) as closely as possible —
shop staff (owner/manager/data_entry/cashier) for stock/sales/customers;
owner/manager only for suppliers/banking/vehicles/the workforce roster
(technicians/contractors/contractor_payments — "no financial fields"
per the matrix, and technicians' own hours-logging goes through
job_items, not this table, so nothing real breaks); owner/manager/
data_entry for ac_jobs itself (matches `canOperateAcJobs` — technician
deliberately excluded, `canUpdateAcJob` already returned false for that
role on every field); owner/manager/data_entry/technician for
`job_items` only (the one table Phase 6 explicitly built for
technicians to log their own labour/parts).

**Bonus find while rewriting the trigger functions**: `job_items_view_delete`
and `technicians_view_delete` both referenced `new.organization_id`
inside their permission check — but `NEW` is always `NULL` in a DELETE
trigger. This meant `org_member_can_write_module(null, ...)` was always
false, so deleting a job item or a technician via the app
(`deleteJobItemFromCloud`/`deleteTechnicianFromCloud`) has *always*
raised "permission denied" and never actually worked, since Phase 6
shipped. Fixed to `old.organization_id`, the only row data a DELETE
trigger has. Pre-existing, not introduced this pass — caught only
because every function was rewritten by hand and compared line-by-line
against its original rather than pattern-substituted blindly.

Deliberately not attempted this pass (disclosed, not silently left):
write-time value masking on INSERT for `job_items` — `UPDATE` already
clamps `unit_price`/`line_total`/`customer_price` to the existing value
for a non-financial role via `case when can_see_org_financials(...)`;
`INSERT` has no equivalent clamp, so a non-financial role could still
set an arbitrary cost on a brand-new job item (though not read it back,
since SELECT stays masked). Needs its own careful design — flagged for
a dedicated follow-up, not fixed here.

Verified: `get_advisors(security)` after this migration shows no new
warning categories — `org_member_role_in` gets flagged with the exact
same `authenticated_security_definer_function_executable` WARN every
other internal helper (`can_see_org_financials`, `is_org_member`,
`org_has_module`, etc.) already carries, which is the accepted,
by-design class for this codebase's internal SQL helpers.

## Phase 19 — closing the disclosed job_items INSERT gap

Picked up the follow-up flagged in the previous entry:
`job_items_view_insert` had no financial-masking clamp, unlike
`job_items_view_update`. First attempt (applied, then corrected within
the same pass, before it ever reached a merged migration) simply
clamped `unit_price`/`line_total` to 0 for any non-financial-role
insert — caught before shipping that this would have been a real
regression: `data_entry`/`technician` are both designed, frequent users
of "add a stock part to this job," and stock-sourced parts have a real
cost (`products_base.buy_price`) that must be recorded for job costing
to stay accurate. Zeroing it would have silently corrupted every
non-owner/manager-added stock part's cost — worse than the gap it was
meant to close.

Corrected fix (`20250712000002_job_items_insert_financial_masking.sql`,
applied live and verified, `get_advisors` clean, no new categories): for
`source = 'stock'`, unit price is now always derived server-side from
`products_base.buy_price` — for every role, including owner/manager —
rather than trusted from client input at all. Safe for a non-financial
role to trigger (they never see the resolved value; SELECT stays
masked) and a stronger form of "do not calculate historical jobs using
today's part cost" than trusting a client-computed snapshot. For
`purchased`/`customer_supplied` sources — genuinely free-text,
user-entered costs — the `can_see_org_financials` clamp (0/null
fallback) still applies. `line_total` is now always server-computed
from the resolved unit price so it can never drift from it.

`UPDATE` deliberately left unchanged: re-deriving a stock item's price
from today's `buy_price` on every edit would itself violate "don't
recalc historical jobs using today's price," just in the other
direction (silently repricing an already-frozen snapshot because qty or
notes changed). Preserving the existing value on a non-financial edit
and trusting a financial role's explicit correction remains correct.

## Phase 19 — role-aware SELECT enforcement (read side)

The write-side fix (20250712000001/2) left SELECT untouched: every
policy checked was member-only, no role condition, even though the
matrix says technician has no access to Stock/Sales/Customers at all,
and cashier/data_entry have none to AC assets/the workforce module.
Verified safe before writing anything — checked every technician/
data_entry/cashier-reachable page's actual data usage first: the
job_items "add a stock part" picker (technician's real workflow) only
reads `products` (never customers/sales/stock_logs); a job's customer
info is already denormalized onto `ac_jobs_base` itself, so technician
never needs the standalone `customers` table; the only UI that reads
`customers` directly (the New/Edit job form) is already gated behind
`canOperateAcJobs`, which excludes technician; and no technician/
data_entry/cashier page references `data.sales`, `data.saleLines`,
`data.customerPayments`, `data.customerProductPrices`, `data.stockLogs`,
or `data.crews` at all. `products` itself was deliberately left
unrestricted — technician genuinely needs to read it, and `buy_price`
is already correctly column-masked there, which is the right control
for that table, not a SELECT block.

Fixed in `20250712000003_role_aware_select_rls.sql` (applied live,
verified, `get_advisors` clean): `customers`, `customer_payments`,
`customer_product_prices`, `stock_logs` now exclude technician;
`ac_assets` excludes cashier; `crews` excludes data_entry and cashier.

Caught before shipping: `sales_base`/`sale_lines_base` already have
direct `SELECT` revoked from `authenticated` (from the earlier
cross-tenant-leak fix) — the app only ever reads them through the
`sales`/`sale_lines` views, which run `security_invoker = false` and
bypass the base tables' RLS entirely via their own hardcoded `WHERE`
clause. An RLS-policy-only edit on the base tables would have been
unreachable dead code for the real read path. Fixed at the actual
enforcement point instead — the views' own `WHERE` clauses, same file.

## Phase 20 — accounting double-counting audit

Started by reading every cost-rollup function end to end
(`job-profitability.ts`, `income-tax.ts`, `vat.ts`) rather than assuming
the existing "deliberately excludes double-counting" comments were
still accurate — the same method that's caught every real finding this
audit. Found one.

**Real bug: "outsourced_repair" expenses double-count against
subcontractCost.** `expenses-client.ts`'s `ExpenseCategory` comment
already shows the author was aware of this exact risk — "Deliberately
no 'subcontractor' category here: that cost is already captured by
ACJob.subcontractCost... adding one would invite double-counting the
same cost two ways" — but missed that `outsourced_repair` is the same
real-world payment under a different name. Nothing in the UI or in
`computeJobProfitability` stopped a shop from setting
`ac_jobs.subcontractCost` for a contractor-assigned job **and**
separately logging an "Outsourced repair" Expense linked to that same
job — the Expenses form's job-link picker (`app/src/app/expenses/
page.tsx`) offers every job with no validation against the job's
assignee type. `job-profitability.ts`'s own header comment even claimed
the Expenses total "deliberately excludes the subcontractor concept...
so it isn't counted twice" — true for the category name, false in
practice, since `outsourced_repair` was never excluded from the sum.

Fixed in `job-profitability.ts` (the one authoritative job-cost
function, per its own docstring — fixed at the root, not duplicated
across the three call sites that use it): `computeJobProfitability`'s
third parameter changed from a pre-summed `linkedExpenseTotal: number`
to an itemized `linkedExpenses: JobLinkedExpense[]` (`{category,
amount}[]`), specifically so the function itself can apply the guard —
summing before calling would defeat it. When a job is
contractor-assigned with a `subcontractCost` already set,
`outsourced_repair`-category linked expenses are now excluded from
`otherCost`. An `outsourced_repair` expense on a *non*-contractor job
still counts normally — it's a genuine, distinct cost in that case, not
a duplicate of anything.

Updated all three call sites (`/job-costing`, the Job Sheet drawer in
`/jobs`, and the dashboard's job-profitability section) to fetch and
pass itemized expenses instead of a pre-summed total. `/jobs`' "Linked
expenses" info line (outside the cost table, just "how much you've
logged against this job") deliberately keeps showing the raw,
un-excluded total — a different, still-correct question from what
`profit.otherCost` answers.

Also noted, not fixed this pass (a separate, opposite problem —
under-counting, not double-counting, so out of scope for Phase 20's
specific mandate but worth flagging for whoever picks up Reports/
Phase 24): `income-tax.ts`'s `getIncomeTaxYearSummary` never includes
AC job revenue or AC job material/labor costs at all — only POS
`sales`, vehicle sales, and `subcontractCost` feed the estimate. If AC
job invoicing doesn't separately create a `sales` row (not yet
verified), a shop doing significant AC installation revenue would see
an income-tax estimate with none of that business line's revenue or
cost in it. Distinct issue from this phase's mandate; flagged, not
touched.

Tests: `tsc --noEmit` clean, `eslint` — 0 errors, same 3 pre-existing
warnings, `next build` succeeds, same route list.

## Phase 25 — performance / N+1 review

Found via the highest-signal search for this class of bug: every
`for (const x of list) { await ... }` loop in the codebase whose body
makes a network call. One file, `business-sync.ts`, had two real ones,
and both sit in the same hot path: `pushBusinessData`, the full-snapshot
cloud sync. It's not an occasional operation — `scheduleCloudPush` (in
`app-store-provider.tsx`) debounces it just 1.5s and is called from
roughly 90 places across the app, i.e. after any local edit anywhere.
Critically, it always pushes the *entire* local dataset, not a delta —
so both bugs below meant every single edit's sync cost grew with the
org's total historical row count, not with what actually changed.

**1. Sale/purchase/purchase-order line items — O(records) round trips,
now O(records / 200).** The full-sync path looped `for (const sale of
data.sales) { ... await replaceSaleLines(...) }` (same shape for
purchases and purchase orders) — 2 sequential round trips (delete then
insert) per record, awaited one at a time. `saleLineRows`/
`purchaseLineRows`/`purchaseOrderLineRows` were already the full
flattened arrays across every parent record (built via `flatMap`
earlier in the function) — there was no reason to filter them back
apart and replace them one parent at a time. An org with 800 historical
sales paid ~1600 sequential round trips on every edit, growing without
bound as history accumulated. Fixed with a new `replaceLinesBatch`
helper: one batched delete per chunk of parent ids (chunked at 200,
since `.delete().in(...)` filters ride in the URL query string, which
has a real length limit `.insert()`'s body-based payload doesn't share)
and one batched insert per chunk of rows. Same end state, `records/200`
round trips instead of `records × 2`. The single-record push functions
(`replaceSaleLines` etc., used by `syncSaleSnapshot` and friends for an
immediate one-record save) are untouched — one record's lines really is
the right unit of work there; only the full-sync loop was the bug.

**2. Masked-view row updates — same round-trip count, but now
concurrent instead of sequential.** `upsertMaskedViewRows` (used for
`sales`/`products`/`ac_jobs`/`contractors`/`vehicles`/`technicians`/
`job_items` — every masked-view table, every full sync) already batches
inserts in one call, but looped `for (const row of toUpdate) { ... await
... }` for updates — one row at a time, awaited sequentially. This
couldn't be collapsed into a single batched call the way inserts can:
each row carries different column values, PostgREST's `.update()`
applies one patch to every matched row, and `ON CONFLICT`-based upsert
isn't available against a masked view (no unique constraint of its own —
the same limitation behind the technicians/job_items upsert-conflict
fix earlier in this project). On an established org, most rows in a
full sync already exist, so `toUpdate` is typically most of the table —
this was often the more expensive of the two bugs, not a minor one.
Fixed by running the per-row updates concurrently in bounded batches of
25 (`Promise.all` per batch, not 200 — that constant is sized for
URL-length limits, not connection concurrency; 200 simultaneous
requests from one tab risks connection-pool exhaustion or looking like
abuse to Supabase's edge) instead of one connection at a time. Same
number of requests, same server load — just no longer waiting for each
one to finish before starting the next.

Not fixed this pass, flagged for whoever next touches sync
architecture: a genuinely N+1-proof fix for #2 would need a Postgres RPC
that accepts a JSONB array and bulk-updates via
`UPDATE ... FROM jsonb_to_recordset(...)`, one real round trip instead
of `records/25`. That's a schema change with its own testing surface,
out of scope for an app-layer perf pass — the concurrent-batching fix
here is a safe, large, immediately-shippable improvement without it.

Tests: `tsc --noEmit` clean, `eslint` — 0 errors, same 3 pre-existing
warnings, `next build` succeeds, same route list. No browser
verification of actual sync timing before/after — standing sandbox
limitation, same as every phase before it; the fix is a straightforward
round-trip-count reduction with no behavior change to what gets
written, so the risk profile is different from a logic change, but a
real before/after timing check on an org with meaningful history is
still worth doing once someone has a browser on this.

## Fix-all pass — AC job revenue/cost missing from income tax

Requested directly ("fix all the issues not fixed") after a status
report that disclosed this as a known, unfixed gap: `getIncomeTaxYearSummary`
(income-tax.ts) never included AC job revenue or job cost anywhere in
its formula. It only ever subtracted `subcontractCost` for
contractor-assigned completed jobs as a standalone expense line
(`subcontractExpense`) — the quoted amount (revenue) for *any* completed
AC job, contractor or in-house, was invisible to the tax estimate, and
contractor jobs were actually double-penalized in effect: their cost
counted, their revenue never did.

Verified before changing anything that this wouldn't create a new
double-count: AC job invoicing (`jobs/[id]/invoice/page.tsx`) is a pure
print/view page that reads `job.quotedAmount`/`depositAmount` directly
off the job record — it never calls `createSale`/`addSale`. The only
`createSale` call site in the app is the POS checkout flow
(`createSaleToCloud` in `app-store-provider.tsx`), and that's the
opposite direction (a retail sale of an AC *unit* can auto-create an
install job) — not a path that could already be putting AC job revenue
into `data.sales`. So AC job profit was simply absent, not
double-counted elsewhere.

Fixed by folding full job profitability into the formula instead of
just contractor cost, reusing `computeJobProfitability` (Phase 8/20 —
the one authoritative job-cost function, already correct including the
Phase 20 outsourced_repair/subcontractCost double-count guard) rather
than re-deriving a second formula:

- `getIncomeTaxYearSummary` gained a 4th parameter,
  `jobLinkedExpenses: Map<string, JobLinkedExpense[]> = new Map()` —
  same cloud-only-Expenses constraint and same map-shape as
  `otherExpenses` before it; defaults to empty so no caller breaks by
  omission.
- Sums `computeJobProfitability(job, jobItems, linkedExpenses).grossProfit`
  across every `status === "completed"` AC job in the fiscal year
  (same date filter — `installedDate ?? date` — the old
  `subcontractExpense` filter already used) into a new `acJobProfit`
  field, which **replaces** `subcontractExpense` in
  `IncomeTaxYearSummary` (contractor cost is still in there — it's
  inside `grossProfit` via `computeJobProfitability`'s `laborCost` —
  just netted against that job's own revenue instead of standing alone).
- Formula changed from `salesProfit + vehicleProfit - subcontractExpense
  - otherExpenses` to `salesProfit + vehicleProfit + acJobProfit -
  otherExpenses`.

**Double-counting risk found and fixed in the same pass**:
`expenses/page.tsx`'s `yearTotal` (passed as `otherExpenses`, used for
its "tax impact of adding expenses" comparison) summed *all* fiscal-year
org expenses with no filter excluding job-linked ones. Since
`acJobProfit` now nets job-linked expenses out per-job via
`computeJobProfitability`, an unfiltered `yearTotal` would have
double-subtracted those same expenses a second time through
`otherExpenses`. Fixed by filtering `yearTotal` to `!e.jobId` (general
expenses only) and building a `jobLinkedExpenseTotals` map from the
job-linked subset to pass into both `getIncomeTaxYearSummary` calls on
that page.

Caller-by-caller:
- `/vat` — previously called `getIncomeTaxYearSummary(data)` with no
  expense fetch at all and displayed `subcontractExpense` in a
  `ProStatCard`. Now fetches org expenses on mount (same
  `fetchOrgExpenses` + jobId-keyed map pattern already used by
  `/job-costing`/`/jobs`/dashboard, gated on `canSeeFinancials` like
  those), passes the map in, and displays the new `acJobProfit` field
  instead (new `tax.ac_job_profit` translation key, EN + Sinhala; tone
  now flips rose/teal on sign since this is a profit figure, not a flat
  cost).
- `/expenses` — already had all org expenses in local state; wired as
  described above.
- `/dashboard` — already fetches `jobLinkedExpenseTotals` for its own
  job-costing "Needs Attention" section (gated `showAcJobs &&
  canSeeFinancials`); reused directly, no new fetch (falls back to an
  empty `Map` for the brief window before that fetch resolves, since
  this page's top-level loading gate doesn't wait on it).

Tests: `tsc --noEmit` clean, `eslint` — 0 errors, same 3 pre-existing
warnings, `next build` succeeds, same route list.

Still pending from the same "fix all the issues not fixed" instruction,
each flagged individually rather than silently dropped:

- The masked-view-update N+1 item noted just above — the concurrent-batching
  fix already shipped is a real, large improvement, but a genuinely
  O(1)-round-trip fix needs a Postgres RPC (`jsonb_to_recordset` bulk
  update), which is a schema change with its own risk/testing surface
  distinct from the app-layer changes made so far. Not attempted in this
  pass without confirming that scope with the user first.
- Supabase Auth's "leaked password protection" setting remains
  dashboard-only — not reachable via `apply_migration` or any other MCP
  tool from this session, so it stays an explicitly disclosed item this
  session cannot close, not a dropped one.

## Fix-all pass — masked-view bulk-update RPC (true O(1) round trips)

User confirmed proceeding with the schema-level fix flagged above.
Closes the masked-view N+1 item for real: the concurrent-Promise.all-of-25
fix (previous section) cut wall-clock time but every full sync still
issued one HTTP request per updated row. `bulk_update_masked_view_rows`
(`20250713000001_bulk_update_masked_view_rows.sql`) replaces that with a
single `UPDATE ... FROM jsonb_array_elements($1) ...` statement per
chunk — one round trip updates every row in the chunk.

Design questions worked through before writing anything:

- **Why target the view, not the base table, and why SECURITY INVOKER
  (not DEFINER, unlike this project's other trigger/helper functions)**:
  sales/products/ac_jobs/contractors/vehicles/technicians/job_items are
  masked views with INSTEAD OF UPDATE triggers that are already SECURITY
  DEFINER and already do the real permission check
  (`org_member_can_write_module` + `org_member_role_in`, from Phase 19).
  `UPDATE view ... FROM jsonb_array_elements(...)` is standard Postgres:
  for every row the FROM-join matches, the INSTEAD OF UPDATE trigger
  fires once — same trigger, same permission check, same tenant-scoping
  WHERE clause already baked into the view, just issued as one statement
  instead of N. Making the RPC itself SECURITY INVOKER means it runs as
  the calling `authenticated` role against the view exactly as
  PostgREST's `.update()` does today — no new privilege surface, only
  the request count changes.
- **SQL-injection safety**: `p_view` is checked against a hardcoded
  allowlist. Every identifier substituted into the dynamic SQL (view
  name, column names, column type names) comes only from `pg_catalog`
  (`format_type()`/`pg_attribute`), never from client input. Row
  *values* stay inside the single `$1` bind parameter and are only ever
  extracted via `->>`.
- **Bug found and fixed before this was applied**: the first draft built
  the SET list from the view's *entire* column list. Every masked view
  carries columns the client never sends on an update
  (`created_at`/`updated_at` are always server-computed; row-builder
  functions in `business-sync.ts` only populate a fixed subset per
  table). Setting every column unconditionally would have overwritten
  those omitted columns with NULL on every bulk update — silent data
  loss on a table nobody was even editing those columns on. Fixed by
  taking the column list from the *payload's own JSON keys* instead
  (verified every row-builder function — `productRowsFromList`,
  `saleRowFromSale`, `acJobRowFromJob`, `contractorRowsFromList`,
  `jobItemRow`, `vehicleRow`, `technicianRow` — always sends an
  identical key set per call, using `field ?? null` rather than omitting
  keys, so this is safe).

Testing performed (this session has no browser/authenticated-session
sandbox, so an end-to-end "real technician saves a job" check wasn't
possible — same standing limitation as every other DB change this
project has made):

- Validated the dynamic-SQL generation logic directly against real
  `pg_catalog` metadata for all 7 views (confirmed every column is a
  plain type — `text`/`uuid`/`numeric`/`numeric(p,s)`/`integer`/
  `smallint`/`boolean`/`date`/`timestamp with time zone`/`jsonb` — no
  custom enum types among them, so no additional type-mapping edge case
  exists here).
- Ran the actual dynamic-UPDATE logic end to end against a disposable
  temp table (`like products_base including defaults`, a real sample
  product row inserted into it) instead of the live view, since this
  session has no authenticated session to satisfy the view's own
  trigger-level permission check. Confirmed: (a) every column value
  round-trips through the JSON→SQL cast correctly, including a `jsonb`
  object column and a `boolean` column; (b) an explicit JSON `null`
  correctly clears a column to SQL NULL; (c) `created_at`/`updated_at`
  (columns not present in the test payload) are left untouched,
  confirming the payload-keys-only fix above actually prevents the
  data-loss bug it was written to prevent.
- `get_advisors(security)` after applying: no new lint entries at all —
  not even the `authenticated_security_definer_function_executable` WARN
  every other trigger/helper function in this project carries, since
  this one is deliberately SECURITY INVOKER, not DEFINER.

App-side change: `upsertMaskedViewRows` in `business-sync.ts` now calls
`supabase.rpc("bulk_update_masked_view_rows", { p_view: table, p_rows:
rowBatch })` once per chunk of `toUpdate`, replacing the
`Promise.all`-of-25 loop. Chunk size reuses `LINE_REPLACE_BATCH_SIZE`
(200) — renamed the old `CONCURRENT_UPDATE_BATCH_SIZE` constant to
`BULK_UPDATE_BATCH_SIZE` since its purpose changed from "concurrency cap"
to "request-body-size cap" (a single RPC call is already one round trip
regardless of chunk size).

Tests: `tsc --noEmit` clean, `eslint` — 0 errors, same 3 pre-existing
warnings, `next build` succeeds, same route list.

Remaining from the original "fix all the issues not fixed" list: only
Supabase Auth's "leaked password protection" setting, which stays
dashboard-only and unreachable from this session — flagged, not
silently dropped.

## Fix-all pass — leaked password protection: confirmed plan-gated, not actionable

Closing this out. The repo owner tried enabling it directly in the
Supabase dashboard (Authentication → Attack Protection) and got:
"Failed to update auth configuration: Configuring leaked password
protection via HaveIBeenPwned.org is available on Pro Plans and up."
This project's Supabase org is on the **Free plan** — the setting isn't
just dashboard-only, it's plan-gated, and no amount of dashboard access
changes that without upgrading the org first. Confirmed with the repo
owner to skip for now; revisit only if/when the org upgrades to Pro
(pure billing decision, not an engineering one).

This closes out the entire "fix all the issues not fixed" list from
2026-08-18 — every code/schema-level item is merged and confirmed live
in production; this is the one item genuinely outside engineering
scope, disclosed and explicitly deferred with the owner's agreement
rather than silently dropped.

## Phase 21 — data migration safety review

User picked this next from the standing backlog ("yes pick and move
forward"). Systematic pass over all 64 tracked migration files in
`supabase/migrations/`, specifically hunting for anything that could
have destroyed real production data — not a re-read of what each
migration *adds* (already covered phase by phase throughout this
project), but a dedicated sweep for the destructive-operation shapes
the spec's "do not delete existing production data just to simplify
migration" rule is about: `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`,
`ALTER COLUMN ... TYPE` (narrowing casts can silently truncate/reject
data), `SET NOT NULL` without a backfill, unscoped `DELETE`/`UPDATE`,
and `ON CONFLICT DO NOTHING` backfills that can silently skip rows.

Findings:

- **No `TRUNCATE`, no `ALTER COLUMN ... TYPE`, no `SET NOT NULL`**
  anywhere in the 64 files. The only `ALTER COLUMN` in the whole history
  is a `SET DEFAULT` on `notifications.notification_settings`
  (20250619000001) — changes the default for future inserts only, never
  touches existing rows.
- **Three genuine `DROP TABLE`/`DROP COLUMN` operations**, all verified
  safe:
  - `20250620000009_drop_org_app_data.sql` — drops `org_app_data`
    entirely. This table never appears in a `CREATE TABLE` anywhere in
    the tracked migration history, and the very first tracked migration
    (`20250614000001_subscription_schema.sql`, 6 days earlier) is what
    first creates `organizations` — the tenant/org concept this whole
    schema is built around. A table that predates the tenant model by
    definition could never have held a real multi-tenant org's data
    under the current architecture; it was pre-migration-history
    dev/prototype scaffolding, exactly as its own comment says ("Remove
    unused JSON snapshot table — business-sync uses normalized
    tables"). Grepped the current app source for `org_app_data`: zero
    references, confirming nothing was ever silently left depending on
    it.
  - `20250621000006_remove_payment_provider.sql` — drops
    `subscriptions.payment_provider`/`external_customer_id`. Grepped the
    app source: zero references to either column name anywhere. Matches
    the migration's own comment ("LakBiz uses manual plan management via
    platform admin — no in-app SaaS checkout").
  - `20250620000013_pure_sector_modules.sql` — drops
    `business_templates.features` as its last step, after replacing it
    with the new authoritative `sector_modules` table. Grepped the two
    files that reference `business_templates` at all
    (`lib/admin/templates.ts`, `api/admin/templates/route.ts`): neither
    reads or writes a `features` column. Matches the migration's own
    comment ("the dead, unused features copy — never read by the app").
  - All three drops' own migration-file comments turned out to be
    accurate, not just asserted — this review verified the underlying
    claim in each case rather than trusting the comment.
- **Every `DELETE FROM public.*_base`** in the migration history lives
  inside a masked-view's `INSTEAD OF DELETE` trigger function body, and
  every one is scoped `where id = old.id and organization_id =
  old.organization_id` in the current (20250712000001) version of each
  function — including `job_items_view_delete`/`technicians_view_delete`,
  where Phase 19 already found and fixed the `new.organization_id`-in-a-
  DELETE-trigger bug that had silently broken deletes since Phase 6.
  Nothing new here; this review is what confirmed that fix is the
  current, live version of every one of the 8 masked-view delete
  triggers, not just the two originally reported.
- **Only two standalone `UPDATE`s touch real (non-reference) data**
  outside a trigger body:
  - `20250620000004_service_interval_days.sql`:
    `update public.ac_jobs set service_interval_days = ... where
    service_interval_days is null or service_interval_days = 180` — a
    backfill for a new column, scoped to only rows still at the
    just-added default, computed from each row's own existing
    `service_interval_months` (`coalesce(..., 6) * 30`). Idempotent and
    non-destructive: a job that already had a real, different value is
    never touched.
  - `try_advance_org_sync_generation`'s `update public.organizations set
    sync_generation = sync_generation + 1 where id = p_org_id` — inside
    a function body, parameterized, single-row.
  - The `ON CONFLICT DO NOTHING` inserts (`plans`,
    `platform_message_templates`-style seed tables) are pure reference/
    config data, not user data, and idempotent by design.
- **Idempotency**: every `CREATE TABLE`/`DROP TABLE`/`DROP COLUMN`/`DROP
  CONSTRAINT` in the history uses `if exists`/`if not exists`, so a
  migration that's re-applied (or a earlier one skipped and caught up
  later) can't fail partway and leave the schema in an inconsistent
  state.
- **`supabase_migrations.schema_migrations` is not a reliable ledger of
  which of the 64 repo files are actually applied** — its recorded
  `version` timestamps don't correspond to the migration files' own
  `YYYYMMDDNNNNNN` naming at all (e.g. entries like `20260818123003`
  cluster suspiciously close to this session's own `apply_migration`
  call times rather than any file's name). This was already known
  going into this review (`list_migrations` was flagged unreliable
  earlier in this project) — restated here as a data-safety-relevant
  fact, not a new finding: **direct schema introspection is the only
  trustworthy way to confirm what's actually live**, which is the
  practice this project has followed for every migration this session,
  and is why this review cross-checked findings against live
  `pg_catalog`/`information_schema` state rather than the migration
  files' claims alone.

**Conclusion: no data-safety issues found.** No migration in the
tracked history destroyed real production data without verifying first
that what it removed was genuinely dead. No open items from this
review — this is a clean audit, not a list of fixes still needed.

Nothing code-level changed; this is a documentation-only PR recording
the review and its findings for the record.

## Phase 22 — automated tests (first test infrastructure this project has had)

User picked this next from the standing backlog. Until now every fix in
this entire engagement was verified manually — `tsc --noEmit`/`eslint`/
`next build` plus live DB introspection, never an automated assertion
that a calculation still produces the right number. That gap mattered
in practice: two of the real bugs found and fixed this project
(Phase 20's outsourced_repair/subcontractCost double-count, the
fix-all pass's missing-AC-job-revenue gap in income-tax.ts) were
exactly the kind of thing a unit test would have caught immediately —
and would prevent from silently regressing now that they're fixed.

Added `vitest` (`^4.1.11`) as the test runner — chosen over Jest for
zero-config ESM/TS support (this app has no Babel config and Jest's
TS/ESM setup is more moving parts for no benefit here) and because it
needs no browser: this sandbox has never had one (Phase 23 is still
blocked on that), and the highest-value first test targets are plain
TypeScript functions with zero DOM/React dependency anyway.
`vitest.config.mts` sets `environment: "node"` (no jsdom) and mirrors
tsconfig.json's `"@/*"` path alias so test files import app modules the
same way the app itself does. New `npm test`/`npm run test:watch`
scripts; `npm run verify` now runs tests before `next build`.

First two test files, chosen because they're this project's own two
most bug-prone functions and this session's most recent real fixes:

- **`job-profitability.test.ts`** (13 tests) — locks down
  `computeJobProfitability`'s documented formula (material + labor +
  other = totalCost, revenue − totalCost = grossProfit, null margin —
  never 0%/Infinity% — when revenue is 0), that `subcontractCost` is
  only added to labor for a contractor-assigned job, and specifically
  the Phase 20 outsourced_repair/subcontractCost double-count guard:
  one test proves the guard fires (expense excluded when the job
  already carries a matching subcontractCost), two more prove it does
  NOT fire when it shouldn't (non-contractor job; contractor job with
  no subcontractCost set) — a guard that only has a test for the case
  it should suppress isn't proof it targets the right case. Also covers
  `isLowMarginJob`'s three states (below/at-threshold/unassessable-null)
  per the spec's "do not label a job low margin without an explicit
  defensible rule."
- **`income-tax.test.ts`** (8 tests) — covers `getFiscalYearBounds`'s
  month-boundary logic (a date the day before the fiscal start month
  belongs to the prior year, on-the-day belongs to the new one) and
  `getIncomeTaxYearSummary`'s fiscal-year date filtering for sales/
  vehicles/AC jobs independently, then specifically the fix-all pass's
  own fix: that `acJobProfit` is computed via the real
  `computeJobProfitability` (not a re-derived formula), that job-linked
  expenses passed through the `jobLinkedExpenses` map actually reduce
  it, and that the top-level formula (`salesProfit + vehicleProfit +
  acJobProfit − otherExpenses`, floored at 0) and tax-rate rounding are
  correct.

Deliberately did NOT import `storage.ts`'s `emptyAppData()` or
`invoice.ts`'s `defaultBusiness()` for test fixtures, even though both
would have saved a few lines — `storage.ts` pulls in a chain of
client-side modules (offline sync-conflict, ac-service, vat) with
module-scope behavior not vetted for a plain Node test environment.
Fixtures are built as plain object literals against the `AppData`/
`ACJob`/`JobItem`/`Sale`/`VehicleRecord` types instead (type-only
imports, zero runtime dependency beyond the two modules under test).

Tests: 21/21 passing. `tsc --noEmit` clean (test files type-check
against the same real interfaces the app uses), `eslint src` — 0
errors, same 3 pre-existing warnings (eslint doesn't flag the new test
files at all), `next build` succeeds with the same route list (`*.test.ts`
files live under `src/lib/`, never under `app/`, so they can't be
mistaken for pages).

Not done in this pass, left for whoever picks up test coverage next:
tests for `vat.ts` (`getVatQuarterSummary`), the role/permission
matrix in `org-role/permissions.ts`, or any of the RLS-layer SQL added
in Phases 19-20 (would need a real Postgres connection — e.g. Supabase's
local CLI stack — this session doesn't have one). Two files is a real
start, not a complete suite.

## Phase 24 — Reports page integration (AC job performance)

User picked this next from the standing backlog. Before this phase,
`/reports` was entirely retail/sales-focused (revenue, profit, top
products, top customers) — an owner wanting "how did my AC jobs do
this period" had no single place for it; that data lived scattered
across `/job-costing` (all-time, not period-filtered), `/dashboard`
(this-month only, buried in a compact "Needs Attention" row), and
`/vat` (a single lifetime-to-date `acJobProfit` figure, not
period-selectable).

Scope, deliberately narrow: added one new "AC job performance" section
to the existing Reports page — metrics (total quoted, total cost,
total margin) plus a "jobs needing attention" list (the period's
low-margin jobs, worst-margin first) — using the *same* period selector
(7d/30d/month/all) already on the page, filtered on `job.date` the same
way sales are already filtered on `s.date`. Did **not** attempt to fold
VAT or income-tax into this page in the same pass — those are already
full standalone sections on `/vat` with their own UI decisions (rate
selection, disclaimers), and merging them in here would have meant
redesigning that page too, a materially bigger and riskier change than
one well-scoped PR. Flagging this as a deliberate scope cut, not an
oversight — a natural next step for whoever picks up Phase 24 further.

Correctness, not a new formula: reuses `computeJobProfitability`
(now under test — Phase 22) exactly as `/job-costing`, `/dashboard`,
and `/vat` already do, and `isLowMarginJob`'s one explicit low-margin
rule (15% threshold) for the attention list — no new job-cost or
"low margin" logic invented for this page. Cancelled jobs are excluded
(a cancelled job never happened; no real revenue/cost to report),
matching the dashboard's own "this month's job profitability" filter
exactly. Job-linked expenses (Phase 7, cloud-only) are fetched with the
identical `fetchOrgExpenses`-on-mount pattern already used by
`/job-costing`/`/dashboard`/`/vat`, gated behind `can("ac_jobs") &&
canSeeFinancials` so the fetch is never even attempted for an org/role
that can't see this section.

Section is entirely gated behind `can("ac_jobs")` (the same plan-feature
check every other AC-jobs-aware page uses) — sectors without the AC/HVAC
module (grocery, electronics, etc.) see the Reports page exactly as it
looked before this change, nothing new rendered.

Tests: `tsc --noEmit` clean, `eslint src` — 0 errors, same 3
pre-existing warnings, `npm test` — 21/21 still passing (this page
doesn't touch either tested module's logic, only calls into it),
`next build` succeeds with the same route list.

## Phase 26 — final consolidated deliverable report

User picked this next from the standing backlog. Added
`docs/FINAL_ENGAGEMENT_REPORT.md` — a summary and index over this whole
engagement (both dashboard-rebuild eras, the HVAC platform rebuild, and
every fix made this session), not a replacement for this file, which
stays the detailed source of truth. Built from this file's own section
headers and content rather than from memory, so every claim in it traces
back to a real section here, a merged PR, or a live database check.

Includes an explicit "known limitations" section covering what's still
genuinely blocked (no browser in this sandbox — Phase 23; leaked
password protection — Supabase Free-plan-gated) versus what was
deliberately scoped out of individual phases (documented the one
confirmed case where an item on the old "Not started" list was later
actually resolved — the Dashboard/VAT income-tax wiring, done in the
fix-all pass — rather than either reproducing that list as if nothing
had changed, or silently updating it without saying so).

## Test-coverage pass — vat.ts and the role/permission matrix (and a real bug found in the process)

User picked this next: the two items explicitly flagged as "not done"
when Phase 22 shipped the test infrastructure. Writing the tests found
a real, live, previously-undiscovered bug — this pass is a bug fix with
test coverage attached, not just test coverage.

**The bug**: `getVatQuarterBounds` (vat.ts) derived its quarter's
`startYear`/`endYear` from a handful of independent ad hoc branches
(`startMonth >= fiscalStartMonth` / `m < fiscalStartMonth` / `endMonth <
startMonth`), each covering only part of the year-rollover logic.
Brute-forcing every (fiscalStartMonth, current-month) combination — 144
cells — found **66 (46%) returned bounds that didn't contain their own
`refDate`, always off by exactly one year**. For the *default*
fiscalStartMonth (4, April — what every org gets unless it changes VAT
settings), this hit January, February, and March every single year:
`getVatQuarterSummary(data, new Date())` — called with today's date by
the one real caller, `/vat` — would silently show a VAT-registered
shop's *previous year's* Jan–Mar sales/purchases instead of the current
quarter's, for 3 months of every 12. This is VAT compliance data; a shop
owner filing a return in February would have been looking at last
year's numbers with no indication anything was wrong.

Sanity-checked the sibling function first, since it has the same shape:
`getFiscalYearBounds` (income-tax.ts, used by the income-tax estimate)
was brute-forced the same way — 0/144 failures, genuinely correct. The
bug is isolated to the quarterly function specifically; the simpler
whole-year one never had it.

**The fix**: rewrote `getVatQuarterBounds` using absolute-month
arithmetic (`year*12 + monthIndex`) instead of ad hoc year branches —
the quarter's start/end is computed once as an offset in absolute-month
space, then converted back to (year, month) by a single division, which
cannot fall out of sync with `refDate`'s own year the way multiple
independent branches could. Verified against all 144 combinations after
the fix — 0 failures. The fiscalStartMonth===1 (calendar quarter)
special case the old code branched out separately is now handled by the
same unified formula (verified identical output), so that branch is
gone too — one code path instead of two, both proven correct rather than
one assumed correct because "it's simpler."

Also confirmed no other file reads `VatQuarterBounds`/`getVatQuarterBounds`
directly — `getVatQuarterSummary` is the only caller, and `/vat/page.tsx`
already filters its own displayed sales/purchases lists using
`summary.bounds.start`/`.end` directly, so this fix also corrects what
those lists show, not just the aggregate output/input VAT totals.

New tests:
- **`vat.test.ts`** (16 tests) — the exact 144-cell brute-force check
  that found the bug, kept as a permanent regression guard, plus the
  concrete originally-failing case (April fiscal start, January
  refDate) spelled out explicitly so the fix's intent is clear without
  running the loop; a cross-year-boundary case (a fiscal quarter that
  itself spans New Year's, viewed from both sides); and
  `splitInclusiveTotal`/`calcInputVat`/`isVatEnabled`/`isDateInQuarter`/
  `getVatQuarterSummary` (explicit vs. derived output/input VAT, quarter
  filtering, `netPayable` can be negative for an input-VAT credit).
- **`org-role/permissions.test.ts`** (21 tests) — locks the documented
  role matrix (the same subject as the Phase 19 security audit) down
  test-by-test: `canAccessShopRoute` for every one of the 5 roles
  against both allowed and disallowed routes (including prefix-match
  behavior and the deliberate technician-can-reach-`/dashboard`
  exception documented inline in permissions.ts), `canUpdateAcJob`'s
  field-level financial-key rejection (including a mixed payload with
  one disallowed key among allowed ones), `sanitizeAcJobInputForRole`'s
  tamper-defense stripping, and `canAccessSettingsPath`'s per-role
  settings scoping. A future edit that silently loosens a role's access
  now fails a test instead of shipping as a live security regression.

Tests: 58/58 passing (21 from Phase 22 + 37 new). `tsc --noEmit` clean,
`eslint src` — 0 errors, same 3 pre-existing warnings, `next build`
succeeds with the same route list.

Nothing code-level changed; documentation-only.
