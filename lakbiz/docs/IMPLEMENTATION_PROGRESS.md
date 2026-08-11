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

## Not started

Phases 3–18 (inventory UX, HVAC asset management, service jobs, field
teams, scheduling, job costing, invoicing, dashboard rebuild, expenses,
workforce/roles, messaging integration, reporting, mobile field UX,
performance/a11y, final security audit, final QA).

## Next exact tasks

1. Push `claude/lakbiz-phase2-customer-crm`, open a draft PR based on
   `claude/lakbiz-phase1-design-shell` (stacked — merge #24 and #25 first).
2. **Get a real visual/click-through pass on the Phase 2 preview** — this is
   the first phase where "does it compile" and "does it work" have
   meaningfully diverged; see remaining risk #1 above.
3. Begin Phase 3 (Inventory / Add Stock UX — the same
   below-the-fold-form problem, on the Stock page) as its own branch/PR once
   Phase 2 is reviewed.
