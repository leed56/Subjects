# LakBiz — Sale Transaction Contract (Design Only)

**PR:** #89 — `codex/offline-sync-data-safety`
**Status:** design note only. No SQL migration, database change, deployment or authenticated test was performed.

## 1. Current sale path traced

The local action is `createSale` in `app/src/lib/store/actions.ts`. The provider action is `createSaleToCloud` in `app/src/lib/store/app-store-provider.tsx`. Cloud persistence is `syncSaleSnapshot` in `app/src/lib/supabase/business-sync.ts`.

Current sequence:

1. `createSale` validates each requested line against the device's cached product and stock quantity.
2. It calculates line prices, discount, VAT split, total and profit on the client.
3. It may create/update a customer and, for credit sales, increase the local customer's credit balance.
4. It may create a cheque record.
5. It reduces local product `stockQty` and creates sale stock-log rows.
6. It may create an AC installation job.
7. Provider saves the updated `AppData` locally.
8. If online, `syncSaleSnapshot` writes customer rows, product rows through the masked `products` view, sale header through masked `sales`, replaces `sale_lines`, writes matching `stock_logs`, then optional cheque and AC-job rows. These are separate requests.

A failure after any request can leave only part of the sale in the cloud. The local state is retained and marked pending, but the cloud may already contain a parent row or stock change.

## 2. Proposed single transaction boundary

A future RPC should represent one logical operation:

`post_sale(p_operation_id, p_organization_id, p_expected_generation, p_sale, p_lines, p_customer_change, p_cheque, p_install_job)`

This is a conceptual signature, not an approved SQL interface. Prefer typed arguments or a strictly validated JSON schema; never accept arbitrary table names or arbitrary column maps.

Within one PostgreSQL transaction, the operation should:

1. Authenticate from `auth.uid()`; verify organization membership, active write entitlement, sales-module entitlement and role permission.
2. Acquire the agreed organization-level coordination lock and validate the expected generation (or use a shared operation-lock protocol that also coordinates with full snapshot writes).
3. Look up `p_operation_id` in a durable idempotency receipt table scoped to organization and actor. If already committed, return the original result without repeating any effects.
4. Validate every product/customer/cheque/job reference belongs to the organization.
5. Lock all affected product rows in deterministic ID order to prevent deadlocks and concurrent overselling.
6. Validate quantities against authoritative current stock, not the device's cached stock quantity.
7. Validate/derive line totals, discount, VAT and sale total under the existing business rules. Treat client-calculated profit and buy price as untrusted for users who cannot see financials.
8. Insert/update only the relevant customer fields. For a credit sale, apply the credit balance effect exactly once in this transaction.
9. Insert the sale header and sale lines through the established masked/authorized write path or a carefully reviewed equivalent that retains the same role/module and financial masking checks.
10. Apply inventory reduction exactly once and insert matching stock movement rows with actor attribution. Do not also overwrite product `stock_qty` with a stale client snapshot.
11. Insert the optional cheque and installation job only when they belong to this sale and pass their own permission/validation rules.
12. Advance the sync generation and persist the idempotency result in the same transaction.
13. Return the committed sale ID, operation ID and resulting generation.

Any exception must roll back every business row, stock movement, balance change, receipt and generation update.

## 3. Critical implementation constraints

### Inventory must have one authority

The existing local action reduces `product.stockQty` and emits one `stock_logs` row per sale line. The current sync helper then sends both the new product quantity and the stock log. A transactional implementation must choose one authoritative database-side stock mutation and ensure stock-log triggers do not apply the same movement a second time.

The replacement should not blindly reuse `productRowsFromList` for a sale. That mapper includes `stock_qty`, and it represents the device's whole product snapshot. For sale posting, the database should lock and decrement current stock by validated sale quantities, and create the corresponding stock history in the same transaction.

Before writing this RPC, inspect the complete current trigger/function definitions for stock logs, product default-location quantity synchronization, purchase receipt guards and any stock-ledger side effects. Confirm whether stock log insertion itself changes stock or only validates/stamps the row. The repository audit has identified relevant trigger families, but this exact end-to-end behavior must be proven from the complete SQL definitions and staging.

### Keep masked financial fields protected

Existing masked views expose zeroed `sales.profit` and `sale_lines.buy_price` to users without financial visibility. Existing triggers preserve old financial values on updates, and masked-view INSTEAD OF triggers perform role/module checks.

The new function must not turn into a SECURITY DEFINER bypass. If SECURITY DEFINER is required for a particular base-table operation, it must explicitly enforce authenticated identity, organization membership, role, module and subscription checks, use a fixed safe search_path, validate every referenced row, and preserve the existing financial-field rules. Do not trust client-supplied `profit` or `buy_price` for a restricted user.

### Keep local/offline semantics

- The browser may continue to save a locally generated sale ID and operation ID before sending.
- If the network fails after commit but before the response arrives, retry with the same operation ID.
- A duplicate retry must return the first result, not create another sale or decrement stock again.
- If server validation rejects the sale (for example, insufficient current stock), return a typed conflict and retain the local pending operation for user resolution. Do not silently overwrite newer server stock.
- The provider must not mark the sale cloud-synced merely because a request was sent; only a confirmed RPC receipt can clear that operation.

## 4. Existing schema and security evidence to preserve

Repository migrations include:

- `20250623000001_financial_data_rls.sql`: masked views for products, sales and sale lines; financial visibility masking and preserve-on-update functions.
- `20250624000001_sync_generation_and_rls_hardening.sql`: organization sync generation, write checks and masked base-table protections.
- `20250625000003_masked_view_triggers_security_definer.sql`: SECURITY DEFINER INSTEAD OF triggers for masked-view writes with module checks.
- `20250712000001_role_aware_write_rls.sql`: later role-aware authorization inside masked-view triggers.

These are migration definitions in the repository, not proof that every production database has the same migration state. Confirm deployed migration history and actual function/trigger definitions in a safe staging project before implementation.

## 5. Required tests before enabling

1. Valid cash sale: header, lines, stock decrement and stock logs commit together.
2. Valid credit sale: customer receivable and sale commit together exactly once.
3. Cheque sale: cheque and sale commit together; cheque links to the correct sale.
4. Installation sale: AC job and sale commit together.
5. Insufficient current stock despite stale client cache: reject without any partial write.
6. Two concurrent sales of the final available unit: no oversell; one succeeds and the other receives a conflict.
7. Retry same operation ID after simulated lost response: exactly one sale and one stock movement.
8. Inject failure after header, lines, stock update, stock log, customer update, cheque and job: every failure rolls back all effects.
9. Cashier/data-entry/manager/owner role matrix: preserve the current allowed operations and financial masking.
10. Sales or stock module disabled / subscription read-only: reject server-side.
11. Cross-organization product/customer/cheque IDs: reject with no data leakage.
12. Existing stock and purchase triggers: prove no duplicate decrement and no bypass of purchase/inventory protections.
13. Full snapshot sync concurrent with sale posting: shared lock/generation protocol prevents stale snapshot overwrite.

## 6. Explicit non-goals

- Do not add a migration or deploy this function yet.
- Do not mutate production data or create a paid Supabase branch.
- Do not remove the current sale path until staging tests prove the new path.
- Do not treat a successful TypeScript build as evidence of database transaction safety.
