# Optional catalogue deployment gap — 28 October 2026

The Ammar Farm Shop screenshot shows `PGRST202` errors for
`import_grocery_mill_catalogue` and `import_grocery_meat_catalogue`. The
configured database is missing both migrations. Deploying the application
alone does not install those functions.

## Prepared correction

- A read-only, owner-scoped `grocery_catalogue_readiness` function reports
  whether each import exists. It never calls an import or creates products.
- Signed-in grocery owners see a localized pending/connection message and
  disabled imports until availability has been confirmed. Missing functions
  also fail closed when the readiness migration itself has not been applied.
- Import feedback no longer exposes SQL function names or schema-cache errors.
- Cloud imports retain their busy state until the request finishes. A separate
  local-demo queue previously cleared that state prematurely; it now runs only
  for anonymous demos. An in-flight guard also prevents repeated confirmation.
- No catalogue is added automatically. Existing products and other shops are
  untouched. The migrations remain pending deployment.

## Verification

`npm run verify` passes: 43 files / 281 tests, typecheck, translation baseline
and production build. Lint reports the existing 11 warnings and zero errors.
The five new tests cover read-only GET calls, missing functions, denied access,
network/malformed responses and safe import error messages.

`npm run qa:mill:sql` includes the readiness migration before either import,
after the mill import and after the meat import. Each check leaves product
count zero. Cashier access is denied. The existing 36/9 template import,
rollback/retry, product-limit and checkout-guard rehearsals remain included.

`scripts/qa-catalogue-availability.mjs` is a browser fixture check at 1280px and
390px in English, Sinhala and Tamil. It intercepts every Supabase request and
blocks other mutations. It verifies missing-setup rendering and an outstanding
cloud request followed by a missing-function response. It is not an
authenticated staging import or proof of a live database deployment.

## Database release still required

After the backup/restore and staging gates in the release audit are closed,
apply the reviewed mill, meat and readiness migrations to the actual project
`zestppstpwjxriwcuykc`, verify permissions and schema reload, then reload Stock.
An owner may then explicitly import. Do not use real shops for write tests and
do not label this pending setup as production-ready.
