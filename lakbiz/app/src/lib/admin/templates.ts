import type { PlanId } from "@/lib/subscription/types";
import type { SectorId } from "@/lib/types";
import { sectorById } from "@/lib/sectors";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BusinessTemplate = {
  id: string;
  nameEn: string;
  nameSi: string;
  sectorId: SectorId;
  defaultPlanId: PlanId;
  icon: string;
};

/** Fallback templates when DB row unavailable (matches migration seed). */
export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    id: "grocery",
    nameEn: "Grocery & Supermarket",
    nameSi: "සිල්ලර සහ සුපිරි වෙළඳසැල්",
    sectorId: "grocery",
    defaultPlanId: "business",
    icon: "🛒",
  },
  {
    id: "electronics",
    nameEn: "Electronics",
    nameSi: "ඉලෙක්ට්‍රොනික උපකරණ",
    sectorId: "electronics",
    defaultPlanId: "business",
    icon: "📱",
  },
  {
    id: "electricals",
    nameEn: "Electricals",
    nameSi: "විදුලි උපකරණ",
    sectorId: "electricals",
    defaultPlanId: "business",
    icon: "⚡",
  },
  {
    id: "spare_parts",
    nameEn: "Spare Parts",
    nameSi: "අමතර කොටස්",
    sectorId: "spare_parts",
    defaultPlanId: "business",
    icon: "🔧",
  },
  {
    id: "ac_hvac",
    nameEn: "Air Conditioning",
    nameSi: "වායු සමනය",
    sectorId: "ac_hvac",
    defaultPlanId: "pro",
    icon: "❄️",
  },
  {
    id: "car_sales",
    nameEn: "Car Sales",
    nameSi: "මෝටර් රථ වෙළඳාම",
    sectorId: "car_sales",
    defaultPlanId: "pro",
    icon: "🚗",
  },
];

export function getTemplate(id: string): BusinessTemplate | undefined {
  const local = BUSINESS_TEMPLATES.find((t) => t.id === id);
  if (local) {
    const sector = sectorById(local.sectorId);
    return { ...local, icon: sector?.icon ?? local.icon };
  }
  return undefined;
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
  const sectorId = row.sector_id as SectorId;
  const sector = sectorById(sectorId);
  return {
    id: row.id,
    nameEn: row.name_en,
    nameSi: row.name_si,
    sectorId,
    defaultPlanId: row.default_plan_id as PlanId,
    icon: sector?.icon ?? "🏪",
  };
}
