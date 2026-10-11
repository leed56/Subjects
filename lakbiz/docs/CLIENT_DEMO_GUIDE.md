# Client demo guide

Open `/demo` on the preview deployment to choose an industry. Each card includes its public login. The “Copy all demo logins” button copies absolute URLs for the deployment you are viewing.

Shared public sample password: `LakBizDemo2026!`

These identifiers open synthetic showcase workspaces only. They are not Supabase accounts and do not grant access to live organizations. Each browser keeps its own mock changes; each industry has a separate dataset. The optional “Enter with the sample account” button supports a quick client presentation without manual entry.

| Industry | Demo path | Public sample email |
| --- | --- | --- |
| Grocery & supermarket | `/demo/grocery` | `demo.grocery@lakbiz.example` |
| Pharmacy | `/demo/pharmacy` | `demo.pharmacy@lakbiz.example` |
| Cosmetics & beauty | `/demo/cosmetics` | `demo.cosmetics@lakbiz.example` |
| Electronics | `/demo/electronics` | `demo.electronics@lakbiz.example` |
| Mobile phones & repair parts | `/demo/mobile_shop` | `demo.mobile_shop@lakbiz.example` |
| Electricals | `/demo/electricals` | `demo.electricals@lakbiz.example` |
| Auto & machinery spare parts | `/demo/spare_parts` | `demo.spare_parts@lakbiz.example` |
| Footwear | `/demo/footwear` | `demo.footwear@lakbiz.example` |
| Textile / fashion | `/demo/textile` | `demo.textile@lakbiz.example` |
| AC / HVAC | `/demo/ac_hvac` | `demo.ac_hvac@lakbiz.example` |
| Vehicle dealership | `/demo/car_sales` | `demo.car_sales@lakbiz.example` |
| Hardware & building supplies | `/demo/hardware` | `demo.hardware@lakbiz.example` |
| Stationery & books | `/demo/stationery` | `demo.stationery@lakbiz.example` |
| Wholesale & distribution | `/demo/wholesale` | `demo.wholesale@lakbiz.example` |

## A ten-minute client walkthrough

1. Open Overview and explain the operating hero, sales trend and attention queue.
2. Open Inventory and inspect a product’s industry fields and stock in three locations.
3. In POS, choose a customer, add a product and complete a sample cash/card sale. Open the sample receipt.
4. Try customer reward points and credit limits. Switch to Cashier or Manager view to show the permission boundaries.
5. Create and receive a purchase order; confirm stock, supplier payable and finance update together.
6. Create a shipment, review currency and landed-cost assumptions, advance it through transit/customs and receive it.
7. Transfer stock between locations; verify total organizational stock is unchanged.
8. Record a reasoned write-off, then issue a full inspected return or quarantine return from an original invoice.
9. Open Finance’s journal/trial/VAT views, then Reports and the phone-style Owner Pulse.
10. Show SaaS Admin and Template Studio as design previews. Reset the sample data before the next client presentation.

## Included screens

Overview, POS, Purchases, Imports & Landed Cost, Inventory, Warehouses, Damage & Loss, Returns & Credit Notes, Finance & VAT, Customers, Loyalty, People & Access, Reports & Insights, Owner Pulse, Settings, SaaS Admin and Template Studio.

## Presentation boundaries

- No real payments, messages, invitations, tax filings or platform releases occur.
- The sample tax rate and exchange rates are editable demonstration assumptions.
- Sample credentials are intentionally public; do not use them for real business accounts.
- Each industry has eight tailored product lines, five fictional customers, three suppliers, three locations, four team members, 14 seeded sales, an open PO, an inbound shipment, opening balances and balanced journals.
- Mock identity fields demonstrate each industry’s vocabulary; real physical allocations remain in the existing specialist production engines.
- A reload retains your sample transactions when browser storage is available. Leaving the workspace clears its sample session. Reset restores only the current industry.
