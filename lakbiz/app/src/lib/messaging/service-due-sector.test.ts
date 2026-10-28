import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runServiceDueReminders } from "./service-due-cron";
import { defaultNotificationSettings } from "./settings";
import { sendTextLkSms } from "./textlk-server";

vi.mock("./textlk-server", () => ({ isTextLkConfigured: () => true, sendTextLkSms: vi.fn() }));
vi.mock("./platform-policy-server", () => ({ fetchPlatformMessagingPolicy: async () => ({ cronEnabled: true, serviceDueRepeatDays: 7 }) }));
vi.mock("./plan-gate-server", () => ({ orgAllowsBulkMessaging: async () => true }));

function fakeDb(sector: string, enabled = true) {
  const orgs = [{ id: "current-shop", name: "Sample", phone: null, sector, notification_settings: { ...defaultNotificationSettings(), autoSendServiceDueSms: true } }];
  const query = (data: unknown[]) => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), then: (resolve: (value: unknown) => void) => resolve({ data, error: null }) });
  const organizations = query(orgs);
  const from = vi.fn((table: string) => table === "organizations" ? organizations : query([]));
  const rpc = vi.fn().mockResolvedValue({ data: enabled, error: null });
  return { api: { from, rpc } as unknown as SupabaseClient, from, rpc, organizations };
}

describe("scheduled service reminders", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["grocery", "pharmacy", "electronics", "mobile_shop", "electricals", "spare_parts", "footwear", "textile", "car_sales"])("never visits or sends AC jobs for %s with stale reminder settings", async (sector) => {
    const db = fakeDb(sector);
    const result = await runServiceDueReminders(db.api);
    expect(db.organizations.eq).toHaveBeenCalledWith("sector", "ac_hvac");
    expect(db.from).not.toHaveBeenCalledWith("ac_jobs");
    expect(db.rpc).not.toHaveBeenCalled();
    expect(sendTextLkSms).not.toHaveBeenCalled();
    expect(result.orgsScanned).toBe(0);
  });
  it("checks the HVAC plan before inspecting jobs", async () => {
    const disabled = fakeDb("ac_hvac", false);
    await runServiceDueReminders(disabled.api);
    expect(disabled.from).not.toHaveBeenCalledWith("ac_jobs");
    const enabled = fakeDb("ac_hvac", true);
    await runServiceDueReminders(enabled.api);
    expect(enabled.from).toHaveBeenCalledWith("ac_jobs");
    expect(sendTextLkSms).not.toHaveBeenCalled();
  });
});
