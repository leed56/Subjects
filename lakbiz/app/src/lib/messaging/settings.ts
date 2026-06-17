import { newId } from "@/lib/format";
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
});

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
