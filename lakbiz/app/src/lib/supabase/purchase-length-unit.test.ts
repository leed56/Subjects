import { expect, it } from "vitest";
import { snapshotFromResponse } from "./purchase-authority";

function snapshot(unit?: string) {
  return { order: { id: "order", organization_id: "org", po_no: "PO-1", order_date: "2026-10-18", supplier_name: "Supplier", expected_total: 1, status: "pending" }, lines: [{ id: "line", organization_id: "org", purchase_order_id: "order", product_id: "fabric", product_name: "Fabric", qty_ordered: 1, qty_received: 0, unit_cost: 1, length_unit: unit }], products: [], logs: [] };
}
it("preserves the exact metre or yard unit from the purchase snapshot", () => {
  expect(snapshotFromResponse(snapshot("metre"), "org", "order").order.lines[0].lengthUnit).toBe("metre");
  expect(snapshotFromResponse(snapshot("yard"), "org", "order").order.lines[0].lengthUnit).toBe("yard");
});
it("keeps legacy orders unitless and rejects invalid measured units", () => {
  expect(snapshotFromResponse(snapshot(), "org", "order").order.lines[0].lengthUnit).toBeUndefined();
  expect(() => snapshotFromResponse(snapshot("feet"), "org", "order")).toThrow("invalid fabric unit");
});
