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

## The fix

Two parts, applied together (see
`supabase/migrations/20250628000002_fix_masked_view_cross_tenant_leak.sql`):

1. `grant select on <table>_base to authenticated;` for all six base
   tables — previously only the definer-mode view could read them at all,
   so simply flipping `security_invoker` without this would have broken
   every affected page (Sales, Stock, AC Jobs, Contractors, Vehicles) for
   everyone.
2. `alter view <view> set (security_invoker = true);` for all six views —
   makes the view execute with the querying user's privileges, so the
   existing, correctly-written RLS policies on the base tables (`organization_id
   in (select organization_id from org_members where user_id = auth.uid())`)
   now actually apply.

## Verification

Re-ran the same empirical test after the fix:

- Org "IMT Eng" user querying `public.ac_jobs` → **0 rows** (was 8 rows
  belonging to a different org before the fix).
- Same test repeated against `products`, `sales`, `sale_lines`,
  `contractors`, `vehicles` → **0 rows each**, confirming the leak is closed
  across all six views, not just the one initially tested.
- The legitimate owner of org "IMT" querying their own `ac_jobs` →
  still correctly returns their 8 rows.
- Supabase security advisor re-run: the 6 `security_definer_view` ERROR
  findings are gone (critical-level findings dropped from 7 to 1 — the
  remaining one, `schema_migrations` having RLS disabled, is unrelated,
  lower severity, and separately flagged for the repo owner's decision, not
  auto-fixed).

## Remaining related item (not part of this fix)

`public.schema_migrations` has RLS disabled, exposing migration filenames
(not sensitive data, but still a real gap) to the anon key. Flagged
separately — see `docs/ARCHITECTURE_AUDIT.md` — pending the repo owner's
decision on policy shape before it's applied.
