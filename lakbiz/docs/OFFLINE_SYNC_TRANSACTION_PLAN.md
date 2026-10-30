# Offline Sync Transaction Refactor Plan

Status: design plan only. No database changes are applied by this document.

Target branch: `codex/offline-sync-data-safety`  
Related PR: #89  
Scope: LakBiz ERP offline/full sync and eager business writes.

## 1. Why this work is required

The current generation check is optimistic concurrency detection performed **after** the full snapshot has already written rows. In `pushBusinessData`, parent rows are upserted, line tables are replaced in separate requests, and (for single-member organisations) rows are pruned before `advanceOrgSyncGeneration` is called. A stale client can therefore modify cloud data and only discover the conflict at the end.

The full push is also not atomic. A failure after some requests succeed can leave a partial snapshot in the database.

The current client has many eager write helpers in `business-sync.ts`. Several represent multi-request business workflows, including purchase + lines + stock logs, payment + balance, bank transaction + account balance, job + history/items, and parent deletion + child deletion. A database lock acquired separately for each HTTP request does not make these multi-request workflows atomic.

## 2. Goals and non-goals

### Goals

- Make each full snapshot all-or-nothing.
- Check the expected organisation generation before any snapshot mutation.
- Serialize full sync and business write transactions per organisation.
- Make related business writes atomic (for example, purchase header, lines, stock movement, supplier/ledger effects).
- Preserve RLS, membership, role, subscription, module, product-limit, and masked-view rules.
- Preserve database triggers that protect inventory, purchase receipts, balances, textile transactions, profit fields, and audit fields.
- Make retries safe through stable client-generated IDs and explicit idempotency.
- Preserve the current offline data-loss protections and paginated reads.

### Non-goals

- Do not change production data or production schema as part of planning.
- Do not add a paid Supabase branch or project.
- Do not merge or deploy this PR.
- Do not introduce a generic arbitrary-table JSONB upsert endpoint.
- Do not claim concurrency is solved by moving the existing generation RPC to the beginning.

## 3. Current implementation facts

Observed in `lakbiz/app/src/lib/supabase/business-sync.ts`:

1. `pushBusinessData` reads/checks a generation before building and sending the snapshot.
2. It writes many parent collections using separate PostgREST requests.
3. Masked views (`sales`, `products`, `ac_jobs`, `contractors`, `vehicles`, `technicians`, `job_items`) use `upsertMaskedViewRows`, which first queries IDs, inserts new rows, and calls `bulk_update_masked_view_rows` for existing rows.
4. Sale, purchase, and purchase-order lines are deleted and reinserted in separate requests by `replaceLinesBatch`.
5. Single-member organisations are pruned using additional select/delete requests. Multi-member organisations skip pruning but still upsert the full local snapshot.
6. `advanceOrgSyncGeneration` is called only after those mutations.
7. Eager helpers such as `syncPurchaseSnapshot`, `syncBankTransactionSnapshot`, `syncCustomerPaymentSnapshot`, `syncACJobSnapshot`, and delete helpers issue multiple independent requests for related records.

Observed in `20250624000001_sync_generation_and_rls_hardening.sql`:

- `try_advance_org_sync_generation` performs a compare-and-increment update, but does not enclose earlier HTTP writes in the same transaction.
- Existing RLS and module checks are intentionally part of the current security model and must not be weakened.

The live schema has additional triggers and protections around inventory, purchase/receipt authority, bank ledgers, supplier/customer balances, masked views, textile data, and protected financial fields. The transaction implementation must be based on the actual migration history and trigger definitions, not just the TypeScript row mappers.

## 4. Required transaction protocol

### 4.1 Organisation transaction guard

Every new multi-row write RPC must:

1. Require a real authenticated user (`auth.uid()` is not null).
2. Validate organisation membership and write permission using the existing authoritative permission functions.
3. Acquire a transaction-scoped lock for the organisation (prefer a row lock on the organisation row, acquired with `SELECT ... FOR UPDATE`; advisory locks are an alternative only if key derivation and collision behaviour are documented).
4. Check the caller's expected generation after acquiring the lock.
5. Perform only the operation-specific, allowlisted mutations.
6. Increment the organisation generation in the same transaction, once per committed logical operation.
7. Return the new generation and a structured conflict result.

The lock must be acquired before any write. PostgreSQL automatically releases it on commit or rollback.

### 4.2 Full snapshot RPC

Replace the client-side sequence in `pushBusinessData` with one authenticated RPC call. Its transaction must include:

- Permission and organisation lock.
- Expected-generation comparison.
- Validation of the snapshot payload and organisation IDs.
- Explicit upserts in foreign-key-safe order.
- Explicit line replacement for sales, purchases, and purchase orders.
- The existing masked-view write semantics, or carefully reviewed base-table operations that preserve the same view trigger and permission behaviour.
- Existing single-member pruning rules, if those rules remain valid after the multi-staff model is redesigned.
- Generation increment as the final database mutation.
- One commit or complete rollback.

Do not use one generic `jsonb_populate_record` or dynamic table-name writer. Use explicit functions/typed parameters or fixed table mappings with per-table column allowlists.

### 4.3 Direct business operations

A full-sync RPC alone is insufficient. Convert multi-request eager writes to operation-specific RPCs, each performing all related work in one transaction. Initial groups:

- Sales: sale header, sale lines, stock effects, customer credit, cheque linkage, and any applicable textile effects.
- Purchases/GRNs: purchase header, lines, stock receipt, supplier payable and cheque/ledger effects.
- Purchase orders/receiving: PO header/lines, received quantities, stock movements, and related job allocation.
- Customer/supplier/contractor payments: payment record and corresponding balance/ledger changes.
- Banking: account transaction/transfer and both affected account balances.
- AC jobs: job header, items, status history, contractor effects, and inventory movements where applicable.
- Deletes: parent and dependent rows plus any required reversals, in one operation.

Simple one-row CRUD may remain direct only after proving that its triggers and RLS are sufficient and that it cannot participate in a multi-request invariant. All writes must still contend on the same organisation row lock if they can overlap a full snapshot.

### 4.4 Multi-staff and snapshot semantics

Do not treat a full local `AppData` snapshot as authoritative for all rows in a multi-staff organisation. Skipping deletes is not enough: stale local rows can still overwrite newer cloud rows.

Before enabling full snapshot writes for multi-staff organisations, introduce a reliable change model (dirty records / operation queue / per-record versions) or explicitly restrict full-snapshot replacement to single-device/single-member organisations. Multi-staff writes should be operation-based and idempotent. Never infer deletion from absence in a potentially stale device snapshot.

## 5. Security and compatibility requirements

- Keep RLS enabled and retain existing table/view policies.
- Preserve `org_member_can_write`, module checks, role checks, subscription checks, and product-limit checks at the database boundary.
- Treat `SECURITY DEFINER` as exceptional. Prefer invoker functions where possible. If a definer function is necessary, pin `search_path`, verify `auth.uid()`, explicitly authorize the organisation and operation, revoke execute from `PUBLIC`/anon, and grant only to `authenticated`.
- Do not grant authenticated users direct access to masked base tables that is currently revoked.
- Preserve view triggers and business triggers. Do not silently replace them with unguarded base-table writes.
- Preserve server-owned fields (profit, buy-price protections, balances, receipt authority, created/updated user stamps) according to existing trigger behaviour.
- Validate every row belongs to the RPC's `p_org_id`; reject mixed-organisation payloads.
- Bound payload size and row counts; chunking must happen inside the SQL function without splitting one logical transaction across commits.
- Use stable IDs for idempotent retries. A retry must not double-post stock, cash, bank, or ledger effects.
- Return explicit errors for stale generation, permission denial, invalid payload, and business-rule violations.

## 6. Implementation sequence

### Phase A — complete write-path inventory

- Enumerate every caller of the eager sync and delete helpers.
- Trace each caller back to its local state mutation and identify all related rows.
- Map each affected table to RLS policies, view triggers, table triggers, foreign keys, and module/role rules.
- Mark which fields are client-owned versus server-derived.
- Confirm whether all supported multi-staff flows are intended to share the same local snapshot model.

Deliverable: a checked-in write-path matrix before writing SQL.

### Phase B — database transaction foundation

- Add a small internal transaction-guard helper (not exposed as a general-purpose client API).
- Add generation conflict result conventions.
- Add operation-specific RPC skeletons with explicit authorization and locking.
- Keep old direct paths available behind existing call sites until each RPC has parity tests; do not switch production behaviour prematurely.

### Phase C — migrate business operations

- Implement and test one operation group at a time, beginning with the highest-risk accounting/inventory flows.
- Replace client multi-request sequences with one RPC call.
- Ensure optimistic UI/local persistence still works when the cloud RPC fails; preserve the pending local operation for retry.
- Add an idempotency key or stable operation ID where effects are not naturally idempotent.

### Phase D — migrate full sync

- Implement the typed/allowlisted full-snapshot transaction.
- Integrate generation compare, all writes, line replacement, pruning policy, and generation increment in one transaction.
- Replace the many client-side requests with the one RPC.
- Keep pull pagination and fail-closed read behaviour.
- Re-evaluate whether full snapshot is allowed for multi-staff organisations.

### Phase E — verification and rollout

- Run unit tests, typecheck, lint, production build, and migration static checks in CI.
- Run local Postgres/Supabase integration tests with realistic schema and trigger definitions.
- Only after an explicitly authorised staging environment exists, run authenticated integration tests against it.
- Deploy only after explicit user approval; do not apply the migration to production as part of this PR.

## 7. Required test matrix

| Scenario | Expected result |
|---|---|
| Two full syncs with same expected generation | One commits; the other reports stale without writing |
| Full sync overlaps a sale RPC | Transactions serialize; neither produces partial state |
| Purchase RPC fails after stock validation | Header, lines, stock and ledger effects all roll back |
| Bank transfer fails on second account | Neither account balance nor transfer is partially changed |
| Payment retry with same operation ID | One payment/ledger effect only |
| Full snapshot contains wrong organisation ID | Entire transaction rejected |
| User lacks write permission/module access | Entire transaction rejected |
| Subscription is read-only | Entire transaction rejected |
| Masked-view insert/update | Same existing view trigger and role/module rules apply |
| Multi-staff stale snapshot | Cannot overwrite newer rows or infer deletes |
| Large snapshot | Completes within configured limits or rolls back cleanly |
| Pull page fails | No partial snapshot is returned to the caller |
| RPC unavailable or generation invalid | Client fails closed and retains local data |

## 8. Free development and verification

No paid Supabase branch or new project is required for the planning and source-code work.

Use the existing GitHub branch and CI. For database tests, prefer a local Supabase CLI/Postgres environment using migration files and disposable local data. Do not connect local test scripts to the production project. If local Supabase is not installed or cannot reproduce the required extensions/triggers, document the gap rather than substituting production as a test environment.

Authenticated staging verification remains a release gate. Without a staging environment, the code can be statically reviewed and locally tested, but it must not be described as fully verified against the live Supabase permission/trigger configuration.

## 9. Release gate

PR #89 remains draft until:

- The write-path matrix is complete.
- Transaction RPCs preserve all current permission and trigger protections.
- Full sync is atomic and generation comparison occurs before writes in the same transaction.
- Direct multi-step business workflows use the same organisation transaction protocol.
- Multi-staff snapshot semantics are safe.
- Required local and authenticated staging tests pass.
- User explicitly approves merge/deployment.

**Current status:** planning only. Existing generation checks, pagination, fail-closed pull behaviour, and local-only record preservation remain useful safeguards, but the cross-request concurrency and atomicity problem is not yet fixed.


## 10. Follow-up source audit — direct writes do not participate in generation

A fresh source scan of `business-sync.ts` confirms that `advanceOrgSyncGeneration` is called only from the full-snapshot `pushBusinessData` path (two branches: multi-member completion and single-member completion). The eager direct-write helpers do not advance the organization generation.

Consequences:

- The generation bracket added to `pullBusinessData` does not detect direct writes at all.
- Even adding a generation increment after each eager helper would not make a multi-request helper atomic: a pull could overlap its intermediate requests before the final increment.
- A pre-increment plus post-increment is also insufficient as a lock; the pull can start after the pre-increment and still overlap the writer.
- Do not patch this by sprinkling generation increments through client helpers. It would create more version churn without providing transaction isolation.

### Next implementation unit

The first database implementation should be a narrowly scoped, operation-specific transaction primitive for one well-understood workflow, not a generic snapshot writer. Before choosing that workflow, finish the migration-level trigger and policy trace for its affected tables and add local Postgres integration tests. The transaction must lock the organization row before reading the expected generation, perform the allowlisted writes, and increment generation in the same transaction. The full-snapshot RPC and every multi-request direct operation must ultimately use the same organization-row lock so their commits serialize.

**Status:** source-audit finding only. No SQL or live database changes were made. Existing direct writes remain outside the generation protocol; PR #89 must remain draft.

## 11. Customer-payment transaction contract — first operation candidate

A focused trace of the current customer-payment flow identifies both the missing cloud-side effect and the authorization contract. This is a source/migration audit only; no SQL or live database changes were made.

### Current behavior

- The local `recordCustomerPayment` action creates a new payment ID, prepends a payment row, and reduces the selected customer's `creditBalance` with a zero floor.
- The online provider calls `syncCustomerPaymentSnapshot`.
- That helper upserts the `customer_payments` row first, then upserts customer contact/details after removing `credit_balance`.
- The two cloud writes are separate requests. The payment can persist even if the second request fails.
- Omitting `credit_balance` is necessary to prevent a stale device snapshot from overwriting the financial balance, but this helper has no server-side balance-decrement operation. The current path therefore does not mirror the local payment's balance effect to the cloud.
- The full snapshot writer also upserts payment rows separately from customer rows; it must not become an alternate way to apply financial balance effects.

### Existing schema and permission evidence

- `public.customer_payments` has a text primary key, organization ID, customer ID, customer name, positive-intended numeric amount, payment timestamp, method and note. Its customer foreign key is not a composite organization/customer constraint.
- `public.customers.credit_balance` is numeric(14,2), non-null, default zero.
- The role-aware RLS migration grants customer-payment insert/update/delete to owner, manager, data_entry and cashier when `org_member_can_write_module(organization_id, 'customers')` and `org_member_role_in(...)` both pass.
- The customer table has its own role/module write policies. The RPC must retain the same role and module semantics rather than accepting a caller-supplied actor identity.
- The source audit did not find a customer-payment trigger that adjusts customer credit balance. Do not assume a trigger supplies the missing effect.

### Required RPC contract before switching the client

1. Accept a stable payment ID (the current payment row ID can serve as the idempotency key), organization ID, customer ID, amount, method, timestamp and note. Do not accept a client-computed resulting balance.
2. Require an authenticated actor; validate the existing Customers module and role permissions in the database operation.
3. Lock the organization coordination row first, using the same lock protocol intended for full sync and other domain RPCs. Compare the expected generation while holding the lock.
4. Verify that the customer exists in the supplied organization. The existing foreign key alone does not prove this because it references customer ID only.
5. Validate amount is finite and greater than zero, and validate method against the app's supported payment methods.
6. Insert the payment and reduce `customers.credit_balance` by the amount with a zero floor in the same PostgreSQL transaction. A failure in either mutation must roll back both.
7. Make retries idempotent: if the payment ID already exists for the same organization and identical immutable payload, return the original success without reducing the balance again. If the ID exists with a different customer or payload, reject it as an idempotency conflict.
8. Advance the organization generation in the same transaction. Never use a post-commit client-side generation compare as a substitute.
9. Return a structured result that distinguishes committed, already-committed, stale-generation, permission-denied, validation and idempotency-conflict outcomes.

### Client migration and tests

- Keep local-first behavior: the local payment remains saved when cloud posting fails, and the same stable payment ID is retried.
- Replace the current two-request helper with exactly one RPC call. Do not follow it with a customer snapshot that could overwrite financial state.
- Ensure full-snapshot sync cannot independently apply payment effects or overwrite `credit_balance`; the transaction RPC is the only online posting path for new customer payments.
- Add local PostgreSQL tests for successful posting, duplicate retry, conflicting reuse of payment ID, wrong-organization customer ID, missing auth, each disallowed role/module case, invalid amount/method, rollback on customer update failure, and two concurrent payments against one customer.
- Add client tests proving a failed RPC retains the local payment and retry reuses the same payment ID.

**Implementation decision:** customer payment is a suitable first domain operation because its schema and role policy are comparatively narrow, but it must not be switched to a new RPC until the shared organization-lock/generation contract and local database test harness are in place. No production migration, RPC deployment or data mutation is authorized by this audit.

## 12. Shared organization transaction-lock contract

The existing generation migration confirms that `sync_generation` is stored directly on `public.organizations`. The current `try_advance_org_sync_generation` performs a conditional `UPDATE` only when called, after the client has already sent its business-table writes. That update acquires a row lock too late to protect those earlier requests. It is an optimistic compare-and-increment, not a transaction entry lock.

### Required transaction sequence

Every future operation RPC that mutates synchronized business data must follow the same in-transaction sequence:

1. Reject a null `auth.uid()`; never accept a caller-supplied user ID as the actor.
2. Acquire `SELECT ... FOR UPDATE` on the matching `public.organizations` row. Do not expose a standalone “lock organization” RPC: a lock released at the end of that RPC cannot protect later client requests.
3. While holding that lock, validate organization membership, subscription write status, module permission and the operation-specific role allowlist. Reuse the existing authorization helpers only after verifying their definitions and behavior against the target migration set.
4. Read `sync_generation` from the locked row and compare it with the caller's expected generation. A mismatch returns a stale result before any business write.
5. Validate all IDs and organization ownership, then perform the allowlisted operation writes.
6. Increment `organizations.sync_generation` exactly once in the same transaction and return the committed generation/result.
7. Let any exception roll back both business writes and the generation increment.

### Lock ordering and compatibility

- The organization row is the outer coordination lock. Every transaction-aware business writer and the future full-snapshot transaction must acquire it before locking customer, sale, inventory, bank or other domain rows.
- Domain rows should then be locked in a deterministic order (for example, sorted IDs) to reduce deadlocks when an operation touches more than one row.
- Do not add a second, independent per-customer lock protocol that can be acquired before the organization lock; that creates inconsistent lock ordering between payment and full sync.
- The legacy `try_advance_org_sync_generation` RPC must not be treated as transaction protection. Once all writers have migrated, deprecate it or restrict its role to an explicitly documented compatibility use.
- A transaction-aware writer cannot serialize with a legacy multi-request writer merely by taking the organization lock. Until all writers—including full snapshot push and eager direct-write helpers—use the same lock in their own database transaction, mixed old/new operation concurrency remains unsafe.
- Keep the current client path unchanged until the RPC is deployed to an authorized staging environment and concurrency/authorization tests pass.

### Migration review findings

- The current generation helpers are `SECURITY DEFINER` functions in `public`, with `search_path = public`; their execute privileges are revoked from `PUBLIC` and granted to `authenticated`.
- The existing `try_advance_org_sync_generation` checks `org_member_can_write` but does not itself compare the generation before the caller's preceding multi-request writes. It also does not apply the operation-specific module/role policy by itself.
- Any new privileged RPC requires an explicit `auth.uid()` check, strict organization membership and role/module checks, a fixed safe search path, narrowly scoped grants (revoke from `PUBLIC` and `anon`; grant only to `authenticated` where appropriate), and security-advisor review. Do not add a generic arbitrary-table writer.
- No migration has been applied to the linked database. This section records the required protocol and source findings only.

## 13. Live schema and policy verification for customer-payment RPC

A read-only catalog audit was run against the linked LakBiz Supabase project `nexus-erp` (PostgreSQL 17). No rows were read from customer or payment business tables, and no database writes were issued.

### Confirmed live schema

- `organizations.sync_generation` exists as `bigint NOT NULL DEFAULT 0`.
- `customers.id` and `customer_payments.id` are text primary keys; both tables also carry a non-null organization UUID.
- `customers.credit_balance` is `numeric NOT NULL DEFAULT 0`.
- `customer_payments.amount` is `numeric NOT NULL`; payment_date is timestamptz; method is text with default `cash`.
- The customer payment foreign keys separately reference `customers(id)` and `organizations(id)`. They do not enforce that the referenced customer belongs to the same organization as the payment. The RPC must explicitly validate that relationship.
- The only customer trigger found is the generic `BEFORE UPDATE` updated_at trigger. No payment trigger changes credit_balance.
- There is no database CHECK constraint on payment amount or method in the inspected table constraints. The RPC must enforce both.

### Confirmed live authorization

- Customer-payment INSERT, UPDATE and DELETE policies require `org_member_can_write_module(organization_id, 'customers')` and role in owner, manager, data_entry or cashier.
- Customer-payment SELECT additionally checks organization membership and the same role allowlist.
- `org_member_can_write_module` checks membership plus `org_has_module`; it does not itself enforce the subscription write gate.
- `org_member_can_write` checks membership plus `org_can_write`.
- `org_member_role_in` compares the authenticated user's membership role. The RPC must require non-null `auth.uid()` and apply all three checks: `org_member_can_write`, module access, and the role allowlist. Do not rely on module access alone for subscription write authorization.

### Implementation implications

- Keep the payment ID as text in the RPC signature to match the existing client-generated IDs and table primary key.
- Validate the payment's customer ID and organization together with an explicit `customers.id = p_customer_id AND customers.organization_id = p_org_id` lookup under row lock.
- Use the actual client PaymentMethod allowlist: `cash`, `bank_transfer`, `card`, `cheque`.
- Reject non-finite, zero and negative amounts before writing.
- Idempotency lookup must compare the full immutable payment payload. A matching existing payment returns the existing committed result without a second balance decrement; a mismatched payload using the same ID is rejected.
- The organization lock remains the outer lock; lock the customer row after it. All competing financial writers must eventually follow the same order.
- The live database has not been changed. The RPC and test suite remain unimplemented pending a local/staging migration workflow where the full authorization, retry and concurrency behavior can be executed safely.

