# LakBiz Offline Sync — Direct Write-Path Inventory

**Scope:** Repository audit for PR #89, branch `codex/offline-sync-data-safety`.
**Status:** Static code trace; no database changes and no runtime staging verification.
**Purpose:** Identify every multi-request business workflow that must become atomic or safely retryable before offline sync can be considered concurrency-safe.

## 1. Findings at a glance

LakBiz has two distinct cloud-write mechanisms:

1. **Full snapshot sync** through `pushBusinessData` in `app/src/lib/supabase/business-sync.ts`.
2. **Eager direct writes** called by `app/src/lib/store/app-store-provider.tsx` after local action functions update `AppData`.

The eager path is not a single transaction. A helper may write a parent, then lines, stock movements, related balances, or other records using separate Supabase REST requests. A failure part-way through can leave a valid-looking but incomplete business operation in the cloud. The full-sync generation check does not serialize these eager writes.

The store's pure action functions in `app/src/lib/store/actions.ts` produce the next local `AppData`; cloud persistence is orchestrated separately by the provider. Offline support therefore needs to preserve the local operation until the entire corresponding cloud operation is confirmed.

## 2. Direct-write workflow inventory

The table names below are based on the current `business-sync.ts` helpers. “Atomic boundary” means one PostgreSQL transaction/RPC for the whole logical business operation—not one RPC per table.

| Workflow | Current cloud writes observed | Required atomic boundary |
|---|---|---|
| Sale | Customer snapshot; affected product rows through masked `products` view; `sales` through masked view; replace `sale_lines`; related `stock_logs`; optional `cheques`; optional new `ac_jobs` | One sale-posting operation covering sale header/lines, inventory movement and stock effects, customer/credit effects, cheque and optional installation job. Preserve existing pricing, discount, VAT and profit protections. |
| Purchase / GRN | Supplier snapshot; affected product rows through masked `products` view; `purchases`; replace `purchase_lines`; purchase `stock_logs`; optional `cheques` | One GRN-posting operation covering supplier payable, purchase header/lines, received inventory, stock log and cheque. Preserve invoice-source and purchase-receipt guards. |
| Purchase order create/update/receive | `purchase_orders`; replace `purchase_order_lines`; on receipt, stock logs and affected product rows | One PO operation per create/update/receipt. Receipt must atomically update received quantities, inventory and stock history; retries must not receive the same quantity twice. |
| Customer payment | Customer snapshot; `customer_payments` | One payment-posting operation covering payment row and customer credit balance. |
| Supplier payment | Supplier snapshot; `supplier_payments` | One payment-posting operation covering payment row and supplier payable balance. |
| Contractor payment | Contractor rows through masked `contractors` view; `contractor_payments` | One payment-posting operation covering payment row and contractor payable balance. |
| Bank transaction | `bank_accounts` balance; `bank_transactions` | One ledger operation. Do not trust a stale client-computed account balance as the authority; preserve bank-ledger triggers and source restrictions. |
| Bank transfer | Both affected `bank_accounts` balances; `bank_transfers` | One transfer operation covering both account effects and transfer row. A partial debit/credit is unacceptable. |
| Bank transaction delete | Delete `bank_transactions`; then update `bank_accounts` | One reversal/delete operation; validate ownership and ledger rules in the database. |
| Cheque create/status | `cheques`; for status changes, optional `bank_accounts` update | One cheque operation covering status and any bank-account effect. Preserve cheque and purchase-ledger guards. |
| AC job/status | `ac_jobs` through masked view; optional `job_status_history`; contractor rows through masked view | One job mutation covering header/status history and any contractor financial effects that belong to that action. |
| Job item | `job_items` through masked view; delete directly from `job_items` | One job-item mutation with linked inventory/stock movement when the item source is stock or a purchase-to-inventory flow. |
| Vehicle sale | If credit sale, customer snapshot; then vehicle snapshot through masked view | One vehicle-sale operation covering vehicle state and customer receivable effect. |
| Product/inventory adjustment | Product rows through masked `products` view; optional `stock_logs` | One inventory operation that validates stock and writes its matching movement together. |
| Customer-product price | Upsert or delete `customer_product_prices` | One idempotent row operation; enforce the customer/product organization relationship. |
| Deletes of job/product/vehicle/technician/contractor/bank records | Several helpers issue direct table deletes, sometimes one table at a time | Each multi-table delete needs one transaction and explicit dependency/retention rules. Never cascade-delete financial or stock history merely to make a snapshot match. |

### Important qualifications

- The table records observed in a helper are not necessarily the complete business effects: database triggers may update other tables or reject a write. The existing schema audit found inventory, sales, purchase, bank-ledger, supplier, contractor and job protections. Each transaction must preserve those existing trigger semantics.
- Some helpers intentionally push a whole related collection (for example customers, suppliers or contractors) before writing one payment. That is a broad stale-snapshot write and should be replaced with a narrow, validated operation rather than copied into a new RPC unchanged.
- Masked views are intentional: `sales`, `products`, `ac_jobs`, `contractors`, `vehicles`, `technicians` and `job_items` are written via `upsertMaskedViewRows`. The current helper handles view inserts and uses `bulk_update_masked_view_rows` for updates because the views do not expose the unique constraint needed by ordinary `ON CONFLICT`. Any replacement must retain financial-field masking and authorization.
- The purchase and PO line helpers use delete-then-insert replacement. Those two requests must be inside the same transaction as their parent operation.

## 3. Cross-cutting safety requirements

### Authorization and data visibility

- Derive the actor from the authenticated Supabase session inside the database operation; do not accept a caller-supplied user ID as proof of identity.
- Validate organization membership, role, module permission and plan permission for every operation.
- Keep RLS effective. Do not introduce a generic `SECURITY DEFINER` JSON writer or use elevated privileges to bypass masked views.
- Keep the existing masked-view allowlist and the rule that non-financial roles cannot overwrite hidden buy-price, profit, contractor-cost or other protected financial fields.
- Validate every referenced parent and child row belongs to the same organization.

### Transaction and concurrency

- Lock the organization sync/ledger coordination row for the duration of the database transaction; compare the expected generation while holding that lock.
- The lock and all row mutations must be in the **same PostgreSQL transaction**. A client-side lock or a generation compare performed after REST writes does not protect the operation.
- Use stable operation IDs (idempotency keys) for every retriable business action. Store the result/operation receipt transactionally so retry after timeout cannot post a second sale, payment, transfer or receipt.
- Prefer narrow domain RPCs with typed/validated inputs over a generic full-state JSON payload.
- A full snapshot replacement must not race with direct domain operations. Either route all cloud writes through a shared transactional protocol or disable snapshot pruning while multiple devices/members can write. “Skip prune” alone does not make stale upserts safe.
- Never advance generation when any required mutation fails. A failed transaction must roll back both business rows and generation.

### Accounting and inventory invariants

- Sale: one stock decrement per sold quantity; one matching stock movement; no duplicate on retry.
- GRN: one stock increment per received quantity; supplier payable and purchase records reconcile.
- PO receipt: only the newly received delta moves stock; cumulative received quantity cannot exceed ordered quantity; retries cannot receive the same delta twice.
- Customer/supplier/contractor payment: payment record and balance change reconcile exactly once.
- Bank transfer: debit and credit both occur or neither occurs.
- Cheque status transitions must not double-post bank effects.
- Job stock usage/returns and vehicle sale receivables must be included in the same logical operation when applicable.
- Preserve immutable historical costs and invoice-source authority checks.

## 4. Recommended implementation order

1. **Complete the caller audit.** Trace every exported direct-write helper to its provider action and every provider action to its local action. Record all optional side effects and delete paths. Add tests for operation payload construction.
2. **Define a transaction contract.** Specify operation ID, organization ID, actor validation, expected generation, typed payload, idempotency receipt, and result shape. Decide how full snapshots coordinate with domain operations.
3. **Start with high-risk financial/inventory operations.** Sale, GRN, PO receipt, customer/supplier/contractor payment, bank transaction, bank transfer and cheque transitions. These should be domain-specific transactional functions.
4. **Move operational records.** AC jobs, job items, product adjustments, vehicle sale and related deletes.
5. **Replace broad snapshot writes.** Introduce a dirty-operation/outbox model or an explicit single-writer snapshot policy. Do not infer dirty state from array differences or timestamps alone.
6. **Add fault-injection and concurrency tests.** Force failure after each logical sub-step and prove rollback. Run two authenticated sessions concurrently against the same organization.
7. **Only then enable the new path.** Keep PR #89 draft until authenticated staging tests, schema security review and rollback tests pass.

## 5. Test matrix required before release

| Scenario | Expected result |
|---|---|
| Two devices post sales against the same product simultaneously | No lost stock decrement; both sales either commit with correct stock or one is rejected/retried safely. |
| Same sale/payment/transfer request retried after a network timeout | One business posting only; same operation receipt returned. |
| Failure while inserting lines after parent header | Entire operation rolls back; no orphan header or partial line set. |
| Failure while writing stock log after inventory update | Entire operation rolls back. |
| Failure between transfer debit and credit | Entire transfer rolls back. |
| PO receipt retried with same operation ID | Received quantity and stock movement are not duplicated. |
| Staff role without financial permission | Protected financial values remain unchanged; forbidden operation rejected. |
| Module disabled or subscription invalid | Operation rejected server-side even if UI is bypassed. |
| Multi-member organization plus stale full snapshot | No stale overwrite or destructive pruning of another member's changes. |
| Large organization / paginated snapshot | All pages read; transaction payload and limits handled without silent truncation. |
| RLS cross-organization IDs supplied | No cross-organization read or write. |
| Trigger rejects a protected purchase/bank/inventory change | Whole logical operation rolls back and useful error is returned. |

## 6. Files and functions inspected

- `app/src/lib/store/app-store-provider.tsx` — provider orchestration, cloud push and eager direct-write calls.
- `app/src/lib/store/actions.ts` — local state transition functions used by the provider.
- `app/src/lib/store/types.ts` — persisted `AppData` record shapes.
- `app/src/lib/supabase/business-sync.ts` — direct snapshot helpers, masked-view writes, line replacement, deletes and full snapshot push.
- `app/src/lib/offline/sync-conflict.ts` — local-only record detection and conflict merge behavior.
- `app/src/lib/supabase/pagination.ts` — paginated reads used by full pull.

This is a source-level inventory, not proof of database behavior. SQL migrations, RLS policies, triggers, function grants and authenticated staging tests remain mandatory before implementing or approving the transactional write path.
