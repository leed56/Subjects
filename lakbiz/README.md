# LakBiz — Stock & Accounting App (Sri Lanka)

Inventory, sales, and **business banking** for Sri Lankan SMEs — grocery, electronics, electricals, spare parts, **air conditioning**, and **car sales**.

## Docs

| File | Contents |
|------|----------|
| [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) | Market research, MVP, go-to-market |
| [docs/SECTORS.md](./docs/SECTORS.md) | **AC, car sales, banking** + all sector fields |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Database / types design |

## App (starter)

```bash
cd lakbiz/app
npm install
npm run dev
```

Open http://localhost:3000 — demo pages:

- `/` — overview
- `/dashboard` — owner KPIs (AC + car dealer demo)
- `/sectors` — all business templates
- `/sectors/ac_hvac` — AC field list
- `/sectors/car_sales` — vehicle fields
- `/banking` — cheques, bank accounts

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
