import { afterEach, describe, expect, it, vi } from "vitest";
import type { SectorId } from "@/lib/types";
import { sectorAllowsRoute, sectorAllowsTeamRole } from "./sector-features";
import { templatesForContext } from "./messaging/templates";
import { notificationSettingsForSector, sectorAllowsMessage } from "./messaging/sector-policy";
import { appendNotificationLog, defaultNotificationSettings, loadNotificationLog, loadNotificationSettings, notificationStorageScope, saveNotificationSettings, setNotificationStorageScope } from "./messaging/settings";

const sectors: SectorId[] = ["grocery", "pharmacy", "electronics", "mobile_shop", "electricals", "spare_parts", "footwear", "textile", "ac_hvac", "car_sales"];

describe.each(sectors)("%s workspace boundaries", (sector) => {
  it("restricts specialty pages, nested links and team roles", () => {
    for (const path of ["/jobs", "/jobs/123/invoice", "/assets", "/schedule", "/teams", "/workforce", "/job-costing"]) expect(sectorAllowsRoute(sector, path)).toBe(sector === "ac_hvac");
    expect(sectorAllowsRoute(sector, "/vehicles")).toBe(sector === "car_sales");
    for (const path of ["/stock/rolls", "/stock/cutting", "/stock/dispatch", "/textile/trade-control"]) expect(sectorAllowsRoute(sector, path)).toBe(sector === "textile");
    expect(sectorAllowsRoute(sector, "/stock/advanced/receive")).toBe(["pharmacy", "electronics", "mobile_shop", "footwear"].includes(sector));
    expect(sectorAllowsTeamRole(sector, "technician")).toBe(sector === "ac_hvac");
    for (const path of ["/dashboard", "/sales", "/stock", "/settings/notifications"]) expect(sectorAllowsRoute(sector, path)).toBe(true);
  });

  it("keeps AC settings and message templates inside HVAC", () => {
    const original = { ...defaultNotificationSettings(), autoSendServiceDueSms: true, technicianPhone: "0770000000" };
    const effective = notificationSettingsForSector(original, sector);
    expect(effective.autoSendServiceDueSms).toBe(sector === "ac_hvac");
    expect(effective.autoPromptOnJobStatus).toBe(sector === "ac_hvac");
    expect(original.autoSendServiceDueSms).toBe(true);
    expect(sectorAllowsMessage(sector, "ac_job", "custom")).toBe(sector === "ac_hvac");
    expect(sectorAllowsMessage(sector, "custom", "job_service_due")).toBe(sector === "ac_hvac");
    expect(sectorAllowsMessage(sector, "sale", "bill_receipt")).toBe(true);
    expect(templatesForContext("custom", sector).some((template) => template.category === "jobs")).toBe(sector === "ac_hvac");
  });
});

describe("browser notification separation", () => {
  afterEach(() => { vi.unstubAllGlobals(); setNotificationStorageScope("anonymous"); });
  it("keeps settings and history separate across shops and demos without claiming old global data", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    storage.set("lakbiz-notification-settings-v1", JSON.stringify({ preferredLanguage: "en" }));
    const a = notificationStorageScope("shop-a", "grocery");
    const b = notificationStorageScope("shop-b", "ac_hvac");
    saveNotificationSettings({ ...defaultNotificationSettings(), preferredLanguage: "en" }, a);
    appendNotificationLog({ channel: "whatsapp", templateId: "custom", recipientPhone: "0770000000", recipientName: "Sample", messageBody: "Sample", contextType: "custom", delivery: "opened" }, a);
    expect(loadNotificationSettings(a).preferredLanguage).toBe("en");
    expect(loadNotificationSettings(b).preferredLanguage).toBe("si");
    expect(loadNotificationLog(a)).toHaveLength(1);
    expect(loadNotificationLog(b)).toHaveLength(0);
    expect(loadNotificationSettings(notificationStorageScope(null, "grocery")).preferredLanguage).toBe("si");
    expect(notificationStorageScope(null, "grocery")).not.toBe(notificationStorageScope(null, "ac_hvac"));
    expect(storage.has("lakbiz-notification-settings-v1")).toBe(true);
  });
});
