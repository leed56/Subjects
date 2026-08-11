# Security incident — cross-tenant data leak via masked views

**Date found & fixed:** 2026-08-11
**Severity:** Critical
**Status:** Fixed and verified in production. This document is the record.

## What happened

`public.sales`, `public.sale_lines`, `public.products`, `public.ac_jobs`,
`public.contractors`, and `public.vehicles` — the views the entire app reads
through for financial-data masking (hiding cost/profit/buy price from
non-owner/manager roles) — were configured `security_invoker=false`. In
Postgres, that means the view executes with the *view owner's* privileges
rather than the querying user's, which bypasses row level security on the
underlying tables entirely.

The column-level masking (`CASE WHEN can_see_org_financials(organization_id)
THEN <real value> ELSE 0/NULL END`) still worked correctly — a cashier still
couldn't see profit or buy price. But **nothing filtered rows by
organization**. Any authenticated LakBiz user, in any shop, on any role,
could read every other shop's customer names, phone numbers, addresses, job
details, and sales records through these six views.

Migration history shows this was already suspected and worked on twice
(`20250623000003_fix_financial_view_security.sql`,
`20250627000001_fix_ac_workforce_view_security_invoker.sql`) — evidently the
fix didn't cover all six views, or was reverted by a later change. This
migration is a complete pass across every affected view, verified
individually.

## How it was found

While preparing a Supabase security-advisor pass, the linter flagged 6
`security_definer_view` errors. Rather than trust the linter description
alone, the finding was verified empirically against production:

1. Queried the underlying `ac_jobs_base` table directly, simulating an
   authenticated user (Org "IMT Eng") who has zero AC jobs of their own →
   correctly got `permission denied` (RLS on the base table works).
2. Queried `public.ac_jobs` (the view) as the *same* user →
   **got back all 8 AC job records belonging to a different organization**
   ("IMT"), including real customer names, phones, and job details.

This confirmed the leak was real and currently exploitable, not a
false-positive linter warning.

## The fix — first attempt, and a regression it introduced

The first fix (`supabase/migrations/20250628000002_fix_masked_view_cross_tenant_leak.sql`)
had two parts:

1. `grant select on <table>_base to authenticated;` for all six base
   tables — previously only the definer-mode view could read them at all,
   so flipping `security_invoker` without this would have broken every
   affected page for everyone.
2. `alter view <view> set (security_invoker = true);` — makes the view
   execute with the querying user's privileges, so the RLS policies on the
   base tables apply to the querying user.

This closed the cross-tenant row leak (verified empirically — see below),
but **review on PR #27 caught a regression it introduced**: granting
`SELECT` on the `*_base` tables to `authenticated` meant any authenticated
client could bypass the views' column masking entirely by querying
`products_base` (etc.) directly instead of `products` — the RLS on the base
tables only checks organization membership, not the owner/manager
financial-visibility check the view's `CASE` expressions enforce. That
would have exposed `buy_price`, `profit`, `subcontract_cost`, contractor
rates, and vehicle costs to cashier/technician/data_entry roles — a
different, narrower leak than the one just closed, of the exact kind
`20250623000003_fix_financial_view_security.sql` had deliberately prevented
by revoking that same access.

## The corrected fix

`supabase/migrations/20250628000003_fix_masked_view_grant_regression.sql`:

1. **Revoke** the base-table `SELECT` grants again (restores the
   pre-existing, intentional lockdown).
2. Revert all six views to `security_invoker = false`.
3. Add the missing tenant filter **directly inside each view's own WHERE
   clause** — `organization_id in (select organization_id from org_members
   where user_id = auth.uid())`, the same check the RLS policies use. Since
   the view runs as its owner and never grants the querying role direct
   base-table access, it has to do its own row filtering — this is that
   filtering.

This closes the cross-tenant leak without ever exposing the base tables to
authenticated clients directly.

## Verification

Re-ran the same empirical test after the **corrected** fix:

- Org "IMT Eng" user querying `public.ac_jobs`, `products`, `sales`,
  `sale_lines`, `contractors`, `vehicles` → **0 rows on all six** (was 8
  leaked rows on `ac_jobs` before either fix).
- Same user querying `public.products_base` directly → **`permission
  denied`** again, confirming the column-masking-bypass hole from the first
  attempt is closed.
- The legitimate owner of org "IMT" querying their own `ac_jobs` → still
  correctly returns their 8 rows.
- Supabase security advisor: the 6 `security_definer_view` findings
  **reappear** at ERROR level after the corrected fix — expected, not a
  leftover bug. That check is a blanket `security_invoker=false` heuristic;
  it has no way to know the view implements its own correct row filter.
  The empirical tests above, not the linter, are the real verification
  here. Critical findings: 1 (`schema_migrations` RLS, unrelated,
  separately flagged).

## Remaining related item (not part of this fix)

`public.schema_migrations` has RLS disabled, exposing migration filenames
(not sensitive data, but still a real gap) to the anon key. Flagged
separately — see `docs/ARCHITECTURE_AUDIT.md` — pending the repo owner's
decision on policy shape before it's applied.
