# LakBiz Subscription Model

Sri Lanka–focused SaaS pricing and technical design for LakBiz.

---

## Business model

**Hybrid:** monthly/annual base plan + add-ons (users, branches, sector modules).

| Plan | Monthly (LKR) | Annual (LKR) | Target |
|------|---------------|--------------|--------|
| **Starter** | 1,490 | 14,900 | Single counter, owner only |
| **Business** | 2,990 | 29,900 | 2–3 staff, credit + suppliers |
| **Pro** | 4,990 | 49,900 | AC/car yards, banking, multi-branch |

**Add-ons (monthly)**

| Add-on | LKR |
|--------|-----|
| Extra user | 490 |
| Extra branch | 990 |
| AC Jobs module | 790 |
| Vehicles module | 790 |
| Both sector pack | 1,290 |

**Trial:** 14 days, Business-level features, no credit card. Email signup.

**After trial:** 7-day read-only grace (view data, no new sales), then contact LakBiz to activate.

---

## Feature matrix

| Feature | Starter | Business | Pro |
|---------|:-------:|:--------:|:---:|
| Products & stock | 500 cap | Unlimited | Unlimited |
| Sales / POS | ✓ | ✓ | ✓ |
| Bills + WhatsApp | ✓ | ✓ | ✓ |
| Customers (credit) | — | ✓ | ✓ |
| Suppliers + GRN | — | ✓ | ✓ |
| Banking + cheques | — | ✓ | ✓ |
| Users | 1 | 3 | 10 |
| Branches | 1 | 1 | 3 |
| AC Jobs | add-on | add-on | ✓ |
| Vehicles | add-on | add-on | ✓ |
| Excel export | — | ✓ | ✓ |
| Offline mode | — | — | Phase 2 |
| VAT invoice | — | — | Phase 3 |

Enforcement: server-side `can(org, feature)` + client UI gates.

---

## Technical architecture

```
Browser → Next.js → Supabase Auth (email/password)
                 → Postgres (org-scoped data, RLS)
                 → Platform admin panel → subscription status
```

### Shop provisioning (admin panel)

New shops are created only via **Platform admin → Create shop** (`POST /api/admin/shops`):

1. `auth.admin.createUser` — owner account (`email_confirm: true`)
2. `provision_shop` RPC (service role) — atomic `organizations` + `org_members` + `subscriptions`
3. Template resolved from `business_templates` (DB), with local fallback
4. Shop owners are **never** added to `platform_admins` — use separate LakBiz admin accounts

Self-signup (`bootstrap_user_organization`) is disabled when `NEXT_PUBLIC_ADMIN_ONLY=true`.

### Tenant model

- **Organization** = one paying business (shop, yard, AC company).
- **org_members** links `auth.users` to org with role: `owner` | `manager` | `cashier` | `technician`.
- All app data scoped by `organization_id`.

### Subscription tables

See `lakbiz/supabase/migrations/20250614000001_subscription_schema.sql`.

| Table | Purpose |
|-------|---------|
| `plans` | Starter / Business / Pro limits and LKR prices |
| `organizations` | Shop profile, sector |
| `org_members` | Users per org |
| `subscriptions` | Status, trial end, period end, plan |
| `subscription_addons` | AC, vehicles, extra seats |

### Subscription statuses

| Status | Access |
|--------|--------|
| `trialing` | Full plan features until `trial_ends_at` |
| `active` | Paid, full access |
| `past_due` | Read-only + contact banner |
| `read_only` | View only until LakBiz activates |
| `canceled` | Plans page only; export window |

### Billing (manual only)

All subscription billing is handled **outside the app**:

1. Customer pays LakBiz via bank transfer or agreed method.
2. Platform admin activates or extends the subscription in the admin panel / Supabase.
3. Customers see a **read-only plans page** at `/settings/plans` — no checkout, no PayHere, no Stripe.

Business payments (customer credit, supplier payables, contractor payouts, POS cash/cheque) remain in-app — those are operational ledger features, not SaaS billing.

---

## Implementation roadmap

### Phase A — Foundation (done)

- [x] Subscription doc + SQL migration in repo
- [x] Plan definitions + `can()` feature gate in app
- [x] `/settings/plans` read-only UI (Sinhala + English)
- [x] `/login` email signup
- [x] Supabase org + subscription provisioning
- [x] Gate write actions per plan

### Phase B — Platform ops

- [ ] Admin: manual activate / extend trial / change plan
- [ ] Renewal WhatsApp/SMS reminders (optional)

### Phase C — Growth

- [ ] Referral credits
- [ ] Annual billing discounts (manual invoicing)

---

## Local setup

1. Create a [Supabase](https://supabase.com) project (region: `ap-southeast-1` Singapore is closest).
2. Run migration from `lakbiz/supabase/migrations/`.
3. Add to `lakbiz/app/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Enable Email auth in Supabase dashboard.

Until Supabase is connected, the app runs in **demo mode** with a simulated Business trial.

---

## Code references

| Path | Purpose |
|------|---------|
| `app/src/lib/subscription/plans.ts` | Plan limits and LKR prices |
| `app/src/lib/subscription/can.ts` | Feature gate helper |
| `app/src/lib/subscription/subscription-provider.tsx` | React context |
| `app/src/app/settings/plans/page.tsx` | Read-only plan summary |
| `supabase/migrations/*.sql` | Database schema |

---

*Pricing aligned with LK market: Omnis ~1,900/mo, Takkufy trial + monthly, Lanka POS mixed model.*
