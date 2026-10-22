import type { PlanId } from "@/lib/subscription/types";
import type { SectorId } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BusinessTemplate = {
  id: string;
  nameEn: string;
  nameSi: string;
  sectorId: SectorId;
  defaultPlanId: PlanId;
};

/**
 * Fallback provisioning templates. The database is preferred; this list is
 * deliberately kept equivalent so a temporary reference-data failure never
 * downgrades a newly created shop to the wrong sector.
 */
export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    id: "grocery",
    nameEn: "Grocery & Supermarket",
    nameSi: "සිල්ලර සහ සුපිරි වෙළඳසැල්",
    sectorId: "grocery",
    defaultPlanId: "business",
  },
  {
    id: "pharmacy",
    nameEn: "Pharmacy",
    nameSi: "ඖෂධ අලෙවිසැල",
    sectorId: "pharmacy",
    defaultPlanId: "business",
  },
  {
    id: "electronics",
    nameEn: "Electronics",
    nameSi: "ඉලෙක්ට්‍රොනික උපකරණ",
    sectorId: "electronics",
    defaultPlanId: "business",
  },
  {
    id: "mobile_shop",
    nameEn: "Mobile Phones & Repair Parts",
    nameSi: "ජංගම දුරකථන සහ අමතර කොටස්",
    sectorId: "mobile_shop",
    defaultPlanId: "business",
  },
  {
    id: "electricals",
    nameEn: "Electricals",
    nameSi: "විදුලි උපකරණ",
    sectorId: "electricals",
    defaultPlanId: "business",
  },
  {
    id: "spare_parts",
    nameEn: "Auto & Machinery Spare Parts",
    nameSi: "වාහන සහ යන්ත්‍ර අමතර කොටස්",
    sectorId: "spare_parts",
    defaultPlanId: "business",
  },
  {
    id: "footwear",
    nameEn: "Footwear, Slippers & Shoes",
    nameSi: "පාවහන්, සෙරෙප්පු සහ සපත්තු",
    sectorId: "footwear",
    defaultPlanId: "business",
  },
  {
    id: "textile",
    nameEn: "Textile Wholesale & Retail",
    nameSi: "රෙදි තොග සහ සිල්ලර වෙළඳාම",
    sectorId: "textile",
    defaultPlanId: "business",
  },
  {
    id: "ac_hvac",
    nameEn: "Air Conditioning & HVAC",
    nameSi: "වායු සමනය සහ HVAC",
    sectorId: "ac_hvac",
    defaultPlanId: "pro",
  },
  {
    id: "car_sales",
    nameEn: "Car Sales & Vehicle Dealership",
    nameSi: "මෝටර් රථ වෙළඳාම",
    sectorId: "car_sales",
    defaultPlanId: "pro",
  },
];

export function getTemplate(id: string): BusinessTemplate | undefined {
  return BUSINESS_TEMPLATES.find((t) => t.id === id);
}

/** Same source as GET /api/admin/templates: DB first, local fallback. */
export async function resolveTemplate(
  admin: SupabaseClient,
  id: string,
): Promise<BusinessTemplate | undefined> {
  const { data, error } = await admin
    .from("business_templates")
    .select("id, name_en, name_si, sector_id, default_plan_id")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (!error && data) {
    return templateFromDbRow(data);
  }

  return getTemplate(id);
}

export function templateFromDbRow(row: {
  id: string;
  name_en: string;
  name_si: string;
  sector_id: string;
  default_plan_id: string;
}): BusinessTemplate {
  return {
    id: row.id,
    nameEn: row.name_en,
    nameSi: row.name_si,
    sectorId: row.sector_id as SectorId,
    defaultPlanId: row.default_plan_id as PlanId,
  };
}
