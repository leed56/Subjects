# Phase 9 — Vehicle and Textile workflow QA

This is an evidence checklist, not a declaration that the product is world-class.

## Current gate

Status: **OWNER ACCOUNTS CONFIRMED; CROSS-ROLE CERTIFICATION BLOCKED**.

The connected `nexus-erp` Supabase project contains the existing `True Textile` (`textile`) and
`Vegas` (`car_sales`) organizations. Each currently has one owner member. Their passwords are not
stored in this repository or workspace, which is correct security practice. Manager,
cashier/salesperson and warehouse/data-entry identities still need to be created before role
isolation and real counter-workflow certification can be completed.

## Evidence already available

- Production build generates the Vehicle, Textile, Bills, Banking, Stock and Reports routes.
- Vehicle domain tests cover linked invoices, cost/profit, credit receivables, bank settlement
  and retry idempotency.
- Textile domain tests cover metre/yard separation, physical/reserved limits, dye-lot conflicts,
  remnants, exact cutting, landed-cost allocation, receivable ageing and commission.
- The service worker never caches authenticated tenant HTML.
- Owner-only financial visibility and role-route matrices have automated tests.

These tests prove business rules, not browser usability or Supabase integration.

## Required QA organizations

Use the existing organizations for owner testing. Add temporary role identities only after the
target environment and cleanup plan are explicitly approved:

| Organization | Roles | Minimum realistic data |
| --- | --- | --- |
| True Textile | owner exists; manager, cashier, warehouse/data-entry pending | 20 fabrics, 40 physical rolls, metre and yard stock, 3 dye lots, reservations, remnants, quarantined roll, credit customers, mixed settlements |
| Vegas | owner exists; manager and salesperson/data-entry pending | 15 vehicles across incoming/preparation/for-sale/reserved/sold, costs, ageing, customers, bank account, credit and settled sales |

Credentials must come from environment variables or a secrets manager and must never be committed.

## Textile journey

1. Receive/import a physical roll and verify immutable roll identity.
2. Reserve part of a roll; confirm full-roll sale becomes unavailable.
3. Complete an exact measured cut and record explained waste.
4. Verify remnant creation and metre/yard separation.
5. Complete retail, wholesale and full-roll sales.
6. Complete cash, bank, credit, cheque and mixed settlement.
7. Pick, scan, pack, dispatch and deliver the correct roll allocation.
8. Return a cut, inspect it, preserve original-roll evidence and issue the correct financial result.
9. Collect customer credit and verify owner reports.

## Textile certification fixture

The repository includes a deterministic fixture for the existing Textile QA organization. It is
dry-run by default and does not create staff identities or claim workflow certification.

```bash
npm run qa:textile:seed
```

Applying the fixture is deliberately gated by the exact live organization ID and server-side
credentials. Do not run this against a customer organization. The fixture marks every master row
with a `qa-textile-*` identifier or `lakbiz-textile-certification-v1` source marker.

```bash
SUPABASE_URL=https://zestppstpwjxriwcuykc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run qa:textile:seed -- \
  --apply \
  --organization="True Textile" \
  --confirm-organization-id=<verified-uuid>
```

After application:

```bash
SUPABASE_URL=https://zestppstpwjxriwcuykc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run qa:textile:verify -- --organization="True Textile"
```

This creates 20 fabric styles, 40 physical rolls split between metres and yards, three dye lots,
two remnant fixtures, one quarantined roll, six customers, five credit-term records and three
suppliers. Sales, reservations, cuts, dispatches, collections and returns must still be created
through the production UI/RPC workflows so their audit evidence is genuine.

## Vehicle journey

1. Acquire a vehicle with chassis identity, landed cost and preparation cost.
2. Move incoming → preparation → for sale and confirm duplicate chassis protection.
3. Reserve/list and verify 30/60/90-day ageing behavior.
4. Sell for cash, bank transfer and credit.
5. Verify invoice linkage, one-time settlement and retry idempotency.
6. Reconcile banking and verify realized margin.
7. Confirm manager/salesperson can operate without seeing owner-only cost, minimum price or profit.

## Viewport and language matrix

Run each primary journey at 1440 desktop, tablet, and 390/360/320 mobile widths in English and
Sinhala. At 320px also test 200% text resize and 400% browser zoom/reflow. Capture screenshots only
after realistic data is loaded.

## Failure and accessibility matrix

- Keyboard-only flow, focus visibility/order, drawer/modal trap and Escape behavior.
- Screen-reader names, headings, form errors and status announcements.
- Slow 4G, offline after page load, interrupted save, retry and duplicate tap.
- Expired session during a save; confirm no false success and no duplicated transaction.
- Console errors, failed requests, Supabase/RLS denials and cross-role data leakage.

## Known blocker found during Phase 9

The current Textile POS contains substantial hard-coded English UI copy. Sinhala certification
must remain failed until those strings are moved into the localization dictionary and visually
tested. Automated accessibility tools alone cannot certify WCAG conformance or real counter usability.
