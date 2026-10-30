# LakBiz Offline Payment Transaction Audit

Status: audit and design only. No database migration, RPC, production write, merge, or deployment is included.

## Scope

This audit covers customer and supplier payment recording in the current offline-first store and its cloud snapshot synchronization. It records the current behavior and the required safe transaction boundary before payment editing or deletion is introduced.

## Current application flow

- The customer and supplier screens call `recordCustomerPaymentToCloud` and `recordSupplierPaymentToCloud`.
- The provider now checks online cloud authentication/configuration before changing local state when online. When offline, it retains the existing local-first queue behavior.
- The local action creates a payment with a generated ID, timestamp, amount, method, and optional note; it also adjusts the local customer credit or supplier payable balance.
- The provider persists the local snapshot and then calls the cloud sync function.
- Cloud sync writes the payment ledger row first, then performs a separate request to refresh related master data.
- A failed second request can leave the ledger row committed while the provider reports a retryable error. The ledger upsert is keyed by the stable payment ID, so retrying the same payment row is intended to be idempotent.

## Confirmed financial consistency gaps

### Customer payments

`syncCustomerPaymentSnapshot` upserts the `customer_payments` ledger row, then upserts customer details with `credit_balance` deliberately omitted. This prevents a stale local snapshot from overwriting the cloud credit balance, but it does not apply the payment amount as a cloud-side credit-balance delta. Consequently, the cloud ledger can contain the payment while the cloud customer balance remains unchanged until a proper transaction workflow exists.

### Supplier payments

`syncSupplierPaymentSnapshot` upserts the `supplier_payments` ledger row, reads existing supplier payable balances, preserves those existing cloud balances, and upserts supplier details. This protects against overwriting a newer cloud balance with stale local data, but it does not apply the supplier payment amount as a cloud-side payable-balance delta. The cloud ledger can therefore contain the payment while the cloud payable balance remains unchanged.

#### Contractor payments

`recordContractorPayment` recomputes the local payable from completed contractor jobs minus recorded contractor payments. `syncContractorPaymentSnapshot` writes the contractor payment ledger row, reads the cloud contractor payable balances, preserves those cloud balances, and upserts the contractor snapshot. This prevents stale local payable values from overwriting cloud values, but it does not apply the payment as a cloud-side payable delta. The contractor payment ledger can therefore be present while the cloud payable balance remains unchanged. The authoritative cloud transaction must account for both completed-job accruals and payouts under one consistent locking/transaction model.

## Editing and deleting payments

The current customer and supplier screens display payment history and provide payment recording. The current provider/action surface has record operations, but no dedicated customer or supplier payment update/delete operation was found in the audited files. Do not add a generic delete or edit action without defining ledger reversal, permissions, audit history, and retry semantics.

## Required target design

Implement authenticated database transactions for customer, supplier, and contractor payment posting. Each operation should:

1. Require authenticated organization membership and enforce the existing RLS, role, module, and financial visibility rules.
2. Accept a stable client-generated operation/payment ID and be idempotent under retries.
3. Lock the target customer, supplier, or contractor row within the organization.
4. Validate the amount is finite and positive, the payment method is permitted, and the target record belongs to the organization.
5. Insert the ledger entry and update the corresponding cloud balance in the same database transaction. For contractor payables, define how completed-job accruals and payout entries are serialized and reconciled.
6. Return the authoritative ledger entry, resulting balance, and operation receipt for local reconciliation.
7. Ensure a duplicate retry returns the original result and does not apply the balance delta twice.
8. Keep offline-created payments pending until the same transaction can be posted online; do not independently snapshot-write their derived balance.
9. Record audit metadata for actor, timestamp, operation ID, and any reversal/correction.

For future edit/delete support, prefer immutable ledger semantics: post a linked reversal/correction transaction rather than silently mutating or deleting a posted payment. Enforce explicit permissions and require a reason where appropriate.

## Required tests before release

- Customer payment posts one ledger row and decreases cloud credit balance exactly once.
- Supplier payment posts one ledger row and decreases cloud payable balance exactly once.
- Contractor payment posts one ledger row and decreases cloud payable balance exactly once without losing concurrent completed-job accruals.
- Replaying the same operation ID returns the original result without a second balance delta.
- Concurrent payments against the same customer/supplier/contractor serialize correctly and cannot lose updates.
- A failure at any point rolls back both ledger and balance changes.
- Offline queue replay posts exactly once after reconnection.
- Unauthorized users, cross-organization IDs, invalid amounts, and disallowed methods are rejected.
- Users without financial visibility cannot read or alter protected financial fields through masked views or RPC parameters.
- Local state reconciles from the authoritative transaction response.

## Release decision

The existing snapshot paths are protective against stale-balance overwrites but are not a complete financial posting implementation. Do not mark customer/supplier/contractor payment cloud balance synchronization complete, and do not release payment edit/delete controls, until the atomic transaction design is implemented and authenticated staging tests pass.


## Live database permission audit (read-only inspection, 2026-10-30)

The linked LakBiz Supabase project was inspected using read-only schema, migration-history, function-definition, and `pg_policies` queries. No rows were changed.

The live database currently enforces different payment permissions by ledger:

| Ledger | Insert/update/delete roles | Module check | Read visibility |
|---|---|---|---|
| Customer payments | owner, manager, data_entry, cashier | customers | org member in those roles |
| Supplier payments | owner only | suppliers | owner/manager financial visibility |
| Contractor payments | owner only | ac_jobs | `can_see_org_financials` |

Additional verified facts:

- Supplier master records are owner-write and financial-read restricted; this matches the existing supplier payment write policy.
- Contractor payout writes are owner-only. Contractor master writes allow owner/manager, but the contractor financial columns are masked for users who fail `can_see_org_financials`.
- The live `can_see_org_financials(uuid)` function currently returns true only for an organization member whose role is `owner`. This is stricter than the earlier migration comment describing owner/manager visibility; the live function and live policies are the operative behavior.
- `contractor_payments` has no direct foreign key from `contractor_id` to `contractors_base`; the posting transaction must explicitly verify the contractor belongs to the supplied organization.
- The current customer payment table stores a text payment ID, organization/customer IDs, customer name, numeric amount, timestamp, method and note. Supplier payments have the analogous supplier fields. Contractor payments use a date payment_date and also have updated_at.
- Existing payment table policies allow UPDATE and DELETE for the roles above, but the application audit did not find dedicated edit/delete workflows. Database capability must not be mistaken for a supported product workflow.

### Consequence for transaction implementation

Do not apply one shared permission list to all three posting functions. Preserve the live per-ledger role/module matrix exactly unless a separately reviewed product permission change is requested. In particular, do not widen supplier or contractor payout writes to managers merely because they can edit contractor master records. Any function that writes a financial balance must independently enforce the same effective financial authorization and organization scoping as the relevant table policies.

The contractor transaction must also resolve a design issue before implementation: contractor payable is derived from completed contractor-job subcontract costs minus payouts, while the current contractor payment table has no contractor foreign key and the current contractor base balance is masked for non-financial users. The transaction must verify the job-accrual definition and serialization rules before applying a payout delta.

## Implementation gate

The current inspection is sufficient to define the authorization constraints, but not sufficient to safely write a production-ready RPC. Before adding SQL, inspect the full role/module helper definitions, contractor completion/status rules and all triggers affecting customer/supplier/contractor balances. Then add database-level tests for each allowed and denied role, duplicate operation IDs, cross-organization IDs, rollback, and concurrent posting. Keep the implementation in the repository only until authenticated staging validation is available.


## Balance trigger and invoice-authority audit (live database, read-only)

The live trigger definitions were inspected for customer, supplier, contractor, payment-ledger, and AC-job tables. No database rows or schema objects were changed.

### Customer balances

- The only trigger found on `customers` is the generic `updated_at` timestamp trigger.
- No customer-payment trigger applies a payment amount to `customers.credit_balance`.
- Therefore the customer payment posting transaction must explicitly lock the customer row, insert the payment, and apply the signed balance delta itself in the same transaction. It must be coordinated with the sale/credit workflow so concurrent credit sales and receipts cannot overwrite one another.

### Supplier balances — important separate authority

- The `suppliers` table has an invoice-authority guard. When `purchase_invoice_settings.enabled` is true, authenticated/anonymous direct changes to `payable_balance` are rejected with the message that supplier payable changes require the atomic invoice/settlement workflow.
- Legacy `supplier_payments` inserts/updates/deletes are also blocked for those organizations while invoice authority is enabled.
- A verified internal function, `inventory_internal.record_purchase_receipt_invoice_atomic`, locks the purchase order, deliveries, relevant products and supplier, then increases supplier payable as part of receipt-invoice posting.
- This means a generic supplier-payment RPC that directly updates `suppliers.payable_balance` would conflict with the enabled invoice-authority design. Supplier payment posting must first branch on invoice-authority mode and use/extend the dedicated invoice settlement workflow with its existing bank, invoice and idempotency invariants. Do not bypass its guards or write the supplier balance directly.

### Contractor payable accruals

- `ac_jobs_base` has no trigger that automatically accrues contractor payable when a job becomes completed.
- The job view trigger preserves subcontract cost for callers without financial visibility; a separate base-table trigger also protects subcontract cost and contractor payable balance from non-financial updates.
- Contractor payments have only an `updated_at` trigger; there is no trigger applying a payout to contractor payable.
- The database schema stores `assignee_type`, `assignee_id`, `subcontract_cost`, and `status` on AC jobs, while contractor payments store contractor ID and amount. The contractor payment table has no contractor foreign key.
- Thus contractor payable is not presently a database-maintained ledger total. A safe posting design needs a single serialized rule for completed-job accrual and payout, including how job completion/status changes and subcontract-cost edits are coordinated. A payment-only delta RPC would not solve this race.

### Updated implementation decision

Do not implement three superficially similar payment RPCs yet. Customer payment posting can be designed around a locked customer balance, but supplier payment posting must respect invoice-authority mode and contractor posting needs a defined authoritative accrual ledger/locking boundary. These are separate domain transactions, not one generic balance-update function. The current application should continue to treat the affected cloud payment balances as not fully reconciled until those domain-specific transaction paths and authenticated staging tests exist.


## Existing invoice-authority supplier settlement RPC audit (live database, read-only)

A further read-only inspection found that invoice-authority mode already has dedicated atomic settlement functions in the live database. This narrows the supplier design gap: the database settlement workflow exists, but the ordinary supplier-payment screen is not currently wired to it.

### Existing functions

- `public.settle_purchase_invoice_cash_atomic(organization_id, settlement_id, invoice_id, amount, payment_date, note)`
  - Calls `inventory_internal.require_purchase_authority` and requires invoice-authority settings to be enabled.
  - Validates a positive two-decimal amount, date and note; derives a canonical request and takes an advisory transaction lock on the stable settlement ID.
  - Replays an identical settlement ID safely and rejects reuse with different details.
  - Locks the invoice row, checks invoice currency/date and outstanding amount, then locks the supplier row.
  - Inserts the cash-settlement ledger row and decreases supplier payable in the same database transaction.
- `public.settle_purchase_invoice_bank_atomic(organization_id, settlement_id, invoice_id, account_id, foreign_amount, exchange_rate, fee, payment_date, note)`
  - Calls the purchase-authority helper and additionally requires banking module write access and invoice-authority settings.
  - Validates amount, FX rate, fee and date; uses a stable settlement ID with canonical-request idempotency.
  - Locks the invoice, supplier and bank account; checks invoice outstanding, supplier payable and available bank funds.
  - Writes the bank-settlement ledger and updates supplier payable and bank balance within the same transaction. It also records the paid amount, fee and exchange difference.
- Read helpers `get_purchase_invoice_settlement` and `get_purchase_invoice_bank_settlement_snapshot` require authenticated financial visibility and return the settlement/invoice/balance data needed for reconciliation.

### Application integration gap

The current supplier screen still calls `recordSupplierPaymentToCloud`. That provider path locally records a legacy supplier payment and calls `syncSupplierPaymentSnapshot`; it does not call either invoice settlement RPC. The supplier page does not currently expose a verified invoice-specific settlement flow in the inspected application paths.

### Revised supplier implementation decision

- For organizations with invoice authority enabled, supplier payments must be posted against a specific invoice through the existing cash or bank settlement RPC. Do not route these payments through the legacy `supplier_payments` snapshot path.
- For bank settlements, preserve the separate banking module permission check and account balance/fee rules.
- For organizations without invoice authority, the existing legacy supplier payment path remains a separate case; its role and balance semantics still need a domain-safe atomic implementation.
- Before wiring the invoice settlement flow, inspect the live RPC grants and the full helper definition, then implement the UI/provider integration with stable IDs and reconciliation from the returned authoritative result. Add authenticated tests for allowed/denied roles, replay, outstanding limits, insufficient bank funds, cross-organization IDs and rollback.
- No RPC was called for posting, no database object or row was changed, and no production write was made during this audit.
