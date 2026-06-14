# Advice: Building a Stock + Accounting App for Sri Lankan Business People

> Goal: attract **shop owners, wholesalers, and distributors** — not accountants.  
> They want: *“මගේ stock එක හරියට දන්නවා, ලාභය කීයද දන්නවා, bill එක වේගයෙන් ගහනවා.”*

---

## 1. What business people actually care about (ranked)

| Priority | Feature | Why it sells in Sri Lanka |
|----------|---------|---------------------------|
| 1 | **Fast billing / invoice** | Counter speed = daily revenue. Barcode scan, search by name, repeat last bill. |
| 2 | **Know stock instantly** | “මේ item එක තියෙනවද?” — show qty on billing screen. |
| 3 | **Credit (udhaar) tracking** | Very common in wholesale & neighbourhood shops. Outstanding balance per customer. |
| 4 | **Simple profit view** | Daily sales, expenses, rough profit — not full double-entry accounting at first. |
| 5 | **Low-stock alerts** | WhatsApp/SMS when item runs low — owners love passive reminders. |
| 6 | **Works when internet fails** | Offline mode + sync later. Huge trust builder. |
| 7 | **Sinhala / Tamil / English** | Staff often prefer Sinhala or Tamil on screen and printed bills. |
| 8 | **VAT-ready invoices** | Required for registered businesses; IRD format rules tightening (see below). |

**Do not lead with “ERP” or “accounting modules.”** Lead with: *“Bill faster, never run out of stock, know who owes you money.”*

---

## 2. Sri Lanka market — what makes you different

Competitors already exist ([Omnis](https://www.omnis.lk/), [Kale](https://www.kalesystems.com/), [Takkufy](https://takkufy.com/), TaxInvoice.LK). You win by being:

### Easier to start
- Setup in **15 minutes** — pre-loaded categories (grocery, electronics, etc.)
- **Free tier** or very low monthly price (Rs. 1,500–2,500 range is common)
- **WhatsApp support** — Sri Lankan owners expect human help, not ticket systems

### Built for local habits
- **Credit sales** with limits and reminders
- **Cheque** received / issued tracking (still widely used B2B)
- **Cash drawer** open/close and daily cash count
- **Multiple payment modes** on one bill: cash + card + credit split
- **Supplier payment** tracking (who you owe)

### Compliance without fear
- From **2026**, VAT invoice format rules are stricter (serial number format, TIN, LKR amounts, etc.)
- Offer **“VAT mode”** toggle — registered businesses get compliant invoices; small shops get simple receipts
- Keep invoice copies **5 years** (IRD requirement) — cloud backup is a selling point

### Trust signals that matter here
- “Data stored securely in cloud” + export to Excel anytime
- **Role-based access** — cashier cannot see owner profit margins
- **Audit log** — who changed price, who gave discount

---

## 3. Stock handling by business type

### Grocery / supermarket
- **Expiry dates** and batch numbers (FMCG)
- **Units**: piece, kg, litre, dozen
- **Weigh-scale** items (optional later)
- Fast-moving SKU search — owners think in brand names (“Anchor”, “Maliban”)

### Electronics
- **Serial number** per unit (phones, laptops)
- **Warranty start date** linked to sale
- Higher value → often **partial credit** or instalments

### Electricals (wires, switches, fittings)
- Sell by **length** (metres) or **box**
- **Brand + spec** in name (e.g. “2.5mm wire - Kelani - 100m coil”)
- Frequent **wholesale** pricing tiers (retail vs dealer price)

### Spare parts (auto / machinery)
- **Part number** is king — search must be excellent
- **Compatible with** (vehicle model, machine) — even a simple text field helps
- Slow-moving stock — **“not sold in 90 days”** report is valuable
- Often **multiple branches** or counter + warehouse

**One app can serve all** if you use **flexible item fields** per category (expiry vs serial vs part no.) instead of four separate apps.

---

## 4. Accounting — keep it shallow (good enough)

Most owners do **not** want a full chart of accounts on day one.

### Phase 1 (enough to attract users)
- Sales register (cash in)
- Purchase / GRN (stock in)
- Expenses (rent, salary, transport)
- **Simple P&L**: Sales − COGS − Expenses = Profit (approximate)
- Customer **receivables** and supplier **payables** lists

### Phase 2 (when they grow)
- Bank reconciliation
- VAT return summary export
- Multi-branch consolidation
- Accountant export (CSV / Excel)

Avoid jargon: say **“Money In / Money Out”** instead of “debit/credit” in the UI.

---

## 5. Features that attract business people (marketing angle)

| Message | Feature behind it |
|---------|-------------------|
| “Bill in 10 seconds” | POS + barcode + favourites |
| “Check shop from home” | Mobile dashboard, today’s sales |
| “Know who hasn’t paid” | Credit aging report |
| “Don’t lose sales from empty shelf” | Low stock alert |
| “Staff can’t steal your margins” | Roles + discount limits |
| “Power cut? No problem.” | Offline billing |
| “Your accountant will thank you” | VAT invoice + year-end export |

**Social proof**: photos of real Colombo/Kandy/Galle shops using it, short Sinhala demo videos on Facebook — that’s where many owners discover software.

---

## 6. What NOT to build early (scope trap)

- Full manufacturing / BOM (unless you target factories later)
- Payroll with EPF/ETF (complex; integrate or phase 3)
- Custom hardware POS terminals (use browser + USB barcode scanner)
- AI forecasting (nice later; not a reason to sign up)
- Too many reports — **5 great reports** beat 50 unused ones

---

## 7. Suggested report pack (v1)

1. **Today’s sales** (by payment type)
2. **Stock on hand** (filter by category)
3. **Low stock items**
4. **Customer outstanding (udhaar)**
5. **Fast / slow moving items** (last 30 days)

---

## 8. Pricing psychology (Sri Lanka)

- **Monthly subscription** beats large upfront licence
- **Per outlet** pricing scales with business size
- Free trial **14 days** with sample data
- “Cancel anytime” reduces fear for small shops

---

## 9. One-line positioning

> **“Lanka Stock & Accounts — stock, bills, and credit tracking for Sri Lankan shops. Simple in Sinhala. Works offline. VAT-ready when you need it.”**

---

## 10. Recommended build order

1. Items + categories + stock in/out  
2. POS billing + print/PDF receipt  
3. Customers + credit  
4. Suppliers + purchases  
5. Basic expenses + daily summary  
6. Low stock alerts  
7. VAT invoice template (registered users)  
8. Multi-user roles  

See [MVP-SCOPE.md](./MVP-SCOPE.md) for a tighter cut of steps 1–5.
