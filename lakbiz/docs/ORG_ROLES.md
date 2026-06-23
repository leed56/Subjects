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

**Can access:** Dashboard, Sales/POS, Stock, Customers, Bills.

**Cannot access:** Suppliers, Banking, VAT, Jobs, Workforce, Vehicles, Settings (except owner-only Team page), Plans, Notifications.

**Hidden in UI:** buy price, profit, margin, supplier payables, bank balances, dashboard profit stats.

**Store layer:**

- Display data is stripped via `stripFinancialData()` for non-financial roles.
- Internal state keeps real buy prices for correct sale costing.
- Cloud sync uses `preserveBuyPrices: true` on push so tampered client payloads cannot overwrite buy prices.

## Database

Migration: `supabase/migrations/20250622000001_data_entry_role.sql`

- Adds `data_entry` to `org_role` enum.
- Adds `is_org_owner()` helper and RLS policy for owners inserting `org_members`.

**RLS follow-up (not in this PR):** column-level restrictions on `products.buy_price`, purchase costs, and `sales.profit` for `data_entry` at the database layer.

## Team invites (MVP)

Owner → **Settings → Team** (`/settings/team`):

1. Enter email, temporary password, role (`data_entry` default).
2. API creates auth user (service role) and inserts `org_members`.
3. Invitee signs in and lands on allowed shop routes only.

## Test checklist

### Owner login

- [ ] Nav shows all modules allowed by plan/sector.
- [ ] Dashboard shows today's profit, bank balance, credit/supplier stats.
- [ ] Stock table shows buy price column and cost value stat.
- [ ] Sales recent table shows profit column.
- [ ] Bills list shows profit and credit totals.
- [ ] Settings → Team visible; can invite `data_entry` user.
- [ ] `/settings/plans`, `/settings/notifications`, `/settings/shop` accessible.

### `data_entry` login (after invite)

- [ ] Nav limited to Dashboard, Sales, Stock, Customers, Bills.
- [ ] Direct URL to `/suppliers`, `/banking`, `/settings/shop` redirects to dashboard.
- [ ] Dashboard hides profit, bank, credit, supplier, VAT cards.
- [ ] Stock: no buy price field in form, no buy price column, no cost value stat.
- [ ] Sales: complete sale works; profit column hidden.
- [ ] Bills: profit stat hidden on list and bill detail.
- [ ] Settings links hidden in header; `/settings/team` shows owner-only message.
- [ ] Edit product sell price/qty — save succeeds; buy price unchanged in DB (owner view).
- [ ] DevTools: tamper `buyPrice` in form payload — cloud sync does not persist new buy price.

### i18n

- [ ] Team page strings render in English and Sinhala (`nav.lang` toggle).
