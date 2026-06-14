import type { SectorTemplate } from "./types";

export const sectors: SectorTemplate[] = [
  {
    id: "grocery",
    nameEn: "Grocery & Supermarket",
    nameSi: "සිල්ලර සහ සුපිරි වෙළඳසැල්",
    description: "Fast billing, weighted items, expiry tracking, credit customers.",
    icon: "🛒",
    extraFields: ["weightKg", "expiryDate", "barcode", "unitVariant"],
    reports: ["Daily sales", "Expiry alert", "Top sellers"],
  },
  {
    id: "electronics",
    nameEn: "Electronics",
    nameSi: "ඉලෙක්ට්‍රොනික උපකරණ",
    description: "Serial/IMEI, warranty, brand and model tracking.",
    icon: "📱",
    extraFields: ["serialNo", "imei", "warrantyMonths", "brand", "model"],
    reports: ["Warranty expiring", "Sales by brand"],
  },
  {
    id: "electricals",
    nameEn: "Electricals",
    nameSi: "විදුලි උපකරණ",
    description: "Wire meters, job billing, contractor pricing.",
    icon: "⚡",
    extraFields: ["unitType", "lengthMeters", "jobTag", "bulkPrice"],
    reports: ["Sales by project", "Stock by unit"],
  },
  {
    id: "spare_parts",
    nameEn: "Spare Parts",
    nameSi: "අමතර කොටස්",
    description: "Part numbers, vehicle fitment, dead stock aging.",
    icon: "🔧",
    extraFields: ["partNo", "oemNo", "fitment", "binLocation"],
    reports: ["Slow movers", "Fast movers", "Reorder list"],
  },
  {
    id: "ac_hvac",
    nameEn: "Air Conditioning",
    nameSi: "වායු සමනය",
    description: "BTU/HP units, serial pairs, installation jobs, service AMC.",
    icon: "❄️",
    extraFields: [
      "brand",
      "btu",
      "hp",
      "unitType",
      "indoorSerial",
      "outdoorSerial",
      "compressorWarrantyMonths",
    ],
    reports: [
      "Installations pending",
      "Warranty registrations",
      "Pipe & accessory usage",
    ],
  },
  {
    id: "car_sales",
    nameEn: "Car Sales",
    nameSi: "මෝටර් රථ වෙළඳාම",
    description: "Per-vehicle stock, landed cost, aging, finance commission.",
    icon: "🚗",
    extraFields: [
      "chassisNo",
      "engineNo",
      "regNo",
      "mileageKm",
      "reconditionCost",
      "financePartner",
    ],
    reports: [
      "Stock aging 30/60/90 days",
      "Profit per vehicle",
      "Cash vs leasing mix",
    ],
  },
];

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
