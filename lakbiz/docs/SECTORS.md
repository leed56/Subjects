# LakBiz — Business Sectors (Sri Lanka)

Extended field ideas and workflows for each industry. One app, **flexible templates** per sector — not separate products.

---

## How sectors work in LakBiz

```
Business Setup
    └── Pick sector template(s): Grocery | Electronics | AC | Car Sales | ...
            └── Core modules always on: Stock, Sales, Customers, Banking
            └── Sector adds extra fields, screens, and reports
```

A shop can pick **more than one** (e.g. electrical + AC installation).

---

## 1. Air Conditioning (AC / HVAC)

**Who:** Authorized dealers (Daikin, LG, Gree, Midea, Panasonic…), installers, showrooms in Rajagiriya, Nugegoda, outstation agents.

**How they sell in Sri Lanka:** Unit + **free installation** bundle, extra copper pipe charged separately, warranty only if installed by authorized team, annual service contracts.

### Stock fields (product / kit)

| Field | Example | Notes |
|-------|---------|-------|
| Brand | Daikin, TCL, Gree | Dealer authorization per brand |
| Model | FTKM35U | |
| Unit type | Wall / Cassette / Ducted / VRV / Portable / Window | Different stock logic |
| Capacity (BTU) | 12000, 18000, 24000 | Common search filter |
| Horsepower (HP) | 1.0, 1.5, 2.5 | Used in local marketing |
| Inverter | Yes / No | Price tier |
| Refrigerant | R32, R410A | |
| Indoor serial no. | Per unit | Warranty claim |
| Outdoor serial no. | Per unit | Paired with indoor |
| Kit vs separate | Sold as set | Stock deduct both on sale |
| Compressor warranty (months) | 36, 60 | |
| Unit warranty (months) | 12 | |
| Landed cost | LKR | Import / distributor price |
| Sell price | LKR | |
| Free install promo | Yes / No | Marketing flag |

### Accessories (linked stock)

| Item | Unit |
|------|------|
| Copper pipe | meters |
| Insulation | meters |
| Bracket / stand | pcs |
| Drain pump | pcs |
| Remote / PCB spare | pcs |
| Air curtain | pcs |

### Job / installation workflow

| Step | What to track |
|------|----------------|
| Site visit | Customer, address, room size, quote |
| Quotation | Unit + pipe estimate + bracket + chasing |
| Deposit | Cash / bank / cheque |
| Schedule install | Technician, date |
| Install complete | Actual pipe used, serials registered |
| Service due | 3 free services in year 1 (common LK practice) |
| AMC renewal | Annual maintenance contract |

### AC-specific reports

- Units sold by BTU / brand / month  
- Installation jobs pending vs completed  
- Warranty registrations due  
- Accessory usage per job (pipe meters)  
- Service visits this month  

---

## 2. Car Sales (New & Used)

**Who:** Used car lots (Colombo, Kandy, Kurunegala), reconditioned importers, small multi-car showrooms, bike dealers (lighter template).

**How they work in Sri Lanka:** Buy at auction/import → recondition → add margin → often **leasing/HP through bank** → RMV transfer paperwork.

### Vehicle stock (each car = one stock unit, not bulk qty)

| Field | Example | Notes |
|-------|---------|-------|
| Stock ID | V-2026-0142 | Internal |
| Make | Toyota, Suzuki | |
| Model | Prius, Wagon R | |
| Year | 2018 | |
| Chassis number | | Unique key |
| Engine number | | |
| Registration no. | CAB-1234 | After transfer |
| Color | Silver | |
| Fuel | Petrol / Hybrid / Diesel / Electric | |
| Transmission | Auto / Manual | |
| Mileage (km) | 85000 | |
| Condition | Reconditioned / Registered / Unregistered | |
| Import batch | Jan 2026 shipment | For landed cost |
| Purchase price | LKR | Auction + clearing |
| Recondition cost | LKR | Paint, tyres, repairs |
| **Total cost** | Auto sum | True cost basis |
| Ask price | LKR | Listed price |
| Minimum price | LKR | Owner only — staff privacy |
| Days in stock | Auto | Aging alert > 60 / 90 days |
| Photos | Gallery | For Facebook / WhatsApp listing |
| Location | Yard A / Floor 2 | Multi-site dealers |

### Sale workflow

| Step | Track |
|------|-------|
| Inquiry | Customer, interested vehicle |
| Test drive | Date, salesman |
| Offer / negotiate | Offer amount |
| Payment | Cash / bank / **leasing** |
| Finance partner | Sampath, Peoples, LOLC, etc. | Commission optional |
| Valuation (IVSL) | Report no., date | For finance |
| RMV transfer checklist | Revenue license, insurance, CR | |
| Handover | Date, odometer at sale |
| Profit per vehicle | Sell − total cost | Owner dashboard |

### Car-specific reports

- Stock aging (30 / 60 / 90+ days)  
- Profit per vehicle / per salesman  
- Average days to sell by model  
- Finance vs cash mix  
- Vehicles in reconditioning (not yet for sale)  

---

## 3. Banking & Money (all businesses)

> This is **business banking inside the app** — track your company’s bank accounts, cheques, and reconciliation. Not a bank app for customers.

**Why it matters in Sri Lanka:** B2B still runs on **cheques**, **post-dated cheques (PDC)**, and **multiple bank accounts**. Competitors like RealCloud and TaxInvoice.LK market cheque handling as a core feature.

### Bank accounts

| Field | Example |
|-------|---------|
| Bank | BOC, People's, Sampath, HNB, DFCC, NDB… |
| Branch | Kandy City |
| Account name | ABC Traders (Pvt) Ltd |
| Account number | |
| Account type | Current / Savings |
| Opening balance | LKR |

### Payment methods (on every sale / purchase)

- Cash  
- Bank transfer (slip reference)  
- Card  
- Cheque (see below)  
- Credit (ණය — on account)  
- Mixed payment on one invoice  

### Cheque register

| Field | Example |
|-------|---------|
| Direction | Received from customer / Paid to supplier |
| Cheque no. | 001245 |
| Bank | People's Bank |
| Amount | LKR |
| Cheque date | |
| Post-dated? | Yes → alert before due |
| Linked invoice | INV-2026-089 |
| Status | Pending → Deposited → Cleared / **Bounced** |
| Deposit date | |
| Clear date | |

### Bank reconciliation (Phase 2+)

- Import bank statement CSV (most LK banks offer)  
- Match deposits / withdrawals to app records  
- Flag unmatched items  
- Month-end **cash + bank** position  

### Banking dashboard (owner view)

- Cash in hand (per branch)  
- Bank balance (per account)  
- Cheques in hand (not yet deposited)  
- PDC coming due (next 7 / 30 days)  
- Customer credit outstanding  
- Supplier payables  

---

## 4. Original sectors (expanded quick reference)

### Grocery
Weighted items, expiry, barcode, pack/carton, FIFO hint, credit customers.

### Electronics
Serial/IMEI, warranty, brand/model, buy-back/trade-in optional.

### Electricals
Meters/boxes, job/project tag, contractor price list, bulk breaks.

### Spare parts
Part no., cross-reference, vehicle fitment, bin location, dead stock aging.

---

## 5. Module priority — what to build first

| Order | Module | Sectors served |
|-------|--------|----------------|
| 1 | Core stock + POS | All |
| 2 | Customers + credit | All |
| 3 | Banking + cheques | All B2B, AC dealers, car sales |
| 4 | Job / quotation | AC installation, electrical projects |
| 5 | Vehicle unit stock | Car sales only |
| 6 | Service / AMC schedule | AC, electronics warranty |
| 7 | Bank reconciliation | Mature businesses |
| 8 | Leasing commission tracker | Car dealers |

**Recommended first pilot:** AC dealer *or* used car lot — high ticket, clear pain, willing to pay Rs. 3,000+/month if it tracks profit per unit/job.

---

## 6. Sri Lankan market angles per sector

| Sector | Hook for marketing |
|--------|-------------------|
| AC | “Track every unit serial, installation job, and pipe cost — warranty safe” |
| Car sales | “Know profit per vehicle before you hand over keys” |
| Banking | “Cheques, PDC, and bank balance — one screen, no Excel” |
| Grocery | “Fast bill + credit ledger + WhatsApp receipt” |

---

## 7. Fields you can add later (don’t block MVP)

- SMS to customer on service due  
- Facebook Marketplace auto-list (cars)  
- IVSL valuation API integration  
- Leasing bank API (unlikely early — manual commission field is enough)  
- E-invoicing IRD direct submit  
- Multi-currency (importers only)  

---

*Next: see [DATA_MODEL.md](./DATA_MODEL.md) for how these map to database tables.*
