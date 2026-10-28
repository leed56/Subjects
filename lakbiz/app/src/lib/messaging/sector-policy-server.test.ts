import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { messageSectorAccessError } from "./sector-policy-server";

function client(sector: string | null, enabled = true) {
  const rpc = vi.fn().mockResolvedValue({ data: enabled, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: sector ? { sector } : null, error: null }) };
  return { api: { from: vi.fn().mockReturnValue(query), rpc } as unknown as SupabaseClient, rpc };
}

describe("server message sector enforcement", () => {
  it.each(["grocery", "pharmacy", "electronics", "mobile_shop", "electricals", "spare_parts", "footwear", "textile", "car_sales"])("denies AC messages for %s even when the caller labels them custom", async (sector) => {
    const { api, rpc } = client(sector);
    expect(await messageSectorAccessError(api, "current-shop", "custom", "job_service_due")).toContain("HVAC");
    expect(await messageSectorAccessError(api, "current-shop", "ac_job", "custom")).toContain("HVAC");
    expect(rpc).not.toHaveBeenCalled();
    expect(await messageSectorAccessError(api, "current-shop", "sale", "bill_receipt")).toBeNull();
  });
  it("requires the enabled AC module and fails closed on missing organization data", async () => {
    expect(await messageSectorAccessError(client("ac_hvac", true).api, "current-shop", "ac_job")).toBeNull();
    expect(await messageSectorAccessError(client("ac_hvac", false).api, "current-shop", "ac_job")).toContain("not enabled");
    expect(await messageSectorAccessError(client(null).api, "current-shop", "ac_job")).toContain("Unable to verify");
  });
});
