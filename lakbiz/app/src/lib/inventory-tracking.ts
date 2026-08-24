import type { SectorId } from "@/lib/types";

export type InventoryTrackingMode =
  | "simple"
  | "lot"
  | "serial"
  | "variant"
  | "variant_serial"
  | "variant_lot";

// Textile physical identity is owned by the dedicated roll ledger. Generic
// variant/lot allocation must remain off or it would compete with roll checkout.

export type InventoryTrackingPreset = {
  defaultMode: InventoryTrackingMode;
  allowedModes: InventoryTrackingMode[];
  variantAxes: string[];
  fefo: boolean;
  reasonEn: string;
  reasonSi: string;
};

/**
 * Vertical inventory defaults. These do not silently convert an existing
 * product: they drive onboarding/advanced-stock UI and the profile that is
 * explicitly saved for a product. That keeps legacy/simple stock safe while
 * giving new vertical templates an industry-correct starting point.
 */
const PRESETS: Record<SectorId, InventoryTrackingPreset> = {
  grocery: {
    defaultMode: "simple",
    allowedModes: ["simple", "lot", "variant", "variant_lot"],
    variantAxes: ["pack"],
    fefo: true,
    reasonEn: "Most grocery items are simple stock; expiry-sensitive goods can opt into batch/FEFO tracking.",
    reasonSi: "බොහෝ සිල්ලර භාණ්ඩ සරල තොග ලෙස පාලනය කළ හැකි අතර කල් ඉකුත් වන භාණ්ඩ සඳහා batch/FEFO භාවිතා කළ හැක.",
  },
  pharmacy: {
    defaultMode: "lot",
    allowedModes: ["lot", "variant_lot"],
    variantAxes: ["strength", "pack"],
    fefo: true,
    reasonEn: "Medicines require batch identity and expiry-aware FEFO stock selection.",
    reasonSi: "ඖෂධ සඳහා batch හඳුනාගැනීම සහ කල් ඉකුත් දිනය අනුව FEFO තොග තේරීම අවශ්‍ය වේ.",
  },
  electronics: {
    defaultMode: "serial",
    allowedModes: ["simple", "serial", "variant", "variant_serial"],
    variantAxes: ["model", "colour"],
    fefo: false,
    reasonEn: "High-value devices benefit from serial/warranty identity; accessories can stay simple or variant based.",
    reasonSi: "වටිනා උපාංග සඳහා serial/warranty හඳුනාගැනීම වැදගත් වන අතර උපාංග සරල හෝ variant ලෙස පාලනය කළ හැක.",
  },
  mobile_shop: {
    defaultMode: "variant_serial",
    allowedModes: ["simple", "serial", "variant", "variant_serial"],
    variantAxes: ["storage", "colour"],
    fefo: false,
    reasonEn: "Phones need model/storage/colour variants plus one IMEI/serial record per physical device.",
    reasonSi: "දුරකථන සඳහා model/storage/colour variants සහ එක් එක් භෞතික උපාංගයට IMEI/serial වාර්තාවක් අවශ්‍ය වේ.",
  },
  electricals: {
    defaultMode: "simple",
    allowedModes: ["simple", "variant"],
    variantAxes: ["rating", "length"],
    fefo: false,
    reasonEn: "Most electrical stock is quantity based; size/rating variations can use variants where needed.",
    reasonSi: "බොහෝ විදුලි තොග ප්‍රමාණය අනුව පාලනය වන අතර rating/length වෙනස්කම් සඳහා variants භාවිතා කළ හැක.",
  },
  spare_parts: {
    defaultMode: "simple",
    allowedModes: ["simple", "variant", "serial"],
    variantAxes: ["fitment"],
    fefo: false,
    reasonEn: "Part/OEM identity is usually enough; selected high-value components may use serial tracking.",
    reasonSi: "සාමාන්‍යයෙන් Part/OEM හඳුනාගැනීම ප්‍රමාණවත් වන අතර වටිනා කොටස් සඳහා serial tracking භාවිතා කළ හැක.",
  },
  footwear: {
    defaultMode: "variant",
    allowedModes: ["variant"],
    variantAxes: ["size", "colour"],
    fefo: false,
    reasonEn: "Each size/colour combination must have its own stock quantity and barcode/SKU where used.",
    reasonSi: "එක් එක් ප්‍රමාණ/වර්ණ සංයෝජනයට වෙනම තොග ප්‍රමාණයක් සහ අවශ්‍ය නම් barcode/SKU තිබිය යුතුය.",
  },
  textile: {
    defaultMode: "simple",
    allowedModes: ["simple"],
    variantAxes: [],
    fefo: false,
    reasonEn: "Fabric identity, dye lots and measured availability are controlled by the dedicated physical-roll ledger, not generic lot allocation.",
    reasonSi: "රෙදි identity, dye lot සහ මිනුම් තොගය generic lot allocation මගින් නොව dedicated roll ledger මගින් පාලනය වේ.",
  },
  ac_hvac: {
    defaultMode: "simple",
    allowedModes: ["simple", "serial", "variant", "variant_serial"],
    variantAxes: ["capacity", "unitType"],
    fefo: false,
    reasonEn: "Parts remain simple stock; complete AC units can opt into serial identity while installed equipment continues into Assets.",
    reasonSi: "අමතර කොටස් සරල තොග ලෙස තබා AC ඒකක සඳහා serial identity භාවිතා කර ස්ථාපිත උපකරණ Assets වෙත ගෙන යා හැක.",
  },
  car_sales: {
    defaultMode: "simple",
    allowedModes: ["simple"],
    variantAxes: [],
    fefo: false,
    reasonEn: "Vehicle identity is handled by the dedicated Vehicles module using chassis/engine records, not generic stock variants.",
    reasonSi: "වාහන හඳුනාගැනීම generic stock variants මගින් නොව dedicated Vehicles module හි chassis/engine වාර්තා මගින් පාලනය වේ.",
  },
};

export function inventoryTrackingPreset(sectorId: SectorId): InventoryTrackingPreset {
  return PRESETS[sectorId] ?? PRESETS.grocery;
}

export function defaultInventoryTrackingMode(sectorId: SectorId): InventoryTrackingMode {
  return inventoryTrackingPreset(sectorId).defaultMode;
}

export function inventoryModeLabel(mode: InventoryTrackingMode, locale: "en" | "si" = "en"): string {
  const labels: Record<InventoryTrackingMode, [string, string]> = {
    simple: ["Simple quantity", "සරල තොග ප්‍රමාණය"],
    lot: ["Batch / expiry lots", "බැච් / කල් ඉකුත් තොග"],
    serial: ["Serial / IMEI units", "Serial / IMEI ඒකක"],
    variant: ["Size / colour variants", "ප්‍රමාණ / වර්ණ variants"],
    variant_serial: ["Variants + serial / IMEI", "Variants + serial / IMEI"],
    variant_lot: ["Variants + batch / expiry", "Variants + බැච් / කල් ඉකුත්"],
  };
  return labels[mode][locale === "si" ? 1 : 0];
}
