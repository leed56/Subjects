# LakBiz — Stock & Accounting App (Sri Lanka)

A planning folder for a simple **inventory + accounting** app aimed at Sri Lankan small and medium businesses: grocery shops, electronics stores, electrical suppliers, spare parts dealers, and similar retail/wholesale operations.

> This folder is **product planning only** — not a full application yet. See [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) for market research, feature priorities, and how to attract business owners.

## Why this exists

Sri Lanka already has many POS/ERP tools (Lanka POS, Takkufy, Omnis, Kale, SmartBill, etc.). To win business owners, this app should be **simpler to start**, **local-first**, and **honest about what it does** — not try to be a full ERP on day one.

## Target users

| Segment | Examples | Main pain |
|---------|----------|-----------|
| Grocery / mini-mart | Corner shops, supermarkets | Fast billing, expiry, credit customers |
| Electronics | Mobile shops, computer stores | Serial numbers, warranty, supplier credit |
| Electricals | Wire, switches, fittings | Units (meters, boxes), project/job billing |
| Spare parts | Auto, machinery parts | Part numbers, slow vs fast movers, supplier orders |

## Suggested MVP scope (keep it small)

1. **Stock in / stock out** with categories
2. **Simple billing** (cash + credit)
3. **Daily sales & profit summary**
4. **Low-stock alerts**
5. **WhatsApp bill share**
6. **Sinhala + English UI** (Tamil later)

## Folder structure (when you build)

```
lakbiz/
├── README.md              ← you are here
├── PRODUCT_BRIEF.md       ← full advice & market notes
├── docs/
│   └── wireframes/        ← optional UI sketches
└── app/                   ← future: web or mobile app code
```

## Next step

Read [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md), pick 5–7 MVP features, and build a **working demo for one shop type** (e.g. grocery) before adding electronics/spare-parts complexity.
