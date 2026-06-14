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

**Trial:** 14 days, Business-level features, no credit card. Phone OTP signup.

**After trial:** 7-day read-only grace (view data, no new sales), then billing required.

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
Browser → Next.js → Supabase Auth (phone OTP)
                 → Postgres (org-scoped data, RLS)
                 → PayHere webhook → subscription status
```

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
| `past_due` | Read-only + pay banner |
| `canceled` | Billing page only; export window |

### Payments (phased)

1. **Manual** — bank transfer, admin activates in Supabase.
2. **PayHere** — monthly payment links + webhook.
3. **Recurring** — saved card / auto-renew (later).

---

## Implementation roadmap

### Phase A — Foundation (in progress)

- [x] Subscription doc + SQL migration in repo
- [x] Plan definitions + `can()` feature gate in app
- [x] `/settings/billing` UI
- [x] `/login` UI scaffold
- [ ] Create Supabase project + run migration
- [ ] Phone OTP auth
- [ ] Migrate localStorage data → org tables

### Phase B — Billing live

- [ ] Trial on org signup
- [ ] PayHere checkout + webhook
- [ ] Admin: manual activate / extend trial
- [ ] Gate write actions per plan

### Phase C — Growth

- [ ] Annual checkout
- [ ] Referral credits
- [ ] Renewal WhatsApp/SMS reminders

---

## Local setup

1. Create a [Supabase](https://supabase.com) project (region: `ap-southeast-1` Singapore is closest).
2. Run migration from `lakbiz/supabase/migrations/`.
3. Add to `lakbiz/app/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Enable Phone auth in Supabase dashboard.

Until Supabase is connected, the app runs in **demo mode** with a simulated Business trial.

---

## Code references

| Path | Purpose |
|------|---------|
| `app/src/lib/subscription/plans.ts` | Plan limits and LKR prices |
| `app/src/lib/subscription/can.ts` | Feature gate helper |
| `app/src/lib/subscription/subscription-provider.tsx` | React context |
| `app/src/app/settings/billing/page.tsx` | Plan picker UI |
| `supabase/migrations/*.sql` | Database schema |

---

*Pricing aligned with LK market: Omnis ~1,900/mo, Takkufy trial + monthly, Lanka POS mixed model.*
