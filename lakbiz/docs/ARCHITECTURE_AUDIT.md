# LakBiz Architecture Audit — Phase 0

Date: 2026-08-11
Scope: `leed56/Subjects`, app at `lakbiz/app` (Next.js 16 / React 19), schema at
`lakbiz/supabase/migrations` (62 migrations as of this audit).

**Session constraint that shapes this document:** this audit was written
without a live connection to the production Supabase project
(`ftlrhkuygxrwdegkcmhf`) — no MCP connector, no `SUPABASE_DB_PASSWORD`, no
service-role key were available in this session. Every finding below is
grounded in the committed migrations and application code, not in a live
query against production. Where a claim needs runtime confirmation, that is
called out explicitly rather than assumed.

---

## 1. Current architecture

- **Framework:** Next.js 16.2.9 App Router, React 19, TypeScript, Tailwind 4.
  Deployed to Vercel (project `subjects`, branded `LakBiz`, live at
  `subjects-ten.vercel.app`).
- **Auth/data:** Supabase (Postgres + Auth + RLS). Client access goes through
  `@supabase/ssr` (`src/lib/supabase/{client,server,middleware}.ts`) using
  cookie-based sessions; there is a separate `createAdminSupabaseClient()`
  (`src/lib/supabase/admin.ts`) that only constructs a service-role client
  when `SUPABASE_SERVICE_ROLE_KEY` is set server-side, and returns `null`
  otherwise. No client component or bundle references the service-role key.
- **Routing/pages:** one Next.js app served at the domain root — no separate
  marketing subdomain. `src/app/` holds shop pages (`dashboard`, `sales`,
  `customers`, `stock`, `suppliers`, `jobs`, `workforce`, `vehicles`, `bills`,
  `banking`, `vat`, `settings/*`) plus a fully separate `admin/` tree for
  platform administration, and `api/` routes for admin actions, cron, and
  messaging.
- **PWA:** `public/sw.js` service worker + `manifest.ts`, registered client-side
  only in production (`service-worker-register.tsx`).
- **Ops scripts:** `scripts/*.mjs` — direct `pg` connections (using
  `SUPABASE_DB_PASSWORD`) and Supabase-JS sessions for admin tasks
  (promote/demote platform admins, apply migrations, QA). Notably
  `scripts/qa-production-roles.mjs` already exists and signs into two real
  test accounts to verify financial-data masking against production — this is
  a real, working QA harness, not a stub.

## 2. Database model (from migrations)

Core tenant tables, all with `organization_id uuid not null references
organizations(id)`: `organizations`, `org_members`, `subscriptions`,
`subscription_addons`, `plans`, `products`, `customers`, `suppliers`, `sales`,
`sale_lines`, `purchases`, `purchase_lines`, `customer_payments`,
`supplier_payments`, `stock_logs`, `bank_accounts`, `cheques`, `ac_jobs`,
`vehicles`, `contractor_payments`, `notification_log`, plus workforce/team
tables added in the `20250621*` migrations (`banking_ledger`, `workforce`,
`job_assignee`, `contractor_payments`, `job_items`).

Migration history shows active, iterative hardening rather than a one-shot
design: `rls_hardening`, `repair_org_policies`, `fix_is_org_member`,
`financial_data_rls`, `fix_financial_view_security`,
`sync_generation_and_rls_hardening`, `masked_view_triggers_security_definer`,
`ac_workforce_financial_masking`, `fix_ac_workforce_view_security_invoker`.
This is a codebase that has already found and fixed several of the exact bug
classes this Phase 0 spec asks to check for — see §4 for what's confirmed
still open.

## 3. Auth model

- Supabase Auth, email + password (not phone OTP — the in-app copy in one
  script still says "phone OTP scaffold," that's stale relative to actual
  behavior; `/login` is email+password).
- Session handled via `src/lib/supabase/middleware.ts` `updateSession()`,
  invoked from `src/proxy.ts` (Next's middleware entry point) on every
  request except static assets.
- **Role enforcement already happens in two layers**, not just the UI:
  1. **Server-side, authoritative:** `proxy.ts` → `updateSession()` fetches
     the caller's `org_members.role`, and for any path under
     `GUARDED_SHOP_PREFIXES` or `/settings`, calls
     `canAccessShopRoute`/`canAccessSettingsPath`
     (`src/lib/org-role/permissions.ts`) and redirects to `/dashboard` if
     denied — this runs before the page renders.
  2. **Client-side, UX only:** `ShopRouteGuard` component does the same
     check again client-side (via `useSubscription()`) purely to avoid a
     flash of disallowed content; it is not a security boundary, and
     correctly isn't relied on as one since the middleware already redirects
     server-side.
- Platform admin is a fully separate check (`requirePlatformAdmin()` in
  `src/lib/admin/auth.ts`), backed by a distinct `platform_admins` table keyed
  by `user_id`, unrelated to `org_members`/business roles. `admin/layout.tsx`
  and every `api/admin/*` route call this before doing anything.

## 4. Role model

Business roles already implemented (not just planned):
`owner`, `manager`, `data_entry`, `cashier`, `technician`
(`src/lib/subscription/types.ts` `OrgRole`, matrix documented at the top of
`src/lib/org-role/permissions.ts`). This is close to, but not identical to,
the target spec's `owner / manager / accountant / sales / cashier /
technician / data_entry` — **no `accountant` or `sales` role exists yet.**
Recommendation for Phase 12: add these as additive enum values, decide their
route/financial-visibility matrix by extending the existing table in
`permissions.ts` rather than restructuring it — the existing shape
(`FINANCIAL_ROLES`, per-route allow-lists, `canSee*`/`canUse*` predicate
functions) already generalizes cleanly to more roles.

Financial-data masking (buy price, profit, subcontract cost, contractor
payables) is implemented via **Postgres views**, not just app-layer
filtering — e.g. `products`/`sales`/`ac_jobs` are exposed as masked views to
non-financial roles per the `financial_data_rls` and
`ac_workforce_financial_masking` migrations, with `security invoker` fixed in
the most recent migration in the chain. `scripts/qa-production-roles.mjs`
asserts this against production for `owner` vs `data_entry`. **Not yet
independently re-verified in this session** (no DB connection) — recommend
re-running that script before/after any Phase 8+ work that touches job
costing, since that's exactly the kind of table this masking pattern needs to
extend to.

## 5. Tenant model — multi-org membership question (Phase 0 item 7)

**Confirmed:** `org_members` has `unique (organization_id, user_id)` only —
it does **not** prevent one user from belonging to more than one
organization. Every read path assumes single membership anyway:

- `src/lib/supabase/middleware.ts` `fetchOrgRole()` — `.eq("user_id",
  userId).maybeSingle()`
- `src/lib/org-role/require-org-role.ts` `getOrgMemberContext()` — same
  pattern
- `src/lib/admin/provision-shop.ts` / `bootstrap_user_organization()` SQL
  function — `where user_id = v_uid limit 1`
- `scripts/qa-production-roles.mjs` — same `.maybeSingle()` pattern

**Decision: Option A (single organization per user)** — this is unambiguously
the existing product model; there is no organization switcher anywhere in the
UI, and `.maybeSingle()` would throw a Postgrest "multiple rows" error the
moment a user acquired a second membership, breaking their session outright.
This audit implements that decision at the schema level: see
`supabase/migrations/20250628000001_org_members_single_membership.sql`, which
adds `unique (user_id)`. **This migration has NOT been applied** — it
self-checks for existing duplicate memberships and raises a clear exception
if any exist rather than failing on the raw constraint violation, but running
that check requires DB access this session does not have. Run the check
query in the migration's header comment against production before applying
it.

If a genuine multi-org need shows up later (e.g. a bookkeeper serving several
shops), that is a deliberate, larger feature (Option B, an org switcher) and
should not be backed into by leaving the schema unconstrained.

## 6. Service worker — confirmed vulnerability, fixed in this PR

**Confirmed as described in the task spec.** The previous `public/sw.js`:

- Cached every same-origin document/navigate GET response (`networkFirstPage`
  → `PAGE_CACHE`) for *any* path, including `/dashboard`, `/sales`,
  `/customers`, etc. — pages that render tenant-specific data server-side.
- Listed `/dashboard` and `/sales` in `OFFLINE_FALLBACKS`, so a stale, cached
  copy of a *previous* signed-in user's dashboard/sales HTML could be served
  from the shared cache when a *different* user opened the PWA offline on the
  same device (shared shop tablet/PC is an explicit, realistic scenario for
  this product).

**Fix applied:** the SW now only ever caches/replays document responses for
an explicit `PUBLIC_DOCUMENT_ALLOWLIST` (`/`, `/login` — pages that render
identically for everyone, no auth cookie dependence). Every other
document/navigate request is network-only: fetched fresh every time, never
read from or written to any cache, and on failure returns a generic
text/plain offline message instead of any cached page. `/api/*` and Supabase
requests were already correctly bypassed before this change. Cache version
bumped (`lakbiz-v3` → `lakbiz-v4`) so the `activate` handler evicts any
previously-cached authenticated pages on next visit for existing installed
PWA users.

## 7. Security headers (added this PR)

`next.config.ts` now sets, on every route: `Content-Security-Policy`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo
denied — nothing in the app currently uses them), `X-Frame-Options: DENY`,
plus `frame-ancestors 'none'` in the CSP.

**CSP tradeoff, stated plainly:** `script-src`/`style-src` include
`'unsafe-inline'` rather than a nonce-based policy. Next.js's hydration
bootstrap script and Tailwind's injected `<style>` tags are inline; a
nonce-based CSP needs a per-request nonce threaded through `proxy.ts` into
every rendered `<script>`/`<style>` tag, and a mistake there fails *closed*
(blank white page in production) rather than open. This session has no way
to render-test that against a live deploy with real env vars, so shipping an
unverified nonce CSP was judged higher-risk than the marginal XSS hardening
it buys given there's already no third-party/inline analytics script in this
app. **Recommended follow-up, not done here:** move to a nonce-based CSP,
verified with a real preview deployment before merging.

`img-src`/`connect-src` allow `https://*.supabase.co` (and `wss://` for
connect-src, for Realtime if it's ever used) for Storage-hosted images and
API calls. If a CDN or analytics provider is added later, this policy will
need a matching update — it will fail closed (broken images/requests) if
forgotten, which is a good property for noticing.

## 8. Cron & admin API authorization

Spot-checked `api/cron/service-due-reminders/route.ts`: `GET` (the actual
Vercel Cron entry point) requires `Authorization: Bearer $CRON_SECRET` and
503s if `CRON_SECRET` isn't configured — correct fail-closed behavior. The
same route's `POST` (manual "send now" from settings) requires a signed-in
session and `owner`/`manager` role, scoped to that caller's own
`organization_id` — not caller-supplied. `api/admin/*` routes are gated by
`requirePlatformAdmin()`. Did not exhaustively re-audit every route in this
pass; recommend a full route-by-route pass in Phase 17 (Final Security
Audit) as the spec already schedules.

## 9. UX issue — confirmed, not yet fixed

**Confirmed:** `src/app/customers/page.tsx` renders its create/edit form
inline at line 303 of a 1023-line page, after the metrics and table — exactly
the "form appears below the fold" problem described. `stock/page.tsx` (707
lines) has the equivalent pattern for Add Stock. This audit does **not** fix
the UX layer (Phases 1–3 of the spec); it only establishes the security/
architecture baseline those phases will build on.

## 10. Dependency security (found and fixed this PR)

`npm audit` on the pre-existing lockfile showed **4 high-severity CVEs in
Next.js 16.2.9 itself**, most notably *"Middleware / Proxy bypass in App
Router applications using Turbopack and single locale"* — directly relevant
here since `proxy.ts` is the file enforcing server-side role gating (§3).
Bumped to `next@16.3.0` (patch release, no breaking API change for this
app's usage) and ran `npm audit fix` for the remaining dev-tooling
advisories (`brace-expansion`, `js-yaml`, transitive `postcss` via the
Tailwind PostCSS plugin). `npm audit` now reports zero vulnerabilities.
`tsc --noEmit` passes clean both before and after this change (verified).

## 11. Major risks carried forward (not fixed in this PR)

1. **No live RLS verification performed.** `scripts/qa-tenant-isolation.mjs`
   (added this PR) codifies the exact checks Phase 0 item 6 asks for —
   Org A cannot SELECT/INSERT/UPDATE/DELETE Org B's customers, sales,
   ac_jobs, products, suppliers, bank_accounts, contractor_payments, cheques
   — but it has **not been run**. It needs two real test-org credentials
   (`ORG_A_EMAIL`/`ORG_A_PASSWORD`/`ORG_B_EMAIL`/`ORG_B_PASSWORD`) that this
   session doesn't have and shouldn't fabricate. Run it against a disposable
   Supabase branch or two throwaway trial signups before trusting this as a
   pass — the loop-generated policies in `rls_hardening.sql` look correct by
   inspection, but "looks correct by inspection" is not the bar the spec
   set, and shouldn't be reported as verified until it actually runs.
2. **`org_members_user_id_key` migration not applied** (§5) — needs the
   duplicate-check run against production first.
3. **CSP ships without a live render-test** (§7) — recommend a preview-deploy
   smoke test (load every major route, confirm no console CSP violations)
   before this reaches production traffic.
4. Everything in Phases 1–18 of the product spec is, by definition, not yet
   started. This document and this PR are Phase 0 only.

## 12. Recommended target architecture (unchanged from current, mostly)

The existing architecture is sound and should not be rewritten:
Next.js App Router + Supabase Auth/RLS + server-side role gating in
middleware + a service-role client confined to server-only code paths +
Postgres views for column-level financial masking. The product-spec's
19 phases are additive feature/UX work on top of this foundation, not a
replacement for it. The one structural change this audit recommends beyond
what's listed above: as new tenant tables are added in later phases
(AC assets, service teams, job cost items, invoice settings), follow the
exact pattern already established in `rls_hardening.sql` §4 immediately —
`organization_id in (select organization_id from org_members where user_id =
auth.uid())` for select/insert/update/delete — rather than inventing a new
policy shape per table.
