# HVAC stock history and backup status — 28 October 2026

The shared snapshot sync now appends stock movements by stable ID without
updating recorded rows, verifies the saved payload inside the current shop,
and never prunes movements absent from a browser cache. The reviewed migration
also removes ordinary UPDATE/DELETE/TRUNCATE privileges and rejects UPDATE or
DELETE at the base table, including through privileged functions. It changes
no existing movement record. Returns and corrections append new events.

Eight tests cover retry/interruption, altered-history rejection, cross-shop
confirmation, database value encodings, batch limits and a stale single-owner
snapshot. `npm run verify` passes: 43 files / 277 tests, typecheck, translation
baseline, production build, zero lint errors and 11 existing warnings.

The actual project's fresh 28 October backup is saved privately under
`C:\subject\.lakbiz-backup-tools`, with a SHA-256 proof beside it. Its complete
archive is readable. The local application restore contains all 107 public
tables with RLS and 81 migration-history entries, with permissions restored.
Vault extension objects were excluded from this Windows restore; a read-only
live check found zero Vault secrets. This is not a full Supabase-services
disaster recovery drill.

The Grocery review's `scripts/qa-stock-movement-history.sql`, run with
`fixture_sector=ac_hvac`, passed against that fresh loopback-only restore:
existing-history fingerprint preserved; owner/cashier updates and deletes
denied; cross-shop reads/inserts isolated; real actor recorded; cashier sale
and retry deducted stock once; approved return and retry restored stock once;
one sale movement and one return movement remained durable. All test writes
and migration rehearsals rolled back. Grocery catalogue files were not added
to the HVAC branch.

**Not installed live and not cleared for production.** Completed sale-header
and sale-line protection, atomic legacy stock correction, authenticated
Supabase staging journeys, native language approval, direct Vercel runtime
logs and a full restore/rollback drill remain unresolved. Scanner and printer
hardware remain unverified. Do not promote or install this migration until
the coordinated application and database release has passed its gates.
