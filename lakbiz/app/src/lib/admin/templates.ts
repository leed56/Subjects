import type { PlanId } from "@/lib/subscription/types";
import type { SectorId } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Global premium UI phase, Part 28 — `icon` (a raw emoji) dropped from
// this type entirely: every template already carries `sectorId`, and
// `sectorId` is all a render site needs to look up the real SVG icon via
// <SectorIcon> (see sector-icon.tsx) — a second, redundant icon field
// that could drift from the sector's own icon was never necessary.
export type BusinessTemplate = {
  id: string;
  nameEn: string;
  nameSi: string;
  sectorId: SectorId;
  defaultPlanId: PlanId;
};

/** Fallback templates when DB row unavailable (matches migration seed). */
export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    id: "grocery",
    nameEn: "Grocery & Supermarket",
    nameSi: "සිල්ලර සහ සුපිරි වෙළඳසැල්",
    sectorId: "grocery",
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
    id: "electricals",
    nameEn: "Electricals",
    nameSi: "විදුලි උපකරණ",
    sectorId: "electricals",
    defaultPlanId: "business",
  },
  {
    id: "spare_parts",
    nameEn: "Spare Parts",
    nameSi: "අමතර කොටස්",
    sectorId: "spare_parts",
    defaultPlanId: "business",
  },
  {
    id: "ac_hvac",
    nameEn: "Air Conditioning",
    nameSi: "වායු සමනය",
    sectorId: "ac_hvac",
    defaultPlanId: "pro",
  },
  {
    id: "car_sales",
    nameEn: "Car Sales",
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
