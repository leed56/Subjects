# Phase 2 — opt-in new-sale ledger bridge

## Status and boundaries

Implemented on the draft enhancement branch. Migration `20261011151158_sale_ledger_bridge.sql` has **not been applied to the connected live database**. Applying it requires separate user approval. It creates no accounts, imports no history and defaults to off for every organization. After installation, an authenticated owner with an active banking entitlement must initialize the standard chart and explicitly acknowledge the revenue-only scope to enable new-sale capture.

This is not full ERP accounting or production certification. Do not treat revenue-only ledger earnings as complete profit. COGS, inventory carrying values, opening balances, purchases, imports, expenses, returns, refunds, customer collections, card settlement and bank reconciliation are excluded. Manually posting the same sale under a separate manual key can still double-count it; the owner acknowledgement calls this out. Only same-source retries are duplicate-safe.

## Posting contract

The bridge captures an event on insertion into `sales_base`, only when the organization's setting is enabled. A deferred constraint trigger processes the event at transaction completion, after the existing POS finalizers have written normalized `sale_tenders`. This matters because the v3 transfer fallback temporarily uses a card classification before rewriting the final tender to bank transfer. Existing POS functions and their stock/customer/bank operations are not replaced or rewritten.

| Saved tender | Debit account | Credits |
| --- | --- | --- |
| Cash | 1000 Cash | 4000 Sales revenue: saved subtotal; 2100 Output VAT: saved VAT |
| Card | 1020 Card clearing | Same authoritative saved invoice values |
| Bank transfer | 1010 Bank control | Same authoritative saved invoice values |
| Credit | 1100 Customer receivables | Same authoritative saved invoice values |
| Cheque, return credit, missing or invalid evidence | No journal | Owner review event with reason |

Mixed supported tenders aggregate by account. Invoice totals and tender amounts must be positive, exact two-decimal LKR values within the existing ledger limits; subtotal plus VAT and tenders must equal the saved total. VAT is not recalculated. Journal dates use the saved sale timestamp in Asia/Colombo. Sources without an authenticated authorized POS actor, active banking entitlement or required chart accounts go to review.

Sale capture, posting and source writes share the same transaction. Expected unsupported sources create a review event and allow the sale to commit. Unexpected database/posting errors abort the entire transaction rather than silently losing a journal. Existing POS idempotency plus unique organization/sale events and server-owned source keys prevent retry duplication. There is no historical replay or review-resolution RPC in this phase.

## Owner UI

The authenticated accounting workspace adds a light-card integration control, explicit scope acknowledgement, enable/disable action, authoritative status refresh, latest 50 captured sales and a separate latest-50 review filter. The review badge counts all review events, not merely the displayed page. Posted events link to journal lines. Reports refresh separately. Missing migrations and permission/count errors remain visible instead of being represented as empty successful results. Controls are disabled offline or without writable owner/banking access. Tenant/role changes remount the workspace and stale reads are ignored.

New integration labels remain English; full Sinhala/Tamil localization remains pending. Existing public industry demos and showcase logins do not activate or exercise this production adapter.

## Access and immutability

Both new public tables enable RLS with owner-only reads. Anonymous access and authenticated direct writes are revoked. The settings RPC intentionally uses SECURITY DEFINER to change the otherwise read-only setting; it validates the real authenticated owner and active banking entitlement, has an empty search path and denies anonymous execution. The posting, capture and guard functions are in a non-exposed private schema with app execution revoked. Source payloads are read from saved database rows, not a browser-supplied accounting payload.

Owners cannot insert `sale:` journal headers through their normal manual-journal policy. Posted sale totals/date/bill identity and tender evidence cannot be edited, moved, added or deleted. Unrelated credit settlement metadata remains writable by existing authorized workflows; it is not automatically journaled. Foreign keys retain captured sources, including review sources. Reversal and controlled retention/deletion workflows remain pending.

## Verification and release gate

Local verification on 11 October 2026: `npm run verify` passed (311 tests across 40 files; TypeScript, translation-key parity and 322-route production build). Lint has six pre-existing warnings and no errors. The foundation fixture passed 22 checks and the sales bridge fixture passed 31. These are local/isolated results; the new authenticated deployed browser flow is not certified.

`scripts/verify-sale-ledger.mjs` runs both ledger migrations in isolated PGlite with fixture users, memberships, entitlements and a simplified transactional POS writer. It verifies disabled defaults, explicit owner opt-in, no backfill, tender mappings, final classification, exact balancing, source retry, source rollback, private-function restrictions, immutable sources, tenant/role isolation and expired entitlement review. It is a contract fixture, **not an execution of the complete live POS functions** and not a concurrent multi-session test. No live sale, journal or integration setting is written by this verification.

Run from `lakbiz/app`, pointing at a disposable, version-pinned PGlite installation:

```bash
LEDGER_TEST_MODULE=/path/to/disposable-pg-test/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-general-ledger.mjs
LEDGER_TEST_MODULE=/path/to/disposable-pg-test/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-sale-ledger.mjs
npm run verify
```

Before live installation: verify foundation/source schemas, helper definitions, source-key constraint/policy names, existing source-key compatibility and grants. After authorized installation: inspect migration history, RLS, grants and advisors; verify no organization is enabled. Before enabling any real company: certify the complete authenticated POS flow on an isolated staging database, including stock-failure rollback, cash/card/credit/bank/unsupported tenders, retries, concurrent checkout/settings changes, expiry and protected-source edit behavior. The prior public deployed UI QA screenshots do not cover this authenticated feature.

Read-only live security advisors on 11 October 2026 still reported existing security-definer views, authenticated-callable definer functions and disabled leaked-password protection. This uninstalled migration is not covered by that report. Intentional RPC warnings require per-function authorization review; unrelated existing findings were not changed. Remediation references: [view security](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [definer RPC access](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Next architecture work

1. Staging certification and explicit live migration approval; owner enablement remains a separate decision.
2. Authoritative inventory cost layers and COGS posting with reconciliation, not a guessed value from existing `profit`.
3. Purchase/receipt/payables and expense adapters.
4. Returns, credit notes, controlled reversals and settlement/collection adapters.
5. Review resolution, complete queue pagination, accounting periods, closing and period financial statements.
6. Remaining premium production-page alignment, complete localization and industry-specific operational certification.
