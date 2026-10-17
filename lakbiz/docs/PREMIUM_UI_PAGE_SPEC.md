> Visual direction update: the user’s four RetailPro screenshots supersede the first navy design. See [REFERENCE_UI_ALIGNMENT.md](REFERENCE_UI_ALIGNMENT.md) for the current light sidebar, blue/teal controls, photographic banners, compact cards, operating tables and Owner Mobile composition.

# Premium UI coverage and interaction specification

The original requested page list is fully represented in the client showcase. Additional pages turn operational exceptions into first-class workspaces. The design system is navy, pearl and emerald, with subtle industry accents, compact operational typography, consistent metric cards, accessible drawers, responsive tables and a mobile navigation drawer.

| Page | Main composition | Sample interactions | Mobile behavior |
| --- | --- | --- | --- |
| Overview | Premium operating hero, four metrics, revenue trend, attention queue, recent activity, industry lens | Sale, inventory, reporting and identity drill-down | Stacked hero, two-column metrics, stacked panels |
| POS | Search/category catalogue, product tiles, basket, location, customer, rewards, tenders | Quantity, remove, cash/card/credit, points, finalized receipt | Two-column products then full-width basket |
| Purchases | Commitment metrics, order register, suppliers, receiving explanation | Create order; receive once; stock/payable/journal update | Register becomes labelled cards |
| Imports | Shipment portfolio, progress rail, currency/cost breakdown, product allocations | Add one/two lines; choose value/quantity basis; advance transit/customs/receipt | Cost panels stack; forms retain grouped numeric fields |
| Inventory | Catalogue metrics, filters, identity register, industry vocabulary | Search; low/held filter; product drawer with per-location stock | Labelled inventory cards; owner cost masked by role |
| Warehouses | Location cards, stock highlights, transfer trail | Source/destination transfer with overdraw prevention | Single-column location cards |
| Damage/loss | Loss metrics and reasoned movement register | Write-off; required reason; stock-loss journal | Short form with clear posting boundary |
| Returns | Original invoices, customer, values, credit-note status | Full inspected restock or quarantine; reject repeat return | Single-column invoice cards and disposition drawer |
| Finance & VAT | Receivables/payables, tax cards, journal/trial/VAT tabs | Balanced manual journal; immutable sample postings | Horizontally scrollable ledger; readable debit/credit cells |
| Customers | People/trade metrics, names, cities, tiers and owner credit | Create customer; choose person/company; credit limit | Avatar-first labelled cards |
| Loyalty | Member balances, earning/redemption policy, POS link | Earn/redeem through checkout; reverse on return | Member cards with readable point balances |
| People/access | Team directory, role/location/status, policy cards | Fictional invitation; role preview; reject unauthorized commands | Labelled people cards; owner control remains separate |
| Reports | Period selector, net revenue/profit/average/margin, chart, product rank | 7/14/30-day period; product sales CSV | Stacked charts and rankings |
| Owner Pulse | Dark phone-width owner view, sales trend, health metrics, attention | Navigate to insights, inventory and finance | Designed as a phone screen; remains readable on desktop |
| Settings | Profile/configuration, subscription card, lifecycle | Name, tax mode/rate, rewards, sample plan; reset data | Stacked configuration panels; accessible edit drawer |
| SaaS Admin | Portfolio hero, sample tenant register, current audit, tenant edit | Switch industry demo; edit current sample tenant | Tenant cards and audit list |
| Template Studio | Version/field/module metrics, contract, compatibility, template library | Inspect typed JSON; run static compatibility checks | Full-width contract drawer; template cards |

All industries use the same screens with different catalogues, identity fields, product categories, names, tracking defaults, reports and operational copy. Existing live textile roll, vehicle, HVAC job and pharmacy identity screens remain in their dedicated production workflows; sample metadata illustrates them without pretending to replace their production allocations.

## Existing live routes and design convergence

| Live area | Existing routes | Design treatment in this release |
| --- | --- | --- |
| Commerce | /sales, /bills and invoice/return/exchange/credit-note detail | Preserve existing workflows; shared page/header/surface design polish |
| Inventory | /stock, /stock/advanced/receive/queue/returns | Preserve identity flows; include cosmetics navigation |
| Textile | /stock/rolls, /stock/cutting, /stock/dispatch, /textile/trade-control, /textile/owner-intelligence | Preserve specialist engine and later workflow fixes |
| Finance | /banking, /banking/pos-routing, /vat, /expenses, /job-costing, /reports | Preserve owner-only capability and existing accounting inputs |
| Relationships | /customers, /suppliers, /settings/team | Shared premium components and consistent table patterns |
| Field/service | /jobs, /jobs/{id}/invoice, /schedule, /assets, /workforce, /teams | Preserve job/asset/workforce UI; no blind merge of conflicting older drafts |
| Vehicles | /vehicles | Preserve chassis and finance workflows; standalone industry demo catalogue |
| Organization/admin | /settings/shop/plans/billing/notifications, /admin/shops/messaging | Preserve protected live routes; public demo admin is clearly synthetic |

Shared design polish is not a claim that every live route has been individually visually certified. The complete proposed page designs are delivered in the showcase; moving every design into the live workflows requires the production adapters and regression matrix in `ERP_CAPABILITY_AUDIT.md`.

## Universal states

Every workspace handles loading, populated, empty, filtered-empty, success, validation failure and role-denied states. Posted receipt/return workflows reject duplicate posting. Held/expired sample stock is rejected at command execution, not just visually disabled. Role changes close active drawers. Forms use explicit labels, keyboard focus trapping, Escape/backdrop closing and visible errors. Tables use labelled cards below the small-screen breakpoint. Reduced-motion preferences disable transitions.

## Additional refinements

For production: standardized sticky save/cancel actions, scanner focus recovery, actual keyboard shortcuts, saved filters, verified CSV import, receipt print templates, latency and sync-state presentation, multilingual form/error copy, and cross-location availability drill-down. Keep implementation details and internal schema names out of customer-facing flows.
