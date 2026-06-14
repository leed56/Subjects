# MVP Scope — Phase 1 (8–12 weeks of focused build)

Ship something shop owners can **use daily**, not a demo.

## In scope

### Users & shops
- [ ] One business, one location (multi-branch later)
- [ ] Roles: **Owner**, **Cashier** (cashier: sell only, no cost/profit)
- [ ] Login with phone or email

### Items & stock
- [ ] Categories: Grocery, Electronics, Electrical, Spare Parts, Other
- [ ] Fields: name, SKU/barcode, buy price, sell price, qty, unit, reorder level
- [ ] Optional per category: expiry date, serial no., part no.
- [ ] Stock adjust (+/-) with reason
- [ ] Purchase entry (add stock + supplier optional)

### Sales (POS)
- [ ] Search item by name / barcode / part no.
- [ ] Cart, qty, line discount, bill discount
- [ ] Payment: Cash, Card, Credit, Cheque, Mixed
- [ ] Print thermal-friendly receipt + PDF
- [ ] Reduce stock on sale automatically

### Customers & credit
- [ ] Customer list (name, phone, address)
- [ ] Credit sale → outstanding balance
- [ ] Record payment against balance
- [ ] Outstanding report

### Dashboard
- [ ] Today: sales total, bills count, cash vs credit
- [ ] Low stock count (click to list)

### Localisation
- [ ] English + Sinhala UI (Tamil in phase 1.5 if needed)
- [ ] LKR formatting, Asia/Colombo timezone

### Technical must-haves
- [ ] Works on mobile browser
- [ ] Basic offline: queue sales, sync when online
- [ ] Daily cloud backup

## Out of scope (phase 2+)

- VAT IRD serial format automation (prepare data model, manual template OK for MVP)
- Multi-branch transfer
- Bank reconciliation
- Payroll / EPF
- WhatsApp API integration (manual export OK first)
- Barcode label printing
- Android native app (PWA is enough initially)

## Success metric

A real shop runs **50+ bills/day** for 2 weeks without reverting to notebook or Excel.
