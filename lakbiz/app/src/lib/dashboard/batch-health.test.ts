import { describe, expect, it } from "vitest";
import type { SectorLotSnapshot } from "@/lib/supabase/sector-dashboard-client";
import { batchHealth, sriLankaDateKey } from "./batch-health";

const lot = (batchNo: string, expiryDate: string | null, status: SectorLotSnapshot["status"] = "available", qtyOnHand = 5): SectorLotSnapshot =>
  ({ productId: "beauty-1", batchNo, expiryDate, status, qtyOnHand });

describe("expiry-aware batch dashboard", () => {
  it("uses the Sri Lankan business day across the UTC midnight boundary", () => {
    const now = new Date("2026-10-10T20:00:00Z");
    expect(sriLankaDateKey(now)).toBe("2026-10-11");
    const health = batchHealth([lot("yesterday", "2026-10-10"), lot("today", "2026-10-11")], now);
    expect(health.expired.map((x) => x.batchNo)).toEqual(["yesterday"]);
    expect(health.available.map((x) => x.batchNo)).toEqual(["today"]);
  });

  it("excludes expired quantities even if their status is still available, without double-counting expired holds", () => {
    const health = batchHealth([
      lot("stale-status", "2026-10-09"), lot("expired-hold", "2026-10-09", "quarantine"),
      lot("hold", "2026-11-01", "quarantine"), lot("recalled", null, "recalled"),
      lot("returned", null, "returned"), lot("empty", "2026-10-09", "expired", 0),
    ], new Date("2026-10-11T12:00:00Z"));
    expect(health.expired).toHaveLength(2);
    expect(health.blocked).toHaveLength(3);
    expect(health.available).toHaveLength(0);
    expect(health.nearExpiry).toHaveLength(0);
  });

  it("includes the near-expiry boundary and keeps undated, disposed and returned stock out of the expiry queue", () => {
    const health = batchHealth([
      lot("today", "2026-10-11"), lot("day30", "2026-11-10"), lot("day31", "2026-11-11"),
      lot("undated", null), lot("disposed", "2026-10-12", "disposed"), lot("returned", "2026-10-12", "returned"),
    ], new Date("2026-10-11T12:00:00Z"));
    expect(health.nearExpiry.map((x) => x.batchNo)).toEqual(["today", "day30"]);
    expect(health.available.map((x) => x.batchNo)).toEqual(["today", "day30", "day31", "undated"]);
  });
});
