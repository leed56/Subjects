# Offline sale inventory trigger audit

**Scope:** source and migration audit for PR #89. This is a code/design finding only. No database was changed and no migration was applied.

## Verified current sale behavior

The local sale action is `app/src/lib/store/actions.ts:createSale`.

1. Each submitted line is checked independently: product exists, quantity is positive, and the product's current local `stockQty` is at least that line's quantity.
2. A sale line is retained for each accepted input line.
3. The action builds `qtyByProduct` with `new Map(saleLines.map(line => [line.productId, line.qty]))`. If a product appears more than once, later entries overwrite earlier quantities.
4. The local product stock is reduced by the one quantity left in that map.
5. A separate `stock_logs` row is created for every sale line, with `type: "sale"` and that line's quantity.

### Confirmed duplicate-product defect

The per-line stock check and the map overwrite do not aggregate duplicate product lines.

Example: local stock is 5 and the submitted sale contains two lines for the same product, quantities 3 and 3.

- Both lines independently pass the current `stockQty < qty` check.
- Both lines remain in the sale and both stock-log rows are produced (total movement recorded: 6).
- The map retains only the last quantity (3), so local stock is reduced by 3 rather than 6.

This is a real inconsistency in the current local action. A future server-authoritative sale operation must aggregate quantities by product before validating stock, and must reject the sale if the aggregate exceeds available stock. It must not copy the current map behavior.

## What the checked migrations establish about stock logs

The initial business-data schema creates `stock_logs` as a history table. The checked migration set does not define a stock-log trigger that changes `products.stock_qty`.

Migration `20250711000001_stock_logs_user_id_server_stamp.sql` adds one trigger:
- `BEFORE INSERT OR UPDATE` on `stock_logs`
- calls `stock_logs_stamp_user_id()`
- overwrites `new.user_id` with `auth.uid()` for authenticated writers

That trigger is an audit-actor protection, not an inventory adjustment. Therefore the documented sale snapshot's product quantity update and stock-log insert are distinct writes in the current design; do not assume the stock-log insert itself decrements inventory.

The product masked-view trigger in `20250703000001_products_active_notes.sql` writes `stock_qty` from the supplied product view row. This reinforces why a stale offline product snapshot must not be allowed to overwrite authoritative stock during sale posting.

## Required behavior for the future atomic sale operation

The transaction design must:

1. Validate the authenticated user, organization membership, sales/stock module access, and role using the same effective restrictions as existing write paths.
2. Validate every product belongs to the target organization and is eligible for sale.
3. Aggregate all sale-line quantities by product ID before checking stock; lock affected product rows in a deterministic order.
4. Reject insufficient aggregate stock; never clamp a server-side sale to zero.
5. Derive or validate prices, discounts, VAT, totals, and financial fields under the existing financial-masking rules. Do not trust a non-financial client's hidden buy-price/profit values.
6. Write sale header, lines, stock quantity changes, stock movement history, and optional cheque/customer-credit/install-job effects in one transaction.
7. Make retries idempotent with a stable operation ID and return the original result for a repeated successful operation.
8. Advance the organization sync generation within the same transaction, after verifying the expected generation.
9. Roll back every side effect if any step fails.

## Tests that must be added before release

- Duplicate product lines aggregate correctly (3 + 3 against stock 5 is rejected; against stock 7 succeeds and reduces stock by 6).
- Multiple lines for the same product create the intended number of sale-line and stock-log records, with total logged quantity matching the inventory decrement.
- Two concurrent sales cannot both consume the same remaining stock.
- Repeating the same operation ID does not create a second sale, second stock decrement, second cheque, or duplicate install job.
- A failure injected after each major write leaves no partial sale, line, stock, credit, cheque, or job changes.
- Authenticated non-financial roles cannot overwrite buy price/profit by submitting forged payload fields.
- Cross-organization product/customer IDs are rejected.
- Existing role, module, subscription, RLS, and trigger protections remain effective.

## Limits of this audit

This audit verifies the checked repository migration definitions and local sale implementation. It does not prove that every historical migration has been applied to the live project in exactly the same state, and it does not replace authenticated staging tests. Before writing a production migration, compare the deployed trigger/function catalog with the complete migration history and test the transaction against a separate free/local test database or another approved staging environment.

**No SQL migration, production database write, merge, or deployment was performed.**
