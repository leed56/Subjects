# LakBiz Route Inventory — Global Premium UI Phase

Captured **before** any change in this phase, from the actual `src/app`
route tree (not from memory or an old doc) — the baseline this phase's
"zero unintentionally removed or renamed routes" acceptance criterion is
checked against. Re-run the same `find`/`grep` commands after implementation
and diff against this table; any route present here and missing after, or
vice versa without a documented reason, is a regression.

Captured via:
```
find src/app -maxdepth 6 \( -name "page.tsx" -o -name "route.ts" -o -name "layout.tsx" \)
```
against commit `7d66103` (branch `claude/job-parts-materials`, PR #78 — see
"Branch strategy" note at the bottom).

## 1. Public / marketing routes

| Route | File | Notes |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing page. Redesigned in Stage 6 (Part 21-26). Route path unchanged. |
| `/sectors` | `src/app/sectors/page.tsx` | Public sector-selection page, linked from landing. |
| `/sectors/[id]` | `src/app/sectors/[id]/page.tsx` | Dynamic — one page per `SectorId` (grocery, electronics, electricals, ac_hvac, etc). Reached from `/sectors` and directly from marketing links; must keep working for every existing sector slug. |
| `/login` | `src/app/login/page.tsx` | Signin/signup, admin login (`?next=/admin`), and the "already signed in" state (Stage 5 fix target — see Part 19/35). |

## 2. Authenticated shop routes

| Route | File | Nav section | Minimum role (from `permissions.ts`) |
|---|---|---|---|
| `/dashboard` | `src/app/dashboard/page.tsx` | Overview | all roles |
| `/sales` | `src/app/sales/page.tsx` | Sales | owner/manager/data_entry/cashier |
| `/bills` | `src/app/bills/page.tsx` | Sales | owner/manager/data_entry/cashier |
| `/bills/[id]` | `src/app/bills/[id]/page.tsx` | — (deep link, no nav entry) | same as `/bills` |
| `/customers` | `src/app/customers/page.tsx` | Sales | owner/manager/data_entry/cashier |
| `/stock` | `src/app/stock/page.tsx` | Inventory | owner/manager/data_entry/cashier |
| `/suppliers` | `src/app/suppliers/page.tsx` | Inventory | owner/manager |
| `/jobs` | `src/app/jobs/page.tsx` | Service | owner/manager/data_entry*/technician* |
| `/jobs/[id]/invoice` | `src/app/jobs/[id]/invoice/page.tsx` | — (deep link from Job Sheet, no nav entry) | inherits `/jobs` (prefix match) |
| `/schedule` | `src/app/schedule/page.tsx` | Service | owner/manager/data_entry/technician |
| `/assets` | `src/app/assets/page.tsx` | Service | owner/manager/data_entry/technician |
| `/workforce` | `src/app/workforce/page.tsx` | Service | owner/manager/technician |
| `/teams` | `src/app/teams/page.tsx` | Service (Field Teams) | owner/manager/technician |
| `/banking` | `src/app/banking/page.tsx` | Finance | owner/manager |
| `/vat` | `src/app/vat/page.tsx` | Finance | owner/manager |
| `/expenses` | `src/app/expenses/page.tsx` | Finance | owner/manager |
| `/job-costing` | `src/app/job-costing/page.tsx` | Finance | owner/manager |
| `/reports` | `src/app/reports/page.tsx` | Finance | owner/manager |
| `/vehicles` | `src/app/vehicles/page.tsx` | (sector-gated, not in the 6-section nav map above) | owner/manager |
| `/settings/team` | `src/app/settings/team/page.tsx` | Management | owner (invite/role-change), owner+manager (view) |
| `/settings/plans` | `src/app/settings/plans/page.tsx` | Management | owner/manager |
| `/settings/shop` | `src/app/settings/shop/page.tsx` | Management | owner/manager |
| `/settings/notifications` | `src/app/settings/notifications/page.tsx` | Management (reached via Shop Settings) | owner/manager |
| `/settings/billing` | `src/app/settings/billing/page.tsx` | Management (reached via Plans) | owner/manager |

`*` — `/jobs` access nuance preserved from `permissions.ts`'s own comment:
data_entry is front-desk job intake (create/edit jobs, quotes, alerts; no
margin/subcontract/buy cost); technician sees jobs assigned to them plus
equipment records, no financial fields. Both are real, different views of
the same route, not two routes — nothing in this phase may collapse that
distinction into a single generic "read-only" mode.

## 3. Platform admin routes

| Route | File | Notes |
|---|---|---|
| `/admin` | `src/app/admin/page.tsx` (+ `admin/layout.tsx`) | Platform-admin dashboard. Separate auth check (`isPlatformAdminClient`), not an org role. |
| `/admin/messaging` | `src/app/admin/messaging/page.tsx` | |
| `/admin/shops` | `src/app/admin/shops/page.tsx` | |
| `/admin/shops/new` | `src/app/admin/shops/new/page.tsx` | |

## 4. API routes

| Route | File | Notes |
|---|---|---|
| `/api/admin/me` | `src/app/api/admin/me/route.ts` | |
| `/api/admin/messaging` | `src/app/api/admin/messaging/route.ts` | |
| `/api/admin/shops` | `src/app/api/admin/shops/route.ts` | |
| `/api/admin/shops/[id]` | `src/app/api/admin/shops/[id]/route.ts` | |
| `/api/admin/templates` | `src/app/api/admin/templates/route.ts` | |
| `/api/cron/service-due-reminders` | `src/app/api/cron/service-due-reminders/route.ts` | Scheduled (Vercel cron), not user-navigated. |
| `/api/cron/subscription-renewal-reminders` | `src/app/api/cron/subscription-renewal-reminders/route.ts` | Scheduled. |
| `/api/messages/send` | `src/app/api/messages/send/route.ts` | |
| `/api/messages/status` | `src/app/api/messages/status/route.ts` | |
| `/api/settings/notifications` | `src/app/api/settings/notifications/route.ts` | |
| `/api/settings/team` | `src/app/api/settings/team/route.ts` | |

This phase is a UI/visual pass — **no API route's request/response contract
changes**. They're listed here for completeness of the inventory, not
because any are expected to move.

## 5. Query-param workflows

Only one, found by inspection (no page uses Next's `useSearchParams` hook —
`window.location.search` is parsed manually instead):

- **`/login?next=<path>`** — `login/page.tsx` reads `next` via
  `new URLSearchParams(window.location.search)`, two places: (a) on mount,
  to detect `next=/admin` and switch into the admin-login visual mode; (b)
  in `safeNextPath()`, to redirect there after a successful non-admin
  sign-in — guarded against open-redirect (`next` must start with `/` and
  not `//`). Referenced from `settings/team`-adjacent admin links and from
  the middleware's auth-gate redirect. **Must keep working exactly as-is**
  — this is the one auth-adjacent workflow Stage 5's login redesign touches
  directly, so it's the highest-risk route for a regression this phase.

## 6. Supabase auth/callback routes

No `/auth/callback` (or equivalent) page exists under `src/app` — auth is
handled client-side via `@supabase/ssr`'s browser client
(`src/lib/supabase/client.ts`) and `AuthProvider`
(`src/components/auth-provider.tsx`), not a server-side OAuth callback
route. Confirmed by the `find` above returning no `auth/` directory.
Nothing to inventory here beyond noting its absence is expected, not a gap
this phase introduces.

## 7. Total route count

- 4 public/marketing pages
- 23 authenticated shop pages
- 4 platform-admin pages
- 10 API routes
- **41 total page/API routes**, matching `npm run build`'s route table as
  of commit `7d66103` (verified again after each implementation stage —
  see the build-result section of this phase's progress notes).

## Branch strategy for this phase

PR #78 (`claude/job-parts-materials`, the HVAC job-parts/materials phase)
is **open and unmerged** as of this inventory (confirmed via the GitHub API
immediately before writing this doc — `merged: false`, `draft: true`,
`base: main@4c5bea6`, `head: 7d66103`). This phase's own brief (Part 11-16)
explicitly redesigns AC Jobs, the Job Detail drawer, and the Parts &
Materials UI — the exact same files PR #78 built. Branching from `main`
now would mean either losing Phase B's unmerged work when this branch
eventually lands, or a large, error-prone manual re-merge later.

**Decision: Option B — stack this branch on PR #78's head.**
`claude/global-premium-ui` was created from `claude/job-parts-materials` at
commit `7d66103`, not from `main`. This branch will carry Phase B's commits
in its history until #78 merges; once it does, this branch's diff against
`main` will show only this phase's own changes (the same stacking
convention already used for Phases 6-12 in `docs/IMPLEMENTATION_PROGRESS.md`
before their base PRs merged). Documented here per Part 46's explicit
instruction not to silently lose Phase B.
