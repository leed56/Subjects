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

## 14. Customer-payment client integration audit

The customer payment UI and local action were traced through the current branch.

### Confirmed client behavior

- The customer payment dialog uses `PAYMENT_OPTIONS.filter((m) => m !== "credit")`. The accepted receipt methods are therefore exactly `cash`, `bank_transfer`, `card`, and `cheque`. The shared `PaymentMethod` type also contains `credit`, but it is intentionally excluded from this receipt dialog. The RPC must reject `credit`.
- `recordCustomerPayment` generates a new local payment ID, records customer name/date/method/note, and reduces local credit balance with `Math.max(0, balance - amount)`.
- The online provider persists the local state first, then calls `syncCustomerPaymentSnapshot(organizationId, next, paymentId)`.
- The current cloud helper performs two independent upserts: first `customer_payments`, then customer details with `credit_balance` omitted. It does not apply the payment to the server-side credit balance.
- If the payment upsert succeeds but the customer-details upsert fails, the helper returns an error and the provider schedules a general cloud push. The payment ID is already stored in local AppData, which is useful for retry, but the current direct helper has no transactional exactly-once balance effect.
- If the first payment upsert fails, the provider also schedules a general cloud push. This is an additional reason to ensure snapshot reconciliation cannot independently reapply payment balance effects after the atomic RPC is introduced.

### Required migration boundary

1. Keep the existing client-generated payment ID and pass it unchanged to the RPC for online writes and offline retries.
2. The RPC method allowlist is the four UI receipt methods above; do not accept the broader TypeScript union value `credit`.
3. Move online persistence to one atomic RPC call. Do not call the legacy two-upsert helper after the RPC.
4. Preserve local-first behavior while offline, but queue/retry the same payment ID and immutable payload. Do not manufacture a new ID on retry.
5. Make general snapshot push incapable of changing customer credit balance or creating a second financial effect for a payment already committed through the RPC.
6. The existing UI currently reports the local action as successful before cloud persistence completes. Keep the user-facing distinction clear: local/offline saved versus cloud committed; do not display a cloud success until the RPC confirms it.
7. Preserve the current zero-floor balance behavior unless a separately approved accounting rule changes overpayments. The database transaction must lock the customer and calculate the balance from the server's current value, never from the stale client snapshot.

### Current implementation status

This section is a source audit only. The legacy helper and provider are not changed yet. No RPC migration has been created or applied, and no production database writes were made.

## 15. Atomic customer-payment RPC design — implementation gate

The source and live catalog audits are sufficient to define the transaction shape, but not yet to safely ship the function.

### Transaction contract

Proposed signature (not created yet):

`public.record_customer_payment_atomic(p_org_id uuid, p_payment_id text, p_customer_id text, p_customer_name text, p_amount numeric, p_payment_date timestamptz, p_method text, p_note text)`

The function should be a single transaction with this order:

1. Require a non-null `auth.uid()`.
2. Lock the matching organization row using `SELECT ... FOR UPDATE`; fail if it does not exist.
3. Require `org_member_can_write(p_org_id)`, `org_member_can_write_module(p_org_id, 'customers')`, and `org_member_role_in(p_org_id, array['owner','manager','data_entry','cashier'])`.
4. Validate nonblank payment/customer IDs, positive finite amount within `numeric(14,2)`, and method in `cash`, `bank_transfer`, `card`, `cheque`. The UI excludes `credit`.
5. Check for an existing payment ID in the same organization. If the immutable payload matches, return an idempotent replay result without another balance decrement. If it differs, reject ID reuse. A same ID owned by another organization must not be exposed or modified.
6. Lock the customer row using both customer ID and organization ID. Reject missing or cross-organization customer.
7. Insert the payment row and update `customers.credit_balance = greatest(0, credit_balance - p_amount)` and `updated_at = now()`.
8. Increment `organizations.sync_generation` exactly once, in the same transaction, and return the new generation and resulting balance.

The organization lock is always acquired before the customer lock. Any other transaction-aware organization writer must use the same outer lock. Legacy multi-request writers are not made safe merely by this RPC existing.

### Important unresolved correctness points

- **Payment timestamp equality:** The local client stores an ISO timestamp, but Postgres `timestamptz` normalizes instants. Idempotency comparison should compare timestamp instants, not raw string formatting.
- **Customer name:** The UI stores a customer-name snapshot in the payment row. Decide whether RPC accepts it as an immutable historical snapshot or derives it from the locked customer row. Deriving it server-side avoids spoofed/mismatched names and remains consistent with the existing local action at time of payment only if the UI sends/validates the expected name.
- **Cross-organization duplicate ID:** Because `customer_payments.id` is globally primary-keyed, duplicate detection must avoid leaking another organization's payment details. Reject generically if the ID is already occupied by a row outside this org.
- **Overpayment:** Preserve the existing zero-floor behavior; do not reject payment amounts greater than current balance without a product decision.
- **Customer balance writers:** Credit-sale creation and any other customer balance mutations must be audited and migrated to the same organization-then-customer lock protocol. Otherwise a payment-only lock cannot prevent lost updates from legacy writers.
- **Snapshot push:** The full-snapshot path and direct customer upsert paths must be checked to ensure they cannot overwrite `credit_balance` or reapply the same payment. A safe RPC alone does not complete the whole migration.

### Test gate before migration rollout

Automated database tests must cover: auth missing; membership missing; subscription suspended; module disabled; disallowed role; valid payment; duplicate identical retry; conflicting ID reuse; cross-org customer; globally colliding ID; zero/negative/NaN/infinite/overflow amount; unsupported method; rollback after a forced failure; two concurrent payments; and interaction with concurrent credit-sale updates.

No migration or RPC was created or applied in this step. The repo currently exposes no verified local Supabase test harness from the inspected paths, and the linked live database is not a safe test target. The next implementation step is to establish an isolated local/staging test database and test harness, then implement and verify the migration there.

## 16. Live sale-credit transaction discovery — supersedes assumptions in Section 15

A read-only inspection of the linked `nexus-erp` database on 2026-10-30 found an existing, production-installed transaction that already handles customer receivable increases for POS sales. This materially changes the payment-RPC design.

### Existing sale transaction

- The live database has `public.finalize_sale_with_tenders(uuid,text,text,text,numeric,jsonb,jsonb)`.
- It acquires `SELECT ... FROM public.organizations ... FOR UPDATE` before processing the sale.
- When a customer is supplied, it locks that customer row with `FOR UPDATE` and checks the organization ID.
- It validates the credit tender against the customer's current balance and credit limit.
- It inserts the sale, lines and tenders, applies `customers.credit_balance = credit_balance + v_credit_amount`, and increments `organizations.sync_generation` before returning.
- The function is a single Postgres transaction; failures roll back the sale and related effects together.
- The live wrapper `finalize_sale_with_private_tenders` routes new sales into this finalizer and includes the same organization-scoped permissions and tender processing.

This confirms the sale side already follows the organization-then-customer lock order required for a safe customer payment. The payment transaction must follow that exact order; it must not introduce a different lock order.

### Revised customer-payment implementation direction

Section 15's proposed RPC signature is only a preliminary design and must not be implemented verbatim. Before writing the migration:

1. Match the live sale finalizer's permission checks and lock order: organization row first, then customer row.
2. Verify the client currently deployed on this PR branch calls the correct live finalizer version, and verify the exact RPC contract and response shape.
3. Add a customer-payment transaction that is idempotent on the client-generated payment ID, validates the immutable payload, locks organization then customer, inserts the payment, applies the existing zero-floor receivable reduction, and increments generation once.
4. Make the payment replay path return without repeating the balance reduction.
5. Confirm that all other live functions that mutate `customers.credit_balance` use compatible locking and are included in the transaction audit. The read-only search also found return-settlement and textile cheque-exception paths that update this field; they need review before declaring customer receivables fully serialized.
6. Keep full-snapshot sync from overwriting `credit_balance`, and migrate the two-request payment client helper only after the RPC and tests are in place.

### Scope and safety

- Read-only database catalog/function inspection only; no business rows were read.
- No SQL migration, RPC, or production data was changed.
- The live database already contains many migrations beyond the earlier source snapshot, including POS tender/atomic-sale and general-ledger migrations. The repository migration history and deployed client must be reconciled before generating a new migration; do not assume the old schema-only audit describes the whole live system.
- Supabase's current recommended local database testing path is the CLI with pgTAP: start the local stack, then run `supabase test db`. The official documentation states tests run in individual transactions and roll back. Source: https://supabase.com/docs/guides/local-development/testing/overview and https://supabase.com/docs/reference/cli/supabase-test-db.

## 17. POS lock-order verification and remaining customer-balance writers

A second read-only inspection retrieved the complete live definitions of the POS sale functions and searched the live public functions that reference `customers.credit_balance`.

### Confirmed POS behavior

- `public.finalize_sale_with_tenders` checks the sales module and the owner/manager/data_entry/cashier role allowlist.
- It locks the organization row with `FOR UPDATE` before the customer row.
- It then locks the selected customer with `FOR UPDATE`, scoped by both customer ID and organization ID.
- It validates the credit limit using the locked customer's current `credit_balance`.
- It applies the credit-sale increment and increments organization sync generation in the same function transaction.
- `public.finalize_sale_with_private_tenders` is a wrapper that performs POS tender normalization and delegates to the finalizer. It does not itself acquire the organization lock before its preliminary customer lookup; the underlying finalizer still takes the organization lock and re-reads/locks the customer before changing balance. The preliminary read is not used to calculate the credit balance.

### Other live functions found referencing customer credit balance

1. `public.apply_sale_return_exchange`: locks the replacement sale and return-related records, then locks the customer and reduces credit balance; it increments organization generation. It does not visibly take the organization coordination lock first in the inspected definition.
2. `public.settle_sale_return_credit`: locks return records and then customer before receivable reduction; generation advances for receivable reduction and bank refund. It does not visibly take the organization lock first.
3. `public.transition_textile_cheque`: locks cheque, then reads linked sale, then increases customer credit balance on bounced/returned received cheques. It does not visibly take the organization lock first or increment organization generation in the inspected definition.
4. `public.finalize_textile_sale_v4`: locks the customer for credit/cheque validation, then delegates to `finalize_textile_sale_v3`; the wrapper itself does not visibly acquire the organization lock before that customer lock. The delegated transaction implementation needs separate lock-order verification.
5. `public.finalize_sale_with_tenders`: confirmed organization-first then customer lock as described above.

The search also found `public.allocate_textile_customer_payment`, which locks the payment and textile receivables but does not itself change `customers.credit_balance`; it allocates an already-recorded payment to textile receivables and requires owner/manager role.

### Important correction to the shared-lock conclusion

The POS finalizer is a good reference for customer payment, but **not every live customer-balance writer follows the same visible outer organization-lock protocol**. A new payment RPC that locks organization then customer will serialize correctly with the POS finalizer, but it does not by itself serialize safely with legacy return and textile cheque paths that lock domain rows/customer without first acquiring the organization lock. These writers must be migrated or proven safe through their complete call graph before claiming a globally consistent lock protocol.

### Customer-payment client integration details

The branch's `recordCustomerPayment` creates a stable payment ID in local state, stores the customer name snapshot, amount, ISO timestamp, method and note, and subtracts locally with a zero floor. The current cloud helper still uses two PostgREST upserts: payment ledger first, then customer details with credit balance omitted. The provider schedules a general snapshot push after the helper succeeds or fails. This is still the precise client migration point; no code path has been changed in this audit.

### Safe next step

Before adding the new RPC, inspect and reconcile the complete definitions/call graphs for the return-settlement and textile cheque functions above, including their callers and any nested functions. Then implement a coordinated lock-order migration for all writers in one tested migration set, or formally isolate the first RPC rollout to organizations/features where those legacy writers cannot run. Do not deploy a payment-only lock and claim all customer receivables are concurrency-safe.

## 18. Stop-ship finding: deployed migration history is ahead of this repository branch

A further comparison of the linked Supabase migration history with `lakbiz/supabase/migrations` on this PR branch found substantial source/deployment drift.

- The linked database reports migrations through `20261011094954_general_ledger_foundation`, including the August 2026 sale-return, safe-exchange, POS tender, textile atomic-sales, textile-credit and cheque-related migrations.
- The PR branch's migration directory contains 66 files and its latest migration is dated 2025-07-14 (`20250714000002_expenses_parts_purchase_category.sql`). It does not contain the live 2026 migration set.
- The live function definitions inspected for `apply_sale_return_exchange`, `finalize_textile_sale`, `finalize_textile_sale_v2`, `finalize_textile_sale_v3`, `finalize_textile_sale_v4`, `finalize_sale_with_private_tenders`, and `finalize_sale_with_tenders` therefore cannot be safely recreated or replaced by editing the old branch migrations in isolation.
- The inspected `apply_sale_return_exchange` function already has settlement-ID replay handling, locks return/replacement/customer records, adjusts customer balance, and increments generation, but the visible lock order is not organization-first.
- The live textile finalizer chain has multiple wrappers. `finalize_textile_sale_v4` performs customer-related pre-validation before delegating to the lower textile sale chain; that chain ultimately calls the shared POS finalizer. Any lock-order correction must preserve its reservations, roll stock, pricing, tender, and replay behavior.
- The full definitions/call graph of `settle_sale_return_credit` and `transition_textile_cheque` still require extraction and review before a replacement can be safely authored. A partial replacement would risk dropping existing financial, textile, or authorization behavior.

### Required action before production-safe code changes

1. Reconcile the missing live migration history into the repository from the authoritative deployment/source of truth, preserving exact migration order and versions.
2. Recover the complete definitions and grants for all customer-balance writers and their wrappers/triggers.
3. Build local PostgreSQL tests against that reconciled schema, including concurrent POS sale/payment/return/cheque cases and replay/idempotency.
4. Only then create a forward migration that changes all required lock orders and adds the customer-payment RPC; migrate the client to that exact RPC contract.
5. Verify grants, RLS/module/role/subscription checks, SECURITY DEFINER search paths, and function execution privileges before considering deployment.

**Current decision:** no speculative replacement functions or migration were added. The branch does not contain the deployed schema foundation needed to make a complete, safe financial fix. No live database changes were made. This is a stop-ship compatibility blocker, not a claim that the financial paths have been fixed.



## 19. Live routine privilege and call-chain verification

A further read-only catalog pass retrieved exact routine signatures, security attributes, configuration, ACLs, and definition lengths for the remaining financial writers and textile sale chain.

### Routine security and execute grants

All nine inspected routines are SECURITY DEFINER with search_path=public:

| Routine | Authenticated EXECUTE | service_role EXECUTE | PUBLIC/anon grant visible |
|---|---:|---:|---:|
| apply_sale_return_exchange(uuid,uuid,uuid,text) | Yes | Yes | No |
| settle_sale_return_credit(uuid,uuid,uuid,text,numeric,text,text,text) | Yes | Yes | No |
| transition_textile_cheque(uuid,text,text) | Yes | Yes | No |
| finalize_sale_with_tenders(uuid,text,text,text,numeric,jsonb,jsonb) | No | Yes | No |
| finalize_sale_with_private_tenders_v3(uuid,text,text,text,numeric,jsonb,jsonb) | Yes | Yes | No |
| finalize_textile_sale(uuid,text,text,text,numeric,jsonb,jsonb) | Yes | Yes | No |
| finalize_textile_sale_v2(uuid,text,text,text,numeric,jsonb,jsonb) | Yes | Yes | No |
| finalize_textile_sale_v3(uuid,text,text,text,numeric,jsonb,jsonb) | Yes | Yes | No |
| finalize_textile_sale_v4(uuid,text,text,text,numeric,jsonb,jsonb) | Yes | Yes | No |

The catalog ACLs explicitly listed postgres, authenticated where shown, and service_role; no PUBLIC grant appeared. The base finalize_sale_with_tenders is not directly executable by authenticated clients, while the private-tender facade is. This is an important boundary to preserve when recovering or rebuilding migrations.

### Why the textile wrapper needs special care

The live definitions have materially different sizes and responsibilities: finalize_textile_sale is 8,330 characters, v2 2,568, v3 876, and v4 2,366. They are not interchangeable aliases. The v4 wrapper performs customer/credit/cheque pre-validation and then delegates through earlier textile layers into the private POS tender facade and underlying POS finalizer. A replacement must preserve each layer's reservation, roll inventory, pricing, tender normalization, replay and permission behavior.

### Source recovery status

A follow-up repository search checked the default branch's complete tracked tree for sale-return, textile atomic-sale, general-ledger and cheque migration paths, and checked the dedicated live-schema-drift branch's migration directory. No authoritative copies of the deployed 2026 financial migration files were found there. The PR branch's migration history alone is therefore not sufficient to reconstruct their original source or intended deployment ordering.

### Decision

This remains a read-only audit. No production SQL, grants, functions, data, or migration history were changed. Do not create replacement migrations by guessing from current function bodies: the complete historical migration ordering and dependencies remain unknown. The next safe recovery source must be the original deployment repository/artifact or a verified database backup/source-control export that contains the exact applied migration SQL. Once recovered, validate it in a disposable local database before editing any financial routine.
