# LakBiz Product Brief — Sri Lankan Market

Advice for building a stock + accounting app that **business people will actually use**. Kept practical, not overly deep.

---

## 1. What the market already has

Local competitors are strong. Learn from them, don’t copy everything.

| Product | Strength | Price hint |
|---------|----------|------------|
| [Lanka POS](https://lankabill.lk/) | Offline mode, WhatsApp bills, huge user base | One-time / subscription mix |
| [Takkufy](https://takkufy.com/) | Very simple language, privacy for owner vs staff | Free trial, monthly plans |
| [Omnis](https://www.omnis.lk/) | Cloud POS + accounting, from ~Rs. 1,900/mo | Low entry price |
| [Kale](https://www.kalesystems.com/) | Android tablet POS, Sinhala support | Hardware + cloud |
| [SmartBill POS](https://www.smartbillpos.com/) | Grocery: weighted items, expiry stock | SaaS |
| [TaxInvoice.LK](https://taxinvoice.lk/) | VAT-compliant invoicing, GRN workflow | ERP for SMEs |

**Your opportunity:** Many shop owners still use **Excel, notebooks, or old desktop software**. They want something that works on **phone + laptop**, sets up in **15 minutes**, and doesn’t need an accountant to understand.

---

## 2. What attracts Sri Lankan business owners

These matter more than fancy dashboards.

### A. Speak their language (literally and figuratively)

- **Sinhala first**, English second; add **Tamil** when you can (Kale and others already do this — it’s expected for island-wide adoption).
- Avoid accounting jargon. Use: *“මුදල් ලැබුණා”*, *“ණය බිල”*, *“ඉතිරි තොගය”* — not “debit note” and “COGS” on the main screen.
- Short onboarding: *“Shop name → add 10 items → print first bill”* in under 15 minutes (Takkufy’s promise works because it’s true).

### B. Works when internet is bad

- **Offline billing** with sync when online is a major selling point in Sri Lanka (Lanka POS markets this heavily).
- Cloud backup + optional USB/export backup for peace of mind.

### C. WhatsApp is not optional

- Send **PDF/image bills on WhatsApp** in one tap.
- Optional: low-stock or payment reminders to owner via WhatsApp (careful with spam — make it opt-in).

### D. Owner vs staff privacy

- Cashier can bill and check stock; **cannot see profit, purchase cost, or owner expenses** (Takkufy highlights this — owners love it).
- Role-based access: Owner / Manager / Cashier.

### E. Affordable, predictable pricing

- Local apps cluster around **Rs. 1,500–3,500/month** for small shops.
- Offer **free tier** (1 user, limited invoices) or **7–30 day trial** without credit card.
- **LKR pricing** on the website — not USD.

### F. Local payment & business habits

- **Cash** and **credit (ණය)** customer accounts — very common in grocery and spare parts.
- **Cheque** tracking (post-dated cheques) for B2B electrical/spare parts.
- **Multi-counter** billing for busy shops (one branch, two cashiers).

### G. Tax readiness (don’t ignore — but don’t overbuild v1)

- From **July 2026**, standardized **VAT tax invoice** format is mandatory for VAT-registered businesses ([IRD guidance](https://lankataxclub.lk/new-tax-invoice-specifications-announced-what-you-need-to-know-before-july-2026/)).
- MVP: support **simple bill** + **VAT bill template** with TIN, serial number format, LKR amounts.
- Full e-invoicing integration can come later.

---

## 3. Features by business type (what to include)

### Core (all segments) — build these first

| Feature | Why |
|---------|-----|
| Product catalog | Name, SKU/barcode, category, buy price, sell price, unit |
| Stock in (purchase) | Supplier, quantity, cost — updates stock |
| Stock out (sale) | POS screen, discounts, payment type |
| Categories | Grocery, Electronics, Electrical, Spare Parts + custom |
| Low-stock alert | Reorder level per item |
| Daily summary | Sales, cost, rough profit, cash in hand |
| Customer list | Name, phone, optional credit balance |
| Supplier list | Who you buy from, what you owe |
| Reports (simple) | Today / this week / this month sales; top items |
| Export | Excel/PDF for accountant |
| Multi-user + roles | Owner sees all; staff limited |
| Print | Thermal (58/80mm) + A4 invoice |

### Grocery-specific

| Feature | Why |
|---------|-----|
| Weighted items | Rice, vegetables — price per kg |
| Expiry date | Reduce waste, FIFO hint |
| Barcode scan | Faster checkout |
| Unit variants | Single, packet, carton |

### Electronics-specific

| Feature | Why |
|---------|-----|
| Serial / IMEI tracking | Phones, laptops — warranty claims |
| Warranty period | 6/12 months per item |
| Brand + model fields | Easier search |

### Electricals-specific

| Feature | Why |
|---------|-----|
| Length/volume units | Meters of wire, liters, boxes |
| Job / project tag | Bill items to a site or customer project |
| Bulk price breaks | Contractor pricing |

### Spare parts-specific

| Feature | Why |
|---------|-----|
| Part number (OEM + local) | Mechanics search by part no. |
| Vehicle / machine fitment | Optional tag (e.g. “Toyota Prius 2012”) |
| Slow vs fast mover report | Don’t tie up cash in dead stock |
| Min order qty with supplier | Reorder worksheet |

**Tip:** Use one **flexible item model** (custom fields per category) instead of four separate apps.

---

## 4. What NOT to build early (keeps you focused)

- Full double-entry accounting (let accountant use exports)
- Manufacturing / BOM (unless you target factories later)
- HR, payroll, CRM marketing automation
- Multi-country currency
- AI forecasting in v1

Add these only when paying customers ask repeatedly.

---

## 5. How to stand out vs competitors

| Angle | Idea |
|-------|------|
| **Niche positioning** | “Best for spare parts & electrical shops in Sri Lanka” beats “another POS” |
| **Faster setup** | Pre-loaded categories: common LK grocery brands, wire sizes, fuse types |
| **Honest pricing** | No hidden per-invoice fees; show Rs./month on landing page |
| **Local support** | WhatsApp support number, Sinhala video tutorials on YouTube |
| **Migration help** | “We import your Excel item list free” — lowers switching cost |
| **Mobile-first owner view** | Owner checks sales on phone while shop runs on tablet/PC |

---

## 6. Suggested tech approach (lightweight)

| Layer | Suggestion |
|-------|------------|
| App type | **Web app** (works on phone browser + shop PC) or **PWA** for offline |
| Database | PostgreSQL (Supabase) or similar — cloud backup built in |
| Auth | Phone OTP or email — simple for SMEs |
| Printing | Browser print + optional ESC/POS bridge later |
| Barcode | Phone camera + USB scanner support |

Start with **one branch, one shop type demo** (grocery is easiest to show). Expand categories after first 10 real users.

---

## 7. MVP roadmap (3 phases)

### Phase 1 — “Can run a shop tomorrow” (4–6 weeks of focused work)

- Products, stock in/out, POS bill, daily report
- Sinhala/English UI
- WhatsApp share bill
- 1 user + owner role

### Phase 2 — “Staff can use it daily”

- Multi-user, credit customers, suppliers, cheques
- Low-stock alerts, Excel export
- Thermal print, barcode
- Offline mode (if web: service worker + local DB)

### Phase 3 — “Business growth”

- Multi-branch, VAT invoice template (July 2026 compliant)
- Category-specific fields (serial no., expiry, part no.)
- SMS reminders, basic loyalty points

---

## 8. Metrics that prove value to owners

Show these on the home screen — business people care about money, not charts:

- **අද විකුණුම** (today’s sales)
- **අද ලාභය** (today’s profit estimate)
- **ණය බිලි** (outstanding credit)
- **අවසන් වෙන තොග** (items about to run out)
- **මාසික විකුණුම** vs last month (simple %)

---

## 9. Go-to-market (low cost)

1. **One real shop pilot** — grocery or spare parts in Colombo or a provincial town.
2. **Facebook / TikTok** short demos in Sinhala (“15 minutes setup”).

---

## 10. Summary — your winning checklist

- [ ] Sinhala-first, simple words
- [ ] Works offline or poor internet
- [ ] WhatsApp bills
- [ ] Owner/staff privacy
- [ ] Credit customers + suppliers
- [ ] Rs. pricing, free trial
- [ ] Grocery + spare parts category templates
- [ ] Low-stock + daily profit on home screen
- [ ] VAT-ready invoice path (before mid-2026)
- [ ] Excel export for accountant

**Build less, but make the first shop’s daily routine faster than their notebook.** That’s what makes business people switch.

---

*Research sources: Lanka POS, Takkufy, Omnis, Kale, SmartBill POS, TaxInvoice.LK, Sri Lanka VAT invoice gazette updates (2025–2026).*
