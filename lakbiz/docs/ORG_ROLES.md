# LakBiz org roles (Phase F)

## Roles

| Role | Source | Financials | Team invites |
|------|--------|------------|--------------|
| `owner` | org creator | Yes | Yes |
| `manager` | invited | Yes | No |
| `data_entry` | invited | **No** | No |
| `cashier` | invited | No | No |
| `technician` | invited | No | No |

Full capability matrix: `app/src/lib/org-role/permissions.ts`.

## `data_entry` isolation

**Can access:** Dashboard, Sales/POS, Stock, Customers, Bills, **Jobs** (when shop has AC jobs plan).

**Cannot access:** Suppliers, Banking, VAT, Workforce, Vehicles, Settings (except owner-only Team page), Plans, Notifications.

**Jobs (data_entry):** Front desk — create/edit AC jobs (installation, service, repair), quotes & deposits, assign technicians, WhatsApp customer/assignee, mark service done, job sheet line items (no prices). No delete jobs, subcontract cost, margin, or net profit.

**Hidden in UI:** buy price, profit, margin, supplier payables, bank balances, dashboard profit stats, AC subcontract cost and job-sheet profit totals.

**Store layer:**

- Display data is stripped via `stripFinancialData()` for non-financial roles.
- Internal state keeps real buy prices for correct sale costing.
- Cloud sync uses `preserveBuyPrices: true` on push so tampered client payloads cannot overwrite buy prices.

## Database

Financial isolation is enforced at **three layers**: UI (`stripFinancialData`), store write guards (`preserveBuyPrices`), and Postgres masked views + triggers.

| Migration | Purpose |
|-----------|---------|
| `20250622000001_data_entry_role.sql` | `data_entry` enum; `is_org_owner()`; owner team invites |
| `20250623000001_financial_data_rls.sql` | `can_see_org_financials()`; masked `products`, `sales`, purchase lines; buy-price / profit preserve triggers |
| `20250623000003_fix_financial_view_security.sql` | Revoke direct base-table SELECT; writes via view triggers |
| `20250624000001_sync_generation_and_rls_hardening.sql` | Sync generation + subscription write enforcement |
| `20250625000002_restore_base_table_write_grants.sql` | Re-grant masked-view write path for cloud sync |
| `20250625000003_masked_view_triggers_security_definer.sql` | Security-definer upsert triggers on masked views |
| `20250626000001_ac_workforce_financial_masking.sql` | Mask `ac_jobs.subcontract_cost`, contractor rates/payables, vehicle costs; `contractor_payments` owner/manager SELECT only |

**Masked at DB for `data_entry` / non-financial roles:** `products.buy_price`, `sales.profit`, purchase line costs, `ac_jobs.subcontract_cost`, `contractors.rate_amount` / `payable_balance`, vehicle purchase/recondition/min prices. **`contractor_payments`:** no rows visible to staff without financial access.

## Team invites (MVP)

Owner → **Settings → Team** (`/settings/team`):

1. Enter email, temporary password, role (`data_entry` default).
2. API creates auth user (service role) and inserts `org_members`.
3. Invitee signs in and lands on allowed shop routes only.

## Test checklist

Implementation is **code-complete** in the app (see `app/src/lib/org-role/`). Run automated DB checks first, then manual UI checks on production.

### Automated (DB + API)

From `app/`:

```bash
node scripts/qa-production-roles.mjs
```

Verifies: required migrations applied, masked views exist, owner vs `data_entry` sign-in, `products.buy_price` / `sales.profit` / `ac_jobs.subcontract_cost` masking, `contractor_payments` hidden for staff.

### Owner login (manual UI)

- [ ] Nav shows all modules allowed by plan/sector.
- [ ] Dashboard shows today's profit, bank balance, credit/supplier stats.
- [ ] Dashboard shows **company income tax estimate** card (when financials visible).
- [ ] Stock table shows buy price column and cost value stat; **stock out** works.
- [ ] Sales recent table shows profit column.
- [ ] Bills list shows profit and credit totals.
- [ ] Settings → Team visible; can invite `data_entry` user.
- [ ] `/settings/plans`, `/settings/notifications`, `/settings/shop` accessible (income tax rate in shop settings).

### `data_entry` login (manual UI)

- [ ] Nav limited to Dashboard, Sales, Stock, Customers, Bills, Jobs (when AC plan enabled).
- [ ] Direct URL to `/suppliers`, `/banking`, `/vat`, `/settings/shop` redirects to dashboard.
- [ ] `/jobs` accessible when plan includes `ac_jobs`; **+ New job** visible; quote/deposit on cards; no margin/subcontract.
- [ ] Jobs: create all types, edit, assign tech, WhatsApp, **mark service done** (waits for cloud save); advance status; **cannot delete** jobs or see margin/profit.
- [ ] AC alerts bell shows overdue/due today/upcoming when enabled on Jobs page.
- [ ] Dashboard hides profit, bank, credit, supplier, VAT, and income tax cards.
- [ ] Stock: no buy price field in form, no buy price column, no cost value stat; stock out allowed.
- [ ] Sales: complete sale works; profit column hidden.
- [ ] Bills: profit stat hidden on list and bill detail.
- [ ] Settings links hidden in header; `/settings/team` shows owner-only message.
- [ ] Edit product sell price/qty — save succeeds; buy price unchanged in DB (owner view).
- [ ] DevTools: tamper `buyPrice` in form payload — cloud sync does not persist new buy price.

### i18n

- [ ] Team page strings render in English and Sinhala (`nav.lang` toggle).
