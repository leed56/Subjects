import { newId } from "@/lib/format";
import { DEFAULT_SERVICE_DUE_REMIND_DAYS } from "@/lib/ac-service";
import type {
  NotificationLogEntry,
  NotificationSettings,
} from "./types";

const SETTINGS_KEY = "lakbiz-notification-settings-v1";
const LOG_KEY = "lakbiz-notification-log-v1";
const MAX_LOG = 100;
let activeScope = "anonymous";

export function notificationStorageScope(orgId: string | null, sector: string): string {
  return orgId ? `shop:${orgId}` : `demo:${sector}`;
}

export function setNotificationStorageScope(scope: string): void {
  activeScope = scope;
}

function scopedKey(key: string, scope = activeScope): string {
  return `${key}:${scope}`;
}

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
    // "api_whatsapp" (Auto WhatsApp) was missing from this allowlist --
    // never rejected outright, just silently dropped back to the
    // "whatsapp" default on every cloud round trip, so it could never
    // actually stick as anyone's chosen default channel.
    defaultChannel:
      row.defaultChannel === "sms" ||
      row.defaultChannel === "api_sms" ||
      row.defaultChannel === "whatsapp" ||
      row.defaultChannel === "api_whatsapp"
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

export function loadNotificationSettings(scope?: string): NotificationSettings {
  if (typeof window === "undefined") return defaultNotificationSettings();
  try {
    const raw = localStorage.getItem(scopedKey(SETTINGS_KEY, scope));
    if (!raw) return defaultNotificationSettings();
    return parseNotificationSettings(JSON.parse(raw));
  } catch {
    return defaultNotificationSettings();
  }
}

export function saveNotificationSettings(settings: NotificationSettings, scope?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(scopedKey(SETTINGS_KEY, scope), JSON.stringify(settings));
}

export function loadNotificationLog(scope?: string): NotificationLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopedKey(LOG_KEY, scope));
    if (!raw) return [];
    return JSON.parse(raw) as NotificationLogEntry[];
  } catch {
    return [];
  }
}

export function appendNotificationLog(entry: Omit<NotificationLogEntry, "id" | "sentAt">, scope?: string): NotificationLogEntry {
  const full: NotificationLogEntry = {
    ...entry,
    id: newId(),
    sentAt: new Date().toISOString(),
  };

  if (typeof window === "undefined") return full;

  const log = [full, ...loadNotificationLog(scope)].slice(0, MAX_LOG);
  localStorage.setItem(scopedKey(LOG_KEY, scope), JSON.stringify(log));
  return full;
}
