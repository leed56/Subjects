import { describe, expect, it } from "vitest";
import {
  canTransitionInventoryTransfer,
  transferProgress,
  validateInventoryTransfer,
} from "@/lib/inventory-transfer";

describe("inventory transfer authority", () => {
  it("allows only the forward custody lifecycle", () => {
    expect(canTransitionInventoryTransfer("draft", "dispatched")).toBe(true);
    expect(canTransitionInventoryTransfer("dispatched", "in_transit")).toBe(true);
    expect(canTransitionInventoryTransfer("in_transit", "received")).toBe(true);
    expect(canTransitionInventoryTransfer("received", "in_transit")).toBe(false);
  });

  it("allows cancellation only before dispatch", () => {
    expect(canTransitionInventoryTransfer("draft", "cancelled")).toBe(true);
    expect(canTransitionInventoryTransfer("dispatched", "cancelled")).toBe(false);
  });

  it("rejects the same origin and destination", () => {
    expect(validateInventoryTransfer({ fromLocationId: "a", toLocationId: "a", lines: [{ productId: "p", qty: 1 }] })).toMatch(/different/i);
  });

  it("rejects missing and invalid lines", () => {
    expect(validateInventoryTransfer({ fromLocationId: "a", toLocationId: "b", lines: [] })).toMatch(/at least one/i);
    expect(validateInventoryTransfer({ fromLocationId: "a", toLocationId: "b", lines: [{ productId: "p", qty: 0 }] })).toMatch(/greater than zero/i);
  });

  it("preserves serialized identity as one physical unit", () => {
    expect(validateInventoryTransfer({ fromLocationId: "a", toLocationId: "b", lines: [{ productId: "p", unitId: "u", qty: 2 }] })).toMatch(/quantity one/i);
  });

  it("rejects duplicate exact identities", () => {
    const line = { productId: "p", lotId: "lot", qty: 2 };
    expect(validateInventoryTransfer({ fromLocationId: "a", toLocationId: "b", lines: [line, line] })).toMatch(/duplicate/i);
  });

  it("reports deterministic lifecycle progress", () => {
    expect(transferProgress("draft")).toBe(0);
    expect(transferProgress("dispatched")).toBe(34);
    expect(transferProgress("in_transit")).toBe(67);
    expect(transferProgress("received")).toBe(100);
  });
});
