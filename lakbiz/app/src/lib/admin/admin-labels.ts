import type { BusinessTemplate } from "@/lib/admin/templates";
import type { Locale } from "@/lib/i18n/translations";
import { sectorById } from "@/lib/sectors";
import type { SectorId } from "@/lib/types";

export function adminPlanLabel(t: (key: string) => string, planId: string): string {
  const key = `admin.plan_${planId}`;
  const label = t(key);
  return label === key ? planId : label;
}

export function adminStatusLabel(t: (key: string) => string, status: string): string {
  const key = `admin.status_${status}`;
  const label = t(key);
  return label === key ? status.replace(/_/g, " ") : label;
}

export function adminSectorLabel(locale: Locale, sectorId: string): string {
  const sector = sectorById(sectorId as SectorId);
  if (!sector) return sectorId.replace(/_/g, " ");
  return locale === "si" ? sector.nameSi : sector.nameEn;
}

export function adminTemplateLabel(
  template: Pick<BusinessTemplate, "nameEn" | "nameSi">,
  locale: Locale,
): string {
  return locale === "si" ? template.nameSi : template.nameEn;
}

export function formatAdminDate(
  iso: string | null,
  locale: Locale,
  emptyLabel: string,
): string {
  if (!iso) return emptyLabel;
  const tag = locale === "si" ? "si-LK" : "en-LK";
  return new Date(iso).toLocaleDateString(tag, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
