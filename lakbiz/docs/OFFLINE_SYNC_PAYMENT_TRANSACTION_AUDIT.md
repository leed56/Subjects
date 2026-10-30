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

### Editing and deleting payments

The current customer and supplier screens display payment history and provide payment recording. The current provider/action surface has record operations, but no dedicated customer or supplier payment update/delete operation was found in the audited files. Do not add a generic delete or edit action without defining ledger reversal, permissions, audit history, and retry semantics.

## Required target design

Implement authenticated database transactions for customer and supplier payment posting. Each operation should:

1. Require authenticated organization membership and enforce the existing RLS, role, module, and financial visibility rules.
2. Accept a stable client-generated operation/payment ID and be idempotent under retries.
3. Lock the target customer or supplier row within the organization.
4. Validate the amount is finite and positive, the payment method is permitted, and the target record belongs to the organization.
5. Insert the ledger entry and update the corresponding cloud balance in the same database transaction.
6. Return the authoritative ledger entry, resulting balance, and operation receipt for local reconciliation.
7. Ensure a duplicate retry returns the original result and does not apply the balance delta twice.
8. Keep offline-created payments pending until the same transaction can be posted online; do not independently snapshot-write their derived balance.
9. Record audit metadata for actor, timestamp, operation ID, and any reversal/correction.

For future edit/delete support, prefer immutable ledger semantics: post a linked reversal/correction transaction rather than silently mutating or deleting a posted payment. Enforce explicit permissions and require a reason where appropriate.

## Required tests before release

- Customer payment posts one ledger row and decreases cloud credit balance exactly once.
- Supplier payment posts one ledger row and decreases cloud payable balance exactly once.
- Replaying the same operation ID returns the original result without a second balance delta.
- Concurrent payments against the same customer/supplier serialize correctly and cannot lose updates.
- A failure at any point rolls back both ledger and balance changes.
- Offline queue replay posts exactly once after reconnection.
- Unauthorized users, cross-organization IDs, invalid amounts, and disallowed methods are rejected.
- Users without financial visibility cannot read or alter protected financial fields through masked views or RPC parameters.
- Local state reconciles from the authoritative transaction response.

## Release decision

The existing snapshot paths are protective against stale-balance overwrites but are not a complete financial posting implementation. Do not mark customer/supplier payment cloud balance synchronization complete, and do not release payment edit/delete controls, until the atomic transaction design is implemented and authenticated staging tests pass.
