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
