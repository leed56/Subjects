# Item categories — Sri Lanka market notes

Quick reference when designing forms and search.

## Grocery

| Field | Example |
|-------|---------|
| Unit | pcs, kg, L, pkt |
| Brand | Anchor, Maliban, MD |
| Expiry | Yes (important) |
| Barcode | Usually yes |
| Search by | Brand + size (“Anchor 400ml”) |

**Typical pain:** expired stock write-off, price changes from supplier.

---

## Electronics

| Field | Example |
|-------|---------|
| Serial no. | Per unit (phones, TVs) |
| Warranty | 12 months from sale |
| Unit | pcs |
| Search by | Model (“Samsung A15”), IMEI/serial |

**Typical pain:** returns under warranty, high-value theft control.

---

## Electricals

| Field | Example |
|-------|---------|
| Spec | 2.5mm², 13A, PVC |
| Brand | Kelani, Schneider, Legrand |
| Unit | m, coil, box, pcs |
| Search by | Spec + brand (“4mm wire kelani”) |

**Typical pain:** sold by length vs full coil; dealer vs retail price.

---

## Spare parts

| Field | Example |
|-------|---------|
| Part no. | OEM / aftermarket number |
| Fits | “Toyota Premio 2015”, “1.5kW motor” |
| Unit | pcs |
| Search by | Part number first, then vehicle/model |

**Typical pain:** thousands of SKUs, slow movers, wrong part issued.

---

## Shared item model (suggestion)

```
Item
├── category (enum)
├── name, name_si (optional)
├── barcode, sku, part_number (optional)
├── serial_numbers[] (electronics)
├── expiry_date (grocery)
├── fits_description (spare parts)
├── cost_price, sell_price, wholesale_price (optional)
├── unit, quantity_on_hand
├── reorder_level
└── supplier_id (optional)
```

One schema, category toggles which optional fields show.
