# Stock history protection and fresh backup — 28 October 2026

**Review branch evidence; production remains blocked.** No live migration or
test-shop write was performed. Completed sale-header/line protection and
atomic legacy stock-correction sync remain separate unresolved work.

## Coordinated stock-history correction

- Snapshot sync appends stock movements with stable IDs and `ON CONFLICT DO
  NOTHING`. It confirms the recorded payload inside the current shop, rejects
  altered history and does not report an invisible foreign-shop ID as success.
- Reads and writes are bounded for large snapshots. Equivalent decimal and
  timestamp encodings do not create false conflicts. An interrupted write or
  confirmation read can be retried without rewriting a prior event.
- Full snapshot sync never prunes stock history, including in a single-owner
  shop. Historical rows missing from a browser cache remain on the server.
- The reviewed migration removes ordinary clients' UPDATE, DELETE and TRUNCATE
  permissions and UPDATE/DELETE policies. A base-table trigger also rejects
  UPDATE/DELETE through privileged functions. Corrections and returns append
  new events. Migration application changes no existing stock-log row.
- This is **not** an atomic rewrite of every legacy stock operation. Existing
  product-plus-log saves still span requests. Completed sales/lines also have
  their previously documented mutation/snapshot issue. Do not mark those gates
  closed because this narrower protection passes.

## Verification

Eight new tests cover retries, altered history, cross-shop confirmation,
equivalent database values, interrupted writes/reads, invalid scopes, bounded
large snapshots and a stale single-owner cache that cannot prune history.
`npm run verify` passes with 45 files / 289 tests, typecheck, the existing
translation baseline, and production build. Lint has 11 existing warnings and
zero errors.

`scripts/qa-stock-movement-history.sql` refuses remote databases and any local
database except `lakbiz_staging` or `lakbiz_staging_fresh`. It rehearses the
catalogue and stock-history migrations in a transaction and rolls back:

- unchanged fingerprint of all existing stock-log rows after migration;
- owner and cashier UPDATE/DELETE denial, TRUNCATE denial, and trigger-level
  denial even for the privileged connection;
- actor stamping, duplicate-ID preservation, cross-shop read/insert isolation;
- owner-only catalogue readiness plus 36/9 imports and zero additions on retry;
- 45 inactive, unpriced, zero-stock, barcode-free template records;
- cashier checkout and retry: stock 10 → 9, one sale movement;
- owner-approved return and retry: stock 9 → 10, one return movement, original
  sale line unchanged.

The real PostgreSQL rehearsal passed against both the older local restore and
today's fresh restore. These are SQL integration checks, not an authenticated
Supabase browser journey or physical scanner/printer verification.

## Fresh backup and restore proof

The owner entered the password into the local native prompt. The backup
completed; its optional checksum step initially failed because that shell did
not provide `Get-FileHash`. The archive was reused without requesting another
password. The helper now computes SHA-256 using the .NET runtime.

- File: `lakbiz-release-20261028-140643-45b69972.dump` (2,337,544 bytes), stored
  privately under `C:\subject\.lakbiz-backup-tools`, outside the release diff.
- SHA-256: `1F3BB037F78CC143FE54806ED8EE56ED5C5FF8E09C01D041F756032108DE134D`.
- `pg_restore --file=NUL` read the entire archive successfully. The adjacent
  `.proof.json` records its path, checksum, timestamps and verification scope.
- Restored into loopback-only PostgreSQL 17 database `lakbiz_staging_fresh`.
  Application restore and permission restoration completed without errors:
  **107 public tables, all 107 with RLS; 81 migration-history entries**.
- Supabase Vault extension objects were excluded because that extension is
  unavailable in this Windows runtime. A read-only query of the actual project
  found **zero Vault secrets**. Auth/PostgREST service configuration and a full
  Supabase-environment disaster recovery drill remain unverified. The proof
  deliberately retains `fullRestoreTested: false`.

## Catalogue preview evidence

Commit `89443a75f76a4e70a838fc446dcbe787c9e9e5ad` passed GitHub verification,
the 28-case deployed template-isolation check and Vercel deployment.
The catalogue browser fixture check passed at 1280px/390px in EN/SI/TA on
that exact preview. All Supabase requests were intercepted: pending buttons
were disabled, no readiness check imported products, the outstanding import
stayed disabled, and a missing-function response revealed no raw SQL error.
The fixture is not a cloud import. The actual project's two import functions
and readiness function were confirmed absent by a read-only query.

Install the catalogue migrations only through the reviewed database release
process. Keep their owner opt-in behavior. Preserve real shops and never use
their records for write tests.
