# LakBiz — Stock & Accounting App (Sri Lanka)

Inventory, sales, and **business banking** for Sri Lankan SMEs — grocery, electronics, electricals, spare parts, **air conditioning**, and **car sales**.

## Docs

| File | Contents |
|------|----------|
| [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) | Market research, MVP, go-to-market |
| [docs/SECTORS.md](./docs/SECTORS.md) | **AC, car sales, banking** + all sector fields |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Database / types design |
| [docs/SUBSCRIPTION.md](./docs/SUBSCRIPTION.md) | **Pricing tiers, manual billing, Supabase schema** |

## App (starter)

```bash
cd lakbiz/app
npm install
npm run dev
```

Open http://localhost:3000 — **working pages**:

### Supabase (cloud database)

1. Copy `lakbiz/app/env.local.example` → `lakbiz/app/.env.local`
2. Add your project URL and **anon key** only (never put service role key in the app)
3. Restart `npm run dev`
4. Open `/login` → **Create shop** with email + password

Schema migration is in `lakbiz/supabase/migrations/` (already applied if using shared project).

- `/login` — email signup → creates org + 14-day Business trial in Supabase

- `/stock` — add / edit items, stock in
- `/suppliers` — suppliers, **GRN purchases**, payables
- `/jobs` — **AC installation** jobs (quote → install → service)
- `/vehicles` — **car stock** (chassis, aging, profit per vehicle)
- `/sales` — bill customer (cash, credit, cheque)
- `/bills` — view, **print**, **WhatsApp share** bills
- `/customers` — credit ledger, record payments
- `/banking` — bank accounts, cheque register, PDC
- `/settings/plans` — **subscription plans** (read-only, LKR reference pricing)
- `/login` — phone OTP scaffold (Supabase)
- `/dashboard` — live sales, profit, credit, bank balance

## Sectors supported

| Sector | Key extras |
|--------|------------|
| Grocery | Weight, expiry, barcode |
| Electronics | Serial, IMEI, warranty |
| Electricals | Meters, job billing |
| Spare parts | Part no., fitment |
| **AC / HVAC** | BTU, serial pairs, install jobs, AMC |
| **Car sales** | Chassis, aging, recondition cost, leasing |
| **Banking** (all) | Cheques, PDC, multi-bank, reconciliation |

## Build order

1. Core stock + POS + customers  
2. Banking + cheques  
3. AC jobs + car vehicle units  
4. VAT invoices, bank CSV reconcile  

## Folder layout

```
lakbiz/
├── README.md
├── PRODUCT_BRIEF.md
├── docs/
│   ├── SECTORS.md
│   └── DATA_MODEL.md
└── app/                 ← Next.js starter
    └── src/
        ├── app/           ← pages
        ├── components/
        └── lib/           ← types, sector config
```
