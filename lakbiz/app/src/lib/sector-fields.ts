import type { SectorId } from "@/lib/types";
import { sectorById } from "./sectors";

export type SectorFieldType = "text" | "number" | "date" | "boolean";

export type SectorFieldDef = {
  key: string;
  type: SectorFieldType;
  labelEn: string;
  labelSi: string;
  placeholder?: string;
};

/**
 * Reusable field vocabulary. Sector templates select only the fields they
 * need; this avoids separate product forms per industry while still giving a
 * pharmacy, phone shop, footwear shop or HVAC company a relevant data model.
 */
const FIELD_DEFS: Record<string, SectorFieldDef> = {
  weightKg: { key: "weightKg", type: "number", labelEn: "Weight (kg)", labelSi: "බර (kg)" },
  expiryDate: { key: "expiryDate", type: "date", labelEn: "Expiry date", labelSi: "කල් ඉකුත් දිනය" },
  barcode: { key: "barcode", type: "text", labelEn: "Barcode", labelSi: "බාර්කෝඩ්" },
  unitVariant: {
    key: "unitVariant",
    type: "text",
    labelEn: "Pack size / variant",
    labelSi: "පැකේජ ප්‍රමාණය / ප්‍රභේදය",
    placeholder: "500 g, 1 L, 12 pack…",
  },
  serialNo: { key: "serialNo", type: "text", labelEn: "Serial number", labelSi: "අනුක්‍රමික අංකය" },
  imei: { key: "imei", type: "text", labelEn: "IMEI", labelSi: "IMEI" },
  warrantyMonths: { key: "warrantyMonths", type: "number", labelEn: "Warranty (months)", labelSi: "වගකීම් කාලය (මාස)" },
  brand: {
    key: "brand",
    type: "text",
    labelEn: "Brand",
    labelSi: "වෙළඳ නාමය",
    placeholder: "Daikin, Samsung, Bata…",
  },
  manufacturer: {
    key: "manufacturer",
    type: "text",
    labelEn: "Manufacturer",
    labelSi: "නිෂ්පාදකයා",
  },
  model: { key: "model", type: "text", labelEn: "Model", labelSi: "මාදිලිය" },
  color: { key: "color", type: "text", labelEn: "Colour", labelSi: "වර්ණය" },
  year: { key: "year", type: "number", labelEn: "Year", labelSi: "වර්ෂය" },
  lengthMeters: { key: "lengthMeters", type: "number", labelEn: "Length (meters)", labelSi: "දිග (මීටර්)" },
  jobTag: { key: "jobTag", type: "text", labelEn: "Project / job tag", labelSi: "ව්‍යාපෘති / වැඩ සලකුණ" },
  bulkPrice: { key: "bulkPrice", type: "number", labelEn: "Bulk price (LKR)", labelSi: "තොග මිල (රු.)" },
  partNo: { key: "partNo", type: "text", labelEn: "Part number", labelSi: "කොටස් අංකය" },
  oemNo: { key: "oemNo", type: "text", labelEn: "OEM number", labelSi: "OEM අංකය" },
  fitment: {
    key: "fitment",
    type: "text",
    labelEn: "Vehicle / machine fitment",
    labelSi: "ගැළපෙන වාහනය / යන්ත්‍රය",
    placeholder: "Toyota Axio 2014–2018…",
  },
  binLocation: { key: "binLocation", type: "text", labelEn: "Bin / shelf location", labelSi: "බින් / රාක්ක ස්ථානය" },
  supplierPartNo: { key: "supplierPartNo", type: "text", labelEn: "Supplier's part number", labelSi: "සැපයුම්කරුගේ කොටස් අංකය" },
  compatibleModels: {
    key: "compatibleModels",
    type: "text",
    labelEn: "Compatible model(s)",
    labelSi: "ගැළපෙන මාදිලි",
    placeholder: "iPhone 15 / A3090, Daikin FTKC…",
  },

  // Pharmacy
  genericName: {
    key: "genericName",
    type: "text",
    labelEn: "Generic / active ingredient",
    labelSi: "සාමාන්‍ය නාමය / ක්‍රියාකාරී ද්‍රව්‍යය",
    placeholder: "Paracetamol…",
  },
  dosageForm: {
    key: "dosageForm",
    type: "text",
    labelEn: "Dosage form",
    labelSi: "ඖෂධ ආකාරය",
    placeholder: "Tablet, capsule, syrup, cream…",
  },
  strength: {
    key: "strength",
    type: "text",
    labelEn: "Strength",
    labelSi: "ශක්තිය",
    placeholder: "500 mg, 5 mg/ml…",
  },
  packSize: {
    key: "packSize",
    type: "text",
    labelEn: "Pack size",
    labelSi: "පැකේජ ප්‍රමාණය",
    placeholder: "10 tablets, 100 ml…",
  },
  batchNo: { key: "batchNo", type: "text", labelEn: "Batch / lot number", labelSi: "බැච් / ලොට් අංකය" },
  requiresPrescription: {
    key: "requiresPrescription",
    type: "boolean",
    labelEn: "Prescription required",
    labelSi: "වෛද්‍ය වට්ටෝරුව අවශ්‍යයි",
  },

  // Mobile / device retail
  storageGb: {
    key: "storageGb",
    type: "number",
    labelEn: "Storage (GB)",
    labelSi: "ගබඩා ධාරිතාව (GB)",
    placeholder: "128",
  },

  // Footwear / fashion variants
  styleCode: { key: "styleCode", type: "text", labelEn: "Style / article code", labelSi: "ස්ටයිල් / භාණ්ඩ කේතය" },
  size: { key: "size", type: "text", labelEn: "Size", labelSi: "ප්‍රමාණය", placeholder: "UK 8 / EU 42…" },
  material: { key: "material", type: "text", labelEn: "Material", labelSi: "ද්‍රව්‍යය", placeholder: "Leather, rubber, EVA…" },
  gender: { key: "gender", type: "text", labelEn: "Gender / range", labelSi: "වර්ගය", placeholder: "Men, Women, Kids, Unisex…" },

  // HVAC
  btu: { key: "btu", type: "number", labelEn: "Capacity (BTU)", labelSi: "ධාරිතාව (BTU)", placeholder: "18000" },
  hp: { key: "hp", type: "number", labelEn: "Horsepower (HP)", labelSi: "අශ්වබල (HP)" },
  unitType: {
    key: "unitType",
    type: "text",
    labelEn: "Unit type",
    labelSi: "ඒකක වර්ගය",
    placeholder: "Wall / Cassette / Ducted",
  },
  indoorSerial: { key: "indoorSerial", type: "text", labelEn: "Indoor serial", labelSi: "ඇතුළත ඒකක අනුක්‍රමික අංකය" },
  outdoorSerial: { key: "outdoorSerial", type: "text", labelEn: "Outdoor serial", labelSi: "පිටත ඒකක අනුක්‍රමික අංකය" },
  compressorWarrantyMonths: {
    key: "compressorWarrantyMonths",
    type: "number",
    labelEn: "Compressor warranty (months)",
    labelSi: "කම්ප්‍රෙසර් වගකීම (මාස)",
  },
  serialRequired: {
    key: "serialRequired",
    type: "boolean",
    labelEn: "Serial number required per unit",
    labelSi: "එක් ඒකකයකට අනුක්‍රමික අංකයක් අවශ්‍යයි",
  },

  // Vehicle dealership
  chassisNo: { key: "chassisNo", type: "text", labelEn: "Chassis number", labelSi: "චැසි අංකය" },
  engineNo: { key: "engineNo", type: "text", labelEn: "Engine number", labelSi: "එන්ජින් අංකය" },
  regNo: { key: "regNo", type: "text", labelEn: "Registration no.", labelSi: "ලියාපදිංචි අංකය" },
  mileageKm: { key: "mileageKm", type: "number", labelEn: "Mileage (km)", labelSi: "ධාවන දුර (කි.මී.)" },
  reconditionCost: { key: "reconditionCost", type: "number", labelEn: "Recondition cost (LKR)", labelSi: "ප්‍රතිසංස්කරණ වියදම (රු.)" },
  financePartner: {
    key: "financePartner",
    type: "text",
    labelEn: "Finance / leasing partner",
    labelSi: "මූල්‍ය / ලීසිං ආයතනය",
    placeholder: "LOLC, People's Leasing…",
  },
};

export function sectorFormFields(sectorId: SectorId): SectorFieldDef[] {
  const sector = sectorById(sectorId);
  if (!sector) return [];
  return sector.extraFields
    .map((key) => FIELD_DEFS[key])
    .filter((def): def is SectorFieldDef => Boolean(def));
}

export function emptyCustomFieldsForSector(
  sectorId: SectorId,
): Record<string, string | number> {
  const fields = sectorFormFields(sectorId);
  return Object.fromEntries(fields.map((f) => [f.key, f.type === "boolean" ? "false" : ""]));
}

export function sanitizeCustomFields(
  sectorId: SectorId,
  raw: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const field of sectorFormFields(sectorId)) {
    const value = raw[field.key];
    if (value === "" || value === undefined || value === null) continue;
    if (field.type === "number") {
      const n = Number(value);
      if (!Number.isNaN(n)) out[field.key] = n;
    } else if (field.type === "boolean") {
      out[field.key] = value === true || value === "true";
    } else {
      out[field.key] = String(value);
    }
  }
  return out;
}

export function customFieldsFromProduct(
  product: { sectorId: SectorId; customFields: Record<string, string | number | boolean> },
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of sectorFormFields(product.sectorId)) {
    const value = product.customFields[field.key];
    out[field.key] = value != null ? String(value) : "";
  }
  return out;
}

/** One concise secondary identifier for dense inventory rows. */
export function formatProductFieldBadge(
  product: { sectorId: SectorId; customFields: Record<string, string | number | boolean> },
): string | null {
  const { sectorId, customFields } = product;
  if (sectorId === "ac_hvac" && customFields.btu) return `${customFields.btu} BTU`;
  if (sectorId === "ac_hvac" && customFields.partNo) return String(customFields.partNo);
  if (sectorId === "pharmacy" && customFields.strength) return String(customFields.strength);
  if (sectorId === "pharmacy" && customFields.batchNo) return `Batch ${customFields.batchNo}`;
  if (sectorId === "mobile_shop" && customFields.imei) return `IMEI ${customFields.imei}`;
  if (sectorId === "mobile_shop" && customFields.model) return String(customFields.model);
  if (sectorId === "electronics" && customFields.brand) return String(customFields.brand);
  if (sectorId === "spare_parts" && customFields.partNo) return String(customFields.partNo);
  if (sectorId === "footwear" && customFields.size) return `Size ${customFields.size}`;
  if (sectorId === "grocery" && customFields.barcode) return String(customFields.barcode);
  if (sectorId === "car_sales" && customFields.chassisNo) return String(customFields.chassisNo);
  return null;
}
