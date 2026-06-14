# LakBiz — Data Model (Starter)

Flexible schema so **one codebase** supports grocery, AC, cars, spare parts, and banking.

---

## Core entities (every business)

```
Organization
  ├── Branches
  ├── Users (roles: owner, manager, cashier, technician)
  ├── BankAccounts
  ├── Customers
  ├── Suppliers
  └── SectorTemplates[]   // e.g. ["grocery", "ac_hvac"]

Product                    // bulk items: rice, wire, AC model line
  ├── category
  ├── customFields{}       // JSON per sector template
  └── stockLevels[]        // per branch

VehicleUnit                // car sales: qty always 1 per record
  ├── chassisNo (unique)
  ├── customFields{}
  └── costLines[]          // purchase, recondition, etc.

Job                        // AC install, electrical project
  ├── customer
  ├── quotationLines[]
  ├── status
  └── linkedStockMovements[]

StockMovement              // in | out | adjust | transfer
  ├── productId | vehicleUnitId
  ├── quantity
  └── reference (sale, purchase, job)

Sale / Invoice
  ├── lines[]
  ├── payments[]           // cash, transfer, cheque, credit
  └── sectorMeta{}

Cheque
  ├── direction
  ├── status
  └── linkedPaymentId

Payment                    // allocation to invoice(s)
```

---

## Sector custom fields (JSON examples)

### AC product template

```json
{
  "brand": "Daikin",
  "unitType": "wall_mounted",
  "btu": 18000,
  "hp": 1.5,
  "inverter": true,
  "refrigerant": "R32",
  "compressorWarrantyMonths": 60,
  "unitWarrantyMonths": 12,
  "requiresPairStock": true
}
```

### Car vehicle unit template

```json
{
  "make": "Toyota",
  "model": "Prius",
  "year": 2018,
  "chassisNo": "JT2BF28K...",
  "engineNo": "1NZ...",
  "mileageKm": 85000,
  "fuel": "hybrid",
  "transmission": "auto",
  "condition": "reconditioned",
  "status": "for_sale",
  "reconditionCost": 250000
}
```

### Cheque payment template

```json
{
  "chequeNo": "001245",
  "bankName": "People's Bank",
  "chequeDate": "2026-06-20",
  "postDated": true,
  "status": "pending"
}
```

---

## Key design rules

1. **Products vs VehicleUnits** — groceries/AC units in bulk use `Product`; cars use `VehicleUnit` (always one-off).
2. **AC serial pair** — on sale, deduct indoor + outdoor serials from `SerialStock` child table.
3. **Jobs** — AC installation consumes accessories (pipe meters) via `StockMovement` linked to `Job`.
4. **Banking** — every `Payment` ties to `BankAccount` or `CashDrawer`; cheques are a payment subtype with lifecycle.
5. **Owner privacy** — `purchasePrice`, `margin`, `minPrice` hidden from cashier role.

---

## MVP tables (Phase 1)

| Table | Purpose |
|-------|---------|
| organizations | Tenant |
| users | Login + role |
| products | Catalog |
| stock_movements | Ledger |
| customers | CRM + credit |
| sales | Invoices |
| sale_lines | Line items |
| payments | Cash/transfer/credit |

Phase 2 adds: `bank_accounts`, `cheques`, `vehicle_units`, `jobs`, `suppliers`.

---

## Tech note

When building in `lakbiz/app/`, types live in `src/lib/types/` mirroring this model.
