import type { NotificationSettings } from "./types";

/** Platform-controlled SMS / cron policy — not editable by shop owners. */
export type PlatformMessagingPolicy = {
  /** Block duplicate job reminders to same recipient within N days */
  serviceDueRepeatDays: number;
  dailySmsLimitPerOrg: number;
  maxSmsLength: number;
  /** Default reminder schedule applied to new shops */
  defaultRemindDays: number[];
  defaultServiceIntervalDays: number;
  cronEnabled: boolean;
  /** Days before trial/period end to SMS shop owners (platform billing) */
  subscriptionRenewalRemindDays: number[];
  subscriptionRenewalCronEnabled: boolean;
};

export const DEFAULT_PLATFORM_MESSAGING_POLICY: PlatformMessagingPolicy = {
  serviceDueRepeatDays: 7,
  dailySmsLimitPerOrg: 100,
  maxSmsLength: 640,
  defaultRemindDays: [14, 7, 2, 0],
  defaultServiceIntervalDays: 180,
  cronEnabled: true,
  subscriptionRenewalRemindDays: [7, 3, 0],
  subscriptionRenewalCronEnabled: true,
};

export function parsePlatformMessagingPolicy(
  raw: unknown,
): PlatformMessagingPolicy {
  const d = DEFAULT_PLATFORM_MESSAGING_POLICY;
  if (!raw || typeof raw !== "object") return d;

  const row = raw as Record<string, unknown>;

  const defaultRemindDays = Array.isArray(row.defaultRemindDays)
    ? row.defaultRemindDays.filter(
        (n): n is number => typeof n === "number" && n >= 0 && n <= 365,
      )
    : d.defaultRemindDays;

  const subscriptionRenewalRemindDays = Array.isArray(row.subscriptionRenewalRemindDays)
    ? row.subscriptionRenewalRemindDays.filter(
        (n): n is number => typeof n === "number" && n >= 0 && n <= 365,
      )
    : d.subscriptionRenewalRemindDays;

  return {
    serviceDueRepeatDays: clampInt(row.serviceDueRepeatDays, d.serviceDueRepeatDays, 1, 90),
    dailySmsLimitPerOrg: clampInt(row.dailySmsLimitPerOrg, d.dailySmsLimitPerOrg, 1, 10_000),
    maxSmsLength: clampInt(row.maxSmsLength, d.maxSmsLength, 70, 2000),
    defaultRemindDays:
      defaultRemindDays.length > 0
        ? [...new Set(defaultRemindDays)].sort((a, b) => b - a)
        : d.defaultRemindDays,
    defaultServiceIntervalDays: clampInt(
      row.defaultServiceIntervalDays,
      d.defaultServiceIntervalDays,
      30,
      730,
    ),
    cronEnabled:
      typeof row.cronEnabled === "boolean" ? row.cronEnabled : d.cronEnabled,
    subscriptionRenewalRemindDays:
      subscriptionRenewalRemindDays.length > 0
        ? [...new Set(subscriptionRenewalRemindDays)].sort((a, b) => b - a)
        : d.subscriptionRenewalRemindDays,
    subscriptionRenewalCronEnabled:
      typeof row.subscriptionRenewalCronEnabled === "boolean"
        ? row.subscriptionRenewalCronEnabled
        : d.subscriptionRenewalCronEnabled,
  };
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Keys shop owners may persist on organizations.notification_settings */
const SHOP_NOTIFICATION_KEYS: (keyof NotificationSettings)[] = [
  "defaultChannel",
  "preferredLanguage",
  "autoPromptOnJobStatus",
  "smsSenderId",
  "autoSendServiceDueSms",
  "serviceDueRemindDaysBefore",
  "serviceDueRemindDays",
  "ownerPhone",
  "technicianPhone",
  "notifyCustomerOnServiceDue",
  "notifyOwnerOnServiceDue",
  "notifyTechnicianOnServiceDue",
  "defaultServiceIntervalDays",
  "autoSendOnServiceComplete",
];

/** Strip platform-only fields before saving shop notification settings. */
export function toShopNotificationPayload(
  settings: NotificationSettings,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of SHOP_NOTIFICATION_KEYS) {
    payload[key] = settings[key];
  }
  return payload;
}
