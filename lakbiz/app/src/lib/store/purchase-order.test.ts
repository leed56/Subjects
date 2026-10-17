import { describe, expect, it } from "vitest";
import { addProduct, addSupplier, createPurchaseOrder, receivePurchaseOrder } from "./actions";
import { emptyAppData } from "./storage";

function fixture() {
  const stocked = addProduct(emptyAppData(), {
    name: "Receipt product", category: "General", sectorId: "grocery",
    buyPrice: 5, sellPrice: 20, stockQty: 3, unit: "pcs",
  });
  const data = addSupplier(stocked, { name: "Supplier" });
  const productId = data.products[0].id;
  const input = { supplierId: data.suppliers[0].id, lines: [{ productId, qty: 10, unitCost: 8 }] };
  return { data, input, productId };
}

describe("purchase order receipt integrity", () => {
  it("orders no stock, then receives partial deliveries exactly once per delivery", () => {
    const { data, input, productId } = fixture();
    const ordered = createPurchaseOrder(data, input);
    expect(ordered.products).toEqual(data.products);
    const id = ordered.purchaseOrders[0].id;
    const partial = receivePurchaseOrder(ordered, id, [{ productId, qtyReceived: 4 }]);
    expect(partial.products[0].stockQty).toBe(7);
    expect(partial.purchaseOrders[0].status).toBe("partial");
    const complete = receivePurchaseOrder(partial, id, [{ productId, qtyReceived: 20 }]);
    expect(complete.products[0].stockQty).toBe(13);
    expect(complete.purchaseOrders[0].status).toBe("received");
    expect(complete.stockLogs.filter((log) => log.type === "purchase").reduce((sum, log) => sum + log.qty, 0)).toBe(10);
    expect(receivePurchaseOrder(complete, id, [{ productId, qtyReceived: 1 }])).toBe(complete);
  });

  it.each([NaN, Infinity, -1])("rejects invalid receipt quantity %s without mutation", (qtyReceived) => {
    const { data, input, productId } = fixture();
    const ordered = createPurchaseOrder(data, input);
    expect(receivePurchaseOrder(ordered, ordered.purchaseOrders[0].id, [{ productId, qtyReceived }])).toBe(ordered);
  });

  it("rejects duplicate requested identities and legacy ambiguous orders", () => {
    const { data, input, productId } = fixture();
    expect(createPurchaseOrder(data, { ...input, lines: [...input.lines, ...input.lines] })).toBe(data);
    const ordered = createPurchaseOrder(data, input);
    const line = { productId, qtyReceived: 2 };
    expect(receivePurchaseOrder(ordered, ordered.purchaseOrders[0].id, [line, line])).toBe(ordered);
    ordered.purchaseOrders[0].lines.push({ ...ordered.purchaseOrders[0].lines[0] });
    expect(receivePurchaseOrder(ordered, ordered.purchaseOrders[0].id, [line])).toBe(ordered);
  });

  it("rejects a receipt containing an unknown product as a whole", () => {
    const { data, input, productId } = fixture();
    const ordered = createPurchaseOrder(data, input);
    expect(receivePurchaseOrder(ordered, ordered.purchaseOrders[0].id, [
      { productId, qtyReceived: 2 }, { productId: "missing", qtyReceived: 1 },
    ])).toBe(ordered);
  });

  it.each([NaN, Infinity, -1])("rejects invalid ordered quantity or cost %s", (value) => {
    const { data, input } = fixture();
    expect(createPurchaseOrder(data, { ...input, lines: [{ ...input.lines[0], qty: value }] })).toBe(data);
    expect(createPurchaseOrder(data, { ...input, lines: [{ ...input.lines[0], unitCost: value }] })).toBe(data);
  });
});
