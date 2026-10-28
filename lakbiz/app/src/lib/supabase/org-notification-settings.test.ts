import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultNotificationSettings } from "@/lib/messaging/settings";
import { fetchOrgNotificationSettings, saveOrgNotificationSettings } from "./org-notification-settings";

describe("notification settings use the authorized server path", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserves a server denial without attempting another write", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "HVAC only" }) });
    vi.stubGlobal("fetch", fetch);
    expect(await saveOrgNotificationSettings("grocery-shop", defaultNotificationSettings())).toBe("HVAC only");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports a sync failure without falling back to a direct database write", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    expect(await saveOrgNotificationSettings("grocery-shop", defaultNotificationSettings())).toContain("retry");
    expect(await fetchOrgNotificationSettings("grocery-shop")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
