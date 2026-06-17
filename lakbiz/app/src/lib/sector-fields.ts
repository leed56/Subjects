import type { SectorId } from "@/lib/types";
import { sectorById } from "./sectors";

export type SectorFieldType = "text" | "number" | "date";

export type SectorFieldDef = {
  key: string;
  type: SectorFieldType;
  labelEn: string;
  labelSi: string;
  placeholder?: string;
};

const FIELD_DEFS: Record<string, SectorFieldDef> = {
  weightKg: {
    key: "weightKg",
    type: "number",
    labelEn: "Weight (kg)",
    labelSi: "බර (kg)",
  },
  expiryDate: {
    key: "expiryDate",
    type: "date",
    labelEn: "Expiry date",
    labelSi: "කල් ඉකුත් දිනය",
  },
  barcode: {
    key: "barcode",
    type: "text",
    labelEn: "Barcode",
    labelSi: "බාර්කෝඩ්",
  },
  unitVariant: {
    key: "unitVariant",
    type: "text",
    labelEn: "Pack size / variant",
    labelSi: "පැකේජය / වariant",
  },
  serialNo: {
    key: "serialNo",
    type: "text",
    labelEn: "Serial number",
    labelSi: "අනුක්‍රමික අංකය",
  },
  imei: {
    key: "imei",
    type: "text",
    labelEn: "IMEI",
    labelSi: "IMEI",
  },
  warrantyMonths: {
    key: "warrantyMonths",
    type: "number",
    labelEn: "Warranty (months)",
    labelSi: "සහතිකය (මාස)",
  },
  brand: {
    key: "brand",
    type: "text",
    labelEn: "Brand",
    labelSi: "වෙළඳ නාමය",
    placeholder: "Daikin, LG, Samsung…",
  },
  model: {
    key: "model",
    type: "text",
    labelEn: "Model",
    labelSi: "මාදිලිය",
  },
  lengthMeters: {
    key: "lengthMeters",
    type: "number",
    labelEn: "Length (meters)",
    labelSi: "දිග (මී)",
  },
  jobTag: {
    key: "jobTag",
    type: "text",
    labelEn: "Project / job tag",
    labelSi: "ව්‍යාපෘති tag",
  },
  bulkPrice: {
    key: "bulkPrice",
    type: "number",
    labelEn: "Bulk price (LKR)",
    labelSi: "බල්ක් මිල (රු.)",
  },
  partNo: {
    key: "partNo",
    type: "text",
    labelEn: "Part number",
    labelSi: "කොටස් අංකය",
  },
  oemNo: {
    key: "oemNo",
    type: "text",
    labelEn: "OEM number",
    labelSi: "OEM අංකය",
  },
  fitment: {
    key: "fitment",
    type: "text",
    labelEn: "Vehicle fitment",
    labelSi: "වාහන fitment",
  },
  binLocation: {
    key: "binLocation",
    type: "text",
    labelEn: "Bin / shelf location",
    labelSi: "බින් / ෴helf",
  },
  btu: {
    key: "btu",
    type: "number",
    labelEn: "Capacity (BTU)",
    labelSi: "용량 (BTU)",
    placeholder: "18000",
  },
  hp: {
    key: "hp",
    type: "number",
    labelEn: "Horsepower (HP)",
    labelSi: "HP",
  },
  unitType: {
    key: "unitType",
    type: "text",
    labelEn: "Unit type",
    labelSi: "ඒකක වර්ගය",
    placeholder: "Wall / Cassette / Ducted",
  },
  indoorSerial: {
    key: "indoorSerial",
    type: "text",
    labelEn: "Indoor serial",
    labelSi: "Indoor serial",
  },
  outdoorSerial: {
    key: "outdoorSerial",
    type: "text",
    labelEn: "Outdoor serial",
    labelSi: "Outdoor serial",
  },
  compressorWarrantyMonths: {
    key: "compressorWarrantyMonths",
    type: "number",
    labelEn: "Compressor warranty (months)",
    labelSi: "Compressor සහතික (මාස)",
  },
  chassisNo: {
    key: "chassisNo",
    type: "text",
    labelEn: "Chassis number",
    labelSi: "Chassis අංකය",
  },
  engineNo: {
    key: "engineNo",
    type: "text",
    labelEn: "Engine number",
    labelSi: "Engine අංකය",
  },
  regNo: {
    key: "regNo",
    type: "text",
    labelEn: "Registration no.",
    labelSi: "රිය.registration",
  },
  mileageKm: {
    key: "mileageKm",
    type: "number",
    labelEn: "Mileage (km)",
    labelSi: "Mileage (km)",
  },
  reconditionCost: {
    key: "reconditionCost",
    type: "number",
    labelEn: "Recondition cost (LKR)",
    labelSi: "Recondition (රු.)",
  },
  financePartner: {
    key: "financePartner",
    type: "text",
    labelEn: "Finance partner",
    labelSi: "Lease bank",
    placeholder: "Sampath, LOLC…",
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
  return Object.fromEntries(fields.map((f) => [f.key, f.type === "number" ? "" : ""]));
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

export function formatProductFieldBadge(
  product: { sectorId: SectorId; customFields: Record<string, string | number | boolean> },
): string | null {
  const { sectorId, customFields } = product;
  if (sectorId === "ac_hvac" && customFields.btu) {
    return `${customFields.btu} BTU`;
  }
  if (sectorId === "electronics" && customFields.brand) {
    return String(customFields.brand);
  }
  if (sectorId === "spare_parts" && customFields.partNo) {
    return String(customFields.partNo);
  }
  if (sectorId === "grocery" && customFields.barcode) {
    return String(customFields.barcode);
  }
  return null;
}
