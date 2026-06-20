import { newId } from "@/lib/format";
import { DEFAULT_SERVICE_DUE_REMIND_DAYS } from "@/lib/ac-service";
import type {
  MessageChannel,
  MessageTemplateId,
  NotificationLogEntry,
  NotificationSettings,
} from "./types";

const SETTINGS_KEY = "lakbiz-notification-settings-v1";
const LOG_KEY = "lakbiz-notification-log-v1";
const MAX_LOG = 100;

export const defaultNotificationSettings = (): NotificationSettings => ({
  defaultChannel: "whatsapp",
  preferredLanguage: "si",
  autoPromptOnJobStatus: true,
  smsSenderId: "",
  autoSendServiceDueSms: false,
  serviceDueRemindDaysBefore: 3,
  serviceDueRemindDays: [...DEFAULT_SERVICE_DUE_REMIND_DAYS],
  ownerPhone: "",
  technicianPhone: "",
  notifyCustomerOnServiceDue: true,
  notifyOwnerOnServiceDue: true,
  notifyTechnicianOnServiceDue: true,
  defaultServiceIntervalDays: 180,
  autoSendOnServiceComplete: true,
});

export function parseNotificationSettings(raw: unknown): NotificationSettings {
  const defaults = defaultNotificationSettings();
  if (!raw || typeof raw !== "object") return defaults;

  const row = raw as Record<string, unknown>;
  return {
    ...defaults,
    defaultChannel:
      row.defaultChannel === "sms" ||
      row.defaultChannel === "api_sms" ||
      row.defaultChannel === "whatsapp"
        ? row.defaultChannel
        : defaults.defaultChannel,
    preferredLanguage:
      row.preferredLanguage === "en" ? "en" : defaults.preferredLanguage,
    autoPromptOnJobStatus:
      typeof row.autoPromptOnJobStatus === "boolean"
        ? row.autoPromptOnJobStatus
        : defaults.autoPromptOnJobStatus,
    smsSenderId:
      typeof row.smsSenderId === "string" ? row.smsSenderId : defaults.smsSenderId,
    autoSendServiceDueSms:
      typeof row.autoSendServiceDueSms === "boolean"
        ? row.autoSendServiceDueSms
        : defaults.autoSendServiceDueSms,
    serviceDueRemindDaysBefore:
      typeof row.serviceDueRemindDaysBefore === "number"
        ? row.serviceDueRemindDaysBefore
        : defaults.serviceDueRemindDaysBefore,
    serviceDueRemindDays: parseRemindDays(row, defaults),
    ownerPhone:
      typeof row.ownerPhone === "string" ? row.ownerPhone : defaults.ownerPhone,
    technicianPhone:
      typeof row.technicianPhone === "string"
        ? row.technicianPhone
        : defaults.technicianPhone,
    notifyOwnerOnServiceDue:
      typeof row.notifyOwnerOnServiceDue === "boolean"
        ? row.notifyOwnerOnServiceDue
        : defaults.notifyOwnerOnServiceDue,
    notifyCustomerOnServiceDue:
      typeof row.notifyCustomerOnServiceDue === "boolean"
        ? row.notifyCustomerOnServiceDue
        : defaults.notifyCustomerOnServiceDue,
    notifyTechnicianOnServiceDue:
      typeof row.notifyTechnicianOnServiceDue === "boolean"
        ? row.notifyTechnicianOnServiceDue
        : defaults.notifyTechnicianOnServiceDue,
    defaultServiceIntervalDays:
      typeof row.defaultServiceIntervalDays === "number"
        ? row.defaultServiceIntervalDays
        : defaults.defaultServiceIntervalDays,
    autoSendOnServiceComplete:
      typeof row.autoSendOnServiceComplete === "boolean"
        ? row.autoSendOnServiceComplete
        : defaults.autoSendOnServiceComplete,
  };
}

function parseRemindDays(
  row: Record<string, unknown>,
  defaults: NotificationSettings,
): number[] {
  if (Array.isArray(row.serviceDueRemindDays)) {
    const days = row.serviceDueRemindDays.filter(
      (d): d is number => typeof d === "number" && d >= 0 && d <= 365,
    );
    if (days.length > 0) {
      return [...new Set(days)].sort((a, b) => b - a);
    }
  }
  if (typeof row.serviceDueRemindDaysBefore === "number") {
    const before = row.serviceDueRemindDaysBefore;
    return [...new Set([before, 0])].sort((a, b) => b - a);
  }
  return defaults.serviceDueRemindDays;
}

export function loadNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return defaultNotificationSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultNotificationSettings();
    return { ...defaultNotificationSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultNotificationSettings();
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadNotificationLog(): NotificationLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as NotificationLogEntry[];
  } catch {
    return [];
  }
}

export function appendNotificationLog(entry: Omit<NotificationLogEntry, "id" | "sentAt">): NotificationLogEntry {
  const full: NotificationLogEntry = {
    ...entry,
    id: newId(),
    sentAt: new Date().toISOString(),
  };

  if (typeof window === "undefined") return full;

  const log = [full, ...loadNotificationLog()].slice(0, MAX_LOG);
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  return full;
}
