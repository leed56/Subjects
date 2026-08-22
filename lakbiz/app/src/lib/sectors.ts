import type { SectorTemplate } from "./types";
import type { SectorId } from "./types";

/**
 * Sector templates are operational presets, not cosmetic labels. A newly
 * provisioned shop is locked to one of these sectors, which drives its stock
 * categories, sector-specific item fields, feature/module gates and reports.
 *
 * The presets intentionally follow common Sri Lankan SME workflows: LKR
 * pricing, credit customers, supplier purchasing, expiry/batch tracking where
 * relevant, IMEI/serial/warranty for devices, fitment/bin locations for parts,
 * and job/service lifecycle for HVAC.
 */
export const sectors: SectorTemplate[] = [
  {
    id: "grocery",
    nameEn: "Grocery & Supermarket",
    nameSi: "සිල්ලර සහ සුපිරි වෙළඳසැල්",
    description: "Fast counter billing, barcode/pack items, expiry awareness and customer credit.",
    extraFields: ["barcode", "unitVariant", "weightKg", "expiryDate", "brand", "manufacturer"],
    reports: ["Daily sales", "Low stock & reorder", "Expiry alert", "Fast/slow movers", "Credit customers"],
  },
  {
    id: "pharmacy",
    nameEn: "Pharmacy",
    nameSi: "ඖෂධ අලෙවිසැල",
    description: "Medicine catalogue, batch/expiry, dosage/strength and prescription-aware retail.",
    extraFields: [
      "genericName",
      "brand",
      "manufacturer",
      "dosageForm",
      "strength",
      "packSize",
      "batchNo",
      "expiryDate",
      "barcode",
      "requiresPrescription",
    ],
    reports: ["Expiry risk", "Near-expiry stock", "Low stock & reorder", "Sales by medicine/category", "Batch reference"],
  },
  {
    id: "electronics",
    nameEn: "Electronics",
    nameSi: "ඉලෙක්ට්‍රොනික උපකරණ",
    description: "Serial numbers, warranty, brand/model and accessory stock tracking.",
    extraFields: ["serialNo", "warrantyMonths", "brand", "model", "barcode", "supplierPartNo"],
    reports: ["Warranty expiring", "Sales by brand", "Serial-tracked sales", "Low stock & reorder"],
  },
  {
    id: "mobile_shop",
    nameEn: "Mobile Phones & Repair Parts",
    nameSi: "ජංගම දුරකථන සහ අමතර කොටස්",
    description: "IMEI/serial devices plus model-compatible repair parts, accessories and warranties.",
    extraFields: [
      "brand",
      "model",
      "imei",
      "serialNo",
      "storageGb",
      "color",
      "warrantyMonths",
      "partNo",
      "supplierPartNo",
      "compatibleModels",
      "binLocation",
      "barcode",
    ],
    reports: ["IMEI/serial register", "Warranty expiring", "Parts by compatible model", "Used-device stock", "Fast/slow movers"],
  },
  {
    id: "electricals",
    nameEn: "Electricals",
    nameSi: "විදුලි උපකරණ",
    description: "Wire/cable by length, fixtures, project references and contractor/bulk pricing.",
    extraFields: ["brand", "unitType", "lengthMeters", "jobTag", "bulkPrice", "partNo", "binLocation"],
    reports: ["Sales by project", "Stock by unit", "Cable/length movement", "Low stock & reorder"],
  },
  {
    id: "spare_parts",
    nameEn: "Auto & Machinery Spare Parts",
    nameSi: "වාහන සහ යන්ත්‍ර අමතර කොටස්",
    description: "Part/OEM numbers, vehicle fitment, bin locations and dead-stock aging.",
    extraFields: ["brand", "partNo", "oemNo", "fitment", "supplierPartNo", "binLocation", "barcode"],
    reports: ["Slow movers", "Fast movers", "Reorder list", "Dead-stock aging", "Sales by fitment/brand"],
  },
  {
    id: "footwear",
    nameEn: "Footwear, Slippers & Shoes",
    nameSi: "පාවහන්, සෙරෙප්පු සහ සපත්තු",
    description: "Style, size, colour and gender variants for shoes, slippers, sandals and school footwear.",
    extraFields: ["brand", "styleCode", "size", "color", "material", "gender", "barcode"],
    reports: ["Sales by size", "Sales by style", "Size gaps", "Fast/slow movers", "Low stock & reorder"],
  },
  {
    id: "ac_hvac",
    nameEn: "Air Conditioning & HVAC",
    nameSi: "වායු සමනය සහ HVAC",
    description: "AC units, parts, installations, repairs, technicians, warranties and recurring service.",
    extraFields: [
      "brand",
      "btu",
      "hp",
      "unitType",
      "indoorSerial",
      "outdoorSerial",
      "compressorWarrantyMonths",
      "partNo",
      "supplierPartNo",
      "compatibleModels",
      "binLocation",
      "warrantyMonths",
      "serialRequired",
    ],
    reports: [
      "Installations pending",
      "Service due & overdue",
      "Warranty registrations",
      "Parts & material usage",
      "Job profitability",
    ],
  },
  {
    id: "car_sales",
    nameEn: "Car Sales & Vehicle Dealership",
    nameSi: "මෝටර් රථ වෙළඳාම",
    description: "Per-vehicle inventory, chassis/engine identity, landed/recondition cost, aging and finance sales.",
    extraFields: [
      "chassisNo",
      "engineNo",
      "regNo",
      "brand",
      "model",
      "year",
      "mileageKm",
      "color",
      "reconditionCost",
      "financePartner",
    ],
    reports: ["Stock aging 30/60/90 days", "Profit per vehicle", "Cash vs leasing mix", "Sold vs available vehicles"],
  },
];

const SECTOR_IDS: SectorId[] = [
  "grocery",
  "pharmacy",
  "electronics",
  "mobile_shop",
  "electricals",
  "spare_parts",
  "footwear",
  "ac_hvac",
  "car_sales",
];

export function parseSectorId(value: string | null | undefined): SectorId {
  if (value && SECTOR_IDS.includes(value as SectorId)) {
    return value as SectorId;
  }
  return "grocery";
}

export function sectorById(id: SectorId): SectorTemplate | undefined {
  return sectors.find((s) => s.id === id);
}

export function defaultCategoryForSector(sectorId: SectorId): string {
  const map: Record<SectorId, string> = {
    grocery: "Grocery",
    pharmacy: "Medicines",
    electronics: "Electronics",
    mobile_shop: "Mobile Phones",
    electricals: "Electricals",
    spare_parts: "Spare Parts",
    footwear: "Footwear",
    ac_hvac: "Air Conditioning",
    car_sales: "Vehicles",
  };
  return map[sectorId];
}

/** Stock categories scoped to each business template — not a global mix. */
export function categoriesForSector(sectorId: SectorId): string[] {
  const map: Record<SectorId, string[]> = {
    grocery: [
      "Grocery",
      "Rice, Flour & Grains",
      "Beverages",
      "Dairy & Chilled",
      "Frozen",
      "Snacks & Confectionery",
      "Household",
      "Personal Care",
      "Baby Care",
      "Other",
    ],
    pharmacy: [
      "Medicines",
      "Prescription Medicines",
      "OTC Medicines",
      "Vitamins & Supplements",
      "Medical Devices",
      "First Aid",
      "Personal Care",
      "Baby Care",
      "Other",
    ],
    electronics: ["Electronics", "Home Appliances", "Computer Accessories", "Cables & Adapters", "Accessories", "Other"],
    mobile_shop: [
      "Mobile Phones",
      "Tablets",
      "Used Devices",
      "Chargers & Cables",
      "Cases & Screen Protectors",
      "Batteries",
      "Displays & Touchscreens",
      "Cameras",
      "Flex Cables & Connectors",
      "PCBs & ICs",
      "Repair Parts",
      "Accessories",
      "Other",
    ],
    electricals: ["Electricals", "Wire & Cable", "Switches & Sockets", "Breakers & Protection", "Lighting", "Fixtures", "Tools", "Other"],
    spare_parts: [
      "Spare Parts",
      "Engine Parts",
      "Suspension & Steering",
      "Brake Parts",
      "Filters",
      "Electrical & Sensors",
      "Body Parts",
      "Lubricants & Fluids",
      "Accessories",
      "Other",
    ],
    footwear: [
      "Footwear",
      "Men's Shoes",
      "Women's Shoes",
      "Kids' Shoes",
      "School Shoes",
      "Slippers & Sandals",
      "Sports Shoes",
      "Safety Shoes",
      "Socks & Accessories",
      "Other",
    ],
    ac_hvac: [
      "Air Conditioning",
      "Pipe & Accessories",
      "Consumables",
      "Service Parts",
      "Compressors",
      "Coils (Condenser & Evaporator)",
      "PCBs & Control Boards",
      "Capacitors, Relays & Contactors",
      "Motors & Fans",
      "Sensors & Thermostats",
      "Valves & Refrigerant Controls",
      "Refrigerant & Gas",
      "Copper Pipe & Fittings",
      "Insulation & Cladding",
      "Drain Components",
      "Filters",
      "Bearings & Mounts",
      "Electrical (Terminals, Breakers, Fuses, Cables)",
      "Brackets & Vibration Pads",
      "Other",
    ],
    car_sales: ["Vehicles", "New Vehicles", "Used Vehicles", "Reconditioned Vehicles", "Accessories", "Other"],
  };
  return map[sectorId] ?? [defaultCategoryForSector(sectorId), "Other"];
}

export function normalizeProductCategory(
  sectorId: SectorId,
  category: string,
): string {
  const trimmed = category.trim();
  const allowed = categoriesForSector(sectorId);
  return allowed.includes(trimmed) ? trimmed : defaultCategoryForSector(sectorId);
}

export const bankingModules = {
  nameEn: "Banking & Payments",
  nameSi: "බැංකු සහ ගෙවීම්",
  features: [
    "Multiple bank accounts (BOC, People's, Sampath, HNB…)",
    "Cheque in / out register with PDC alerts",
    "Cash + bank + credit mixed payments",
    "Customer & supplier outstanding",
    "Bank reconciliation (CSV import) — Phase 2",
  ],
};
