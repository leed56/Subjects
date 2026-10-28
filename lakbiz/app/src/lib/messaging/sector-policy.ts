import type { SectorId } from "@/lib/types";
import type { NotificationSettings } from "./types";

export function supportsAcServiceMessaging(sector: unknown): sector is "ac_hvac" {
  return sector === "ac_hvac";
}

export function messageRequiresAcJobs(contextType?: unknown, templateId?: unknown): boolean {
  return contextType === "ac_job" || (typeof templateId === "string" && templateId.trim().toLowerCase().startsWith("job_"));
}

export function sectorAllowsMessage(sector: unknown, contextType?: unknown, templateId?: unknown): boolean {
  return !messageRequiresAcJobs(contextType, templateId) || supportsAcServiceMessaging(sector);
}

/** Effective settings; existing stored preferences are not mutated on read. */
export function notificationSettingsForSector(settings: NotificationSettings, sector: SectorId | string): NotificationSettings {
  if (supportsAcServiceMessaging(sector)) return settings;
  return { ...settings, autoPromptOnJobStatus: false, autoSendServiceDueSms: false, autoSendOnServiceComplete: false, notifyCustomerOnServiceDue: false, notifyOwnerOnServiceDue: false, notifyTechnicianOnServiceDue: false, technicianPhone: "" };
}
