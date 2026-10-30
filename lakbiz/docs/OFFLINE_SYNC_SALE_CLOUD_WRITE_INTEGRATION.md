# Offline sale cloud-write integration map

**Purpose:** specify the safe replacement boundary for the existing online/offline sale workflow before any database RPC or client migration is implemented.

**Status:** design/audit only. No SQL was applied, no production data was changed, and no deployment or merge was performed.

## Existing call chain

1. The sales page calls `createSaleToCloud(lines, paymentMethod, options)`.
2. `app-store-provider.tsx` checks local readiness, conflict state, write permission, online/offline eligibility.
3. It calls the pure local `createSale(...)` action to construct the sale and related local effects.
4. It immediately saves the new state locally (`setData`, `latestDataRef`, `saveAppData`).
5. If offline, it records pending sync and returns a local success.
6. If online, it calls `syncSaleSnapshot(organizationId, next, saleId, options)`.
7. If cloud sync fails, it records the error/pending marker and schedules a later full cloud push.

The UI therefore has an optimistic local sale before cloud acceptance. A future atomic cloud endpoint must preserve offline-first behavior while distinguishing **locally queued** from **cloud-committed** sales. A failed online cloud post must not be mistaken for a committed sale.

## Current online cloud write sequence

`syncSaleSnapshot` currently performs independent PostgREST requests:

1. `syncCustomersSnapshot(organizationId, data.customers)` — sends the complete local customer snapshot, including the credit-balance change from this sale.
2. Reads existing product buy prices for users without financial visibility (best effort), then sends the affected products through the masked `products` view. The rows are derived from the local product snapshot and include `stock_qty`.
3. Upserts the sale header through the masked `sales` view.
4. Deletes existing `sale_lines` for this sale and inserts the replacement line set in a separate request.
5. Inserts sale stock-log rows selected by a bill-ID prefix in their note.
6. If applicable, inserts the cheque row.
7. If applicable, upserts newly created AC job rows through the masked `ac_jobs` view.

These steps are not one transaction. A failure at any point can leave some earlier requests committed. The function also does not return a committed server-side sale receipt or server-authoritative stock balance.

## Important integration hazards

### 1. Snapshot stock overwrite

The sale path sends `stock_qty` from the local product snapshot to the masked products view. That local quantity was calculated from cached data. If another device has sold or adjusted stock since this device last refreshed, this request can overwrite a newer quantity with stale state.

The atomic sale operation must apply a **quantity delta to locked authoritative stock**, not accept a client-supplied resulting `stock_qty`. The regular product snapshot must not subsequently overwrite the server result with the same stale value.

### 2. Customer snapshot overwrite

The sale path sends the full local customer collection to `syncCustomersSnapshot`, not only the customer balance delta. A stale client snapshot could overwrite customer fields or credit balance changes made by another device. A sale transaction should update only the intended customer credit effect under a row lock, and should not upsert the full customer collection as a side effect.

### 3. Partial completion and retry ambiguity

The header, lines, stock, customer, cheque, and job writes can commit independently. A later retry can encounter a partially created sale. A stable operation ID and database-side idempotency receipt are required; checking only whether a sale ID exists is insufficient to prove all related effects completed.

### 4. Sale log selection is indirect

Sale stock logs are selected by `log.type === "sale"` and whether the note includes the first eight characters of the sale ID. The durable contract should associate movement rows to the sale with an explicit relation/reference field, or derive them from the committed sale transaction, rather than relying on a note substring.

### 5. Local optimistic result is not cloud authority

The provider persists the local sale before the cloud write. The UI and sync state need an explicit lifecycle (for example: queued offline, posting, committed, needs attention). Do not remove or rewrite the local record on a transient network error; reconcile it using the idempotency operation ID and the server receipt.

## Recommended replacement boundary

Create a single authenticated database operation for posting one sale, conceptually `post_sale(p_organization_id, p_operation_id, p_expected_generation, p_sale_payload)`.

The client payload should contain business intent, not authoritative derived state:
- stable operation ID generated once and persisted with the local pending sale;
- organization-scoped customer/product identifiers;
- line quantities and requested unit prices;
- payment method and permitted payment details;
- discount input and VAT context needed by the business rules;
- optional installation-job intent and its allowed fields.

The database operation should:
1. Authenticate and validate membership, role, plan, module permissions and organization ownership.
2. Check the idempotency receipt first; if already committed, return the original receipt without repeating effects.
3. Verify the expected sync generation and coordinate with the organization-level sync protocol.
4. Aggregate duplicate product IDs, lock product rows deterministically, and validate aggregate stock.
5. Derive or validate prices, discounts, VAT, totals, and financial values under existing masking rules. Ignore/reject client buy-price and profit claims from roles that cannot see them.
6. Apply stock deltas and insert sale stock-history records once.
7. Insert sale header and lines, and apply only the intended customer-credit/cheque/install-job effects.
8. Advance generation and save the idempotency receipt in the same transaction.
9. Return authoritative sale, totals, stock balances, generation and receipt status.

All writes must roll back together on any failure.

## Client migration sequence

1. Add and test the database transaction in a non-production environment first.
2. Add a typed client wrapper with a strict response schema and explicit error mapping.
3. Persist an operation ID with each locally queued sale and reuse it on every retry.
4. For online sales, call the transaction endpoint and reconcile local sale/stock/customer/cheque/job data from its authoritative response.
5. For offline sales, retain the queued intent; when online, post it through the same endpoint rather than replaying the stale full snapshot as a sale.
6. Exclude committed sale effects from generic full-snapshot stock/customer overwrites, or redesign snapshot merge semantics so a snapshot cannot undo transactionally committed deltas.
7. Keep the legacy path behind a controlled migration/rollback switch only until authenticated tests prove the new path; never run both writers for the same sale.

## Required test cases

- Online cash, credit, cheque and installation sales.
- Offline queue followed by repeated reconnect/retry with one operation ID.
- Duplicate product lines and insufficient aggregate stock.
- Concurrent sales on two clients with stock contention.
- A stale client attempts to post after another device sells or adjusts stock.
- Customer credit updated concurrently from another device.
- Fault injection after each transaction sub-step; assert complete rollback.
- Retry after a simulated lost response; assert one sale and one set of side effects.
- Roles with and without financial visibility; forged buy-price/profit values.
- Module-disabled, read-only, expired-plan and cross-organization requests.
- Full snapshot runs immediately before and after a sale; verify no stock/customer regression.
- Optional cheque and AC job creation and duplicate-retry safety.

## Open decisions before migration

- The exact authoritative rules for whether unit price can be overridden by a cashier/data-entry role.
- Whether sale stock movement is the sole inventory mutation for this transaction in every enabled sector.
- Whether bill numbering is organization-serialized and how it behaves under offline queued sales.
- The exact relationship and uniqueness constraints for cheque-to-sale and install-job-to-sale links.
- How pending local sales are represented in the existing persisted data model and conflict UI.
- Deployed trigger/function state and grants must be verified against the live schema before writing the migration.

**Release gate:** do not replace the legacy write path until the atomic endpoint, generation coordination, idempotency, RLS/role behavior, and authenticated concurrency/rollback tests all pass. Keep PR #89 draft until then.
