import { describe, it, expect } from "vitest";
import {
  INDUSTRY_TEMPLATES,
  DEMO_PASSWORD,
  validateDemoLogin,
  demoCanUse,
} from "./industry-templates";
import { createDemoState } from "./demo-data";
import {
  executeDemoCommand,
  allocateCost,
  balanced,
  totalStock,
  landedCost,
  demoTrialBalance,
  businessDate,
} from "./demo-engine";
import { demoStorageKey } from "./demo-storage";
import type { DemoCommand } from "./demo-types";
const now = new Date("2026-10-11T03:30:00Z");
const seed = () => createDemoState("grocery", now);
describe("client industry demonstrations", () => {
  for (const template of INDUSTRY_TEMPLATES)
    it(`${template.id}: has valid credentials, coherent seed stock and balanced books`, () => {
      const s = createDemoState(template.id, now);
      expect(
        validateDemoLogin(template.id, template.demoEmail, DEMO_PASSWORD),
      ).toBe(true);
      expect(validateDemoLogin(template.id, template.demoEmail, "wrong")).toBe(
        false,
      );
      expect(s.products).toHaveLength(8);
      expect(
        s.products.every((p) =>
          Object.values(p.quantities).every((q) => q >= 0),
        ),
      ).toBe(true);
      expect(s.journals.every((j) => balanced(j.lines))).toBe(true);
      const b = demoTrialBalance(s);
      expect(b.reduce((n, r) => n + r.debit, 0)).toBe(
        b.reduce((n, r) => n + r.credit, 0),
      );
      expect(s.sales).toHaveLength(14);
      expect(s.shipments[0].foreignGoods * 100).toBe(
        s.shipments[0].lines.reduce((n, l) => n + l.quantity * l.unitAmount, 0),
      );
    });
  it("uses separate demo keys and no production session namespaces", () => {
    expect(
      new Set(INDUSTRY_TEMPLATES.map((t) => demoStorageKey(t.id))).size,
    ).toBe(14);
    expect(demoStorageKey("pharmacy")).toBe(
      "lakbiz:client-showcase:v1:pharmacy",
    );
  });
  it("keeps internal finance outside manager/cashier routes", () => {
    expect(demoCanUse("manager", "finance")).toBe(false);
    expect(demoCanUse("cashier", "imports")).toBe(false);
    expect(demoCanUse("manager", "returns")).toBe(true);
  });
});
describe("ERP transaction invariants", () => {
  it("allocates every minor unit using largest remainders", () => {
    expect(allocateCost(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateCost(1001, [1, 3, 7]).reduce((a, b) => a + b, 0)).toBe(1001);
    expect(() => allocateCost(100, [0, 1])).toThrow();
  });
  it("conserves total stock and inventory book value across transfers", () => {
    const s = seed(),
      p = s.products[0],
      n = executeDemoCommand(
        s,
        {
          type: "transfer",
          productId: p.id,
          quantity: 3.5,
          from: "central",
          to: "south",
        },
        "manager",
        now,
        "transfer",
      );
    expect(totalStock(n.products[0])).toBe(totalStock(p));
    expect(n.products[0].quantities.central).toBe(p.quantities.central - 3.5);
    expect(n.journals).toEqual(s.journals);
    expect(s.products[0]).toEqual(p);
  });
  it("rejects a source overdraw without mutating the original", () => {
    const s = seed(),
      before = JSON.stringify(s);
    expect(() =>
      executeDemoCommand(
        s,
        {
          type: "transfer",
          productId: "p-1",
          quantity: 100000,
          from: "main",
          to: "south",
        },
        "owner",
        now,
        "bad",
      ),
    ).toThrow(/Insufficient/);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("does not receive orders twice", () => {
    const s = seed(),
      id = s.purchases[0].id,
      n = executeDemoCommand(
        s,
        { type: "receive_purchase", id },
        "owner",
        now,
        "receive",
      );
    expect(n.purchases[0].status).toBe("received");
    expect(() =>
      executeDemoCommand(
        n,
        { type: "receive_purchase", id },
        "owner",
        now,
        "duplicate",
      ),
    ).toThrow(/already/);
  });
  it("posts imports once with recoverable VAT outside inventory cost", () => {
    let s = seed();
    const shipment = s.shipments[0],
      stock = totalStock(s.products[1]),
      c = landedCost(shipment);
    s = executeDemoCommand(
      s,
      { type: "advance_shipment", id: shipment.id },
      "owner",
      now,
      "customs",
    );
    s = executeDemoCommand(
      s,
      { type: "advance_shipment", id: shipment.id },
      "owner",
      now,
      "receipt",
    );
    expect(totalStock(s.products[1])).toBe(stock + shipment.lines[0].quantity);
    expect(
      s.journals[0].lines.find((l) => l.account === "Inventory")?.debit,
    ).toBe(c.capitalized);
    expect(
      s.journals[0].lines.find((l) => l.account === "Input VAT")?.debit,
    ).toBe(shipment.recoverableVat);
    expect(balanced(s.journals[0].lines)).toBe(true);
    expect(() =>
      executeDemoCommand(
        s,
        { type: "advance_shipment", id: shipment.id },
        "owner",
        now,
        "second",
      ),
    ).toThrow(/already/);
  });
  it("preserves checkout cost, reverses rewards and restores stock on full return", () => {
    const original = seed(),
      p = original.products[0],
      customer = original.customers[0],
      command: DemoCommand = {
        type: "sale",
        lines: [{ productId: p.id, quantity: 2 }],
        warehouseId: "main",
        customerId: customer.id,
        payment: "cash",
        redeemPoints: 10,
      };
    const sold = executeDemoCommand(original, command, "cashier", now, "sale"),
      sale = sold.sales[0];
    expect(sale.cost).toBe(p.cost * 2);
    expect(sold.customers[0].points).toBe(
      customer.points - 10 + sale.earnedPoints,
    );
    const returned = executeDemoCommand(
      sold,
      { type: "return", saleId: sale.id, disposition: "restock" },
      "manager",
      now,
      "return",
    );
    expect(returned.products[0].quantities).toEqual(p.quantities);
    expect(returned.customers[0].points).toBe(customer.points);
    expect(balanced(returned.journals[0].lines)).toBe(true);
    expect(() =>
      executeDemoCommand(
        returned,
        { type: "return", saleId: sale.id, disposition: "restock" },
        "owner",
        now,
        "again",
      ),
    ).toThrow(/already/);
  });
  it("keeps quarantined returns out of sellable stock", () => {
    const s = seed(),
      sale = s.sales[0],
      q = totalStock(s.products.find((p) => p.id === sale.lines[0].productId)!);
    const n = executeDemoCommand(
      s,
      { type: "return", saleId: sale.id, disposition: "quarantine" },
      "manager",
      now,
      "hold",
    );
    expect(
      totalStock(n.products.find((p) => p.id === sale.lines[0].productId)!),
    ).toBe(q);
    expect(n.movements[0].to).toBe("quarantine");
  });
  it("requires owner for finance and manager for write-offs", () => {
    const s = seed();
    expect(() =>
      executeDemoCommand(
        s,
        {
          type: "journal",
          memo: "test",
          amount: 100,
          debitAccount: "Cash",
          creditAccount: "Opening equity",
        },
        "manager",
        now,
        "j",
      ),
    ).toThrow(/owner/);
    expect(() =>
      executeDemoCommand(
        s,
        {
          type: "write_off",
          productId: "p-1",
          warehouseId: "main",
          quantity: 1,
          reason: "Damage",
        },
        "cashier",
        now,
        "w",
      ),
    ).toThrow(/Manager/);
  });
  it("rejects negative, non-finite quantities, zero-price purchases and unbalanced journals", () => {
    const s = seed();
    for (const quantity of [-1, NaN, Infinity, 0])
      expect(() =>
        executeDemoCommand(
          s,
          {
            type: "transfer",
            productId: "p-1",
            quantity,
            from: "main",
            to: "south",
          },
          "owner",
          now,
          "q",
        ),
      ).toThrow();
    expect(
      balanced([
        { account: "Cash", debit: 100, credit: 0 },
        { account: "Sales", debit: 0, credit: 99 },
      ]),
    ).toBe(false);
    expect(() =>
      executeDemoCommand(
        s,
        {
          type: "purchase",
          supplier: s.suppliers[0].name,
          productId: "p-1",
          quantity: 1,
          unitCost: 0,
          warehouseId: "main",
        },
        "owner",
        now,
        "zero",
      ),
    ).toThrow();
  });
  it("uses the Sri Lankan business day for expiry and rejects blocked/expired stock", () => {
    expect(businessDate(new Date("2026-10-10T20:00:00Z"))).toBe("2026-10-11");
    const s = seed();
    s.products[0].expiry = "2026-10-10";
    for (const productId of ["p-1", "p-8"])
      expect(() =>
        executeDemoCommand(
          s,
          {
            type: "sale",
            lines: [{ productId, quantity: 1 }],
            warehouseId: "main",
            payment: "cash",
            redeemPoints: 0,
          },
          "cashier",
          now,
          "expired",
        ),
      ).toThrow(/held or expired/);
  });
  it("rejects credit-limit and duplicate-event violations", () => {
    const s = seed();
    s.customers[0].creditLimit = 0;
    expect(() =>
      executeDemoCommand(
        s,
        {
          type: "sale",
          lines: [{ productId: "p-1", quantity: 1 }],
          warehouseId: "main",
          payment: "credit",
          customerId: "c-1",
          redeemPoints: 0,
        },
        "cashier",
        now,
        "credit",
      ),
    ).toThrow(/credit limit/);
    expect(() =>
      executeDemoCommand(
        s,
        {
          type: "transfer",
          productId: "p-1",
          quantity: 1,
          from: "main",
          to: "south",
        },
        "owner",
        now,
        s.audit[0].id,
      ),
    ).toThrow(/already/);
  });
  it("keeps historical reward discount unchanged when the policy is updated", () => {
    let s = seed();
    s = executeDemoCommand(
      s,
      {
        type: "sale",
        lines: [{ productId: "p-1", quantity: 1 }],
        customerId: "c-1",
        warehouseId: "main",
        payment: "cash",
        redeemPoints: 10,
      },
      "owner",
      now,
      "reward",
    );
    const discount = s.sales[0].rewardDiscount;
    s = executeDemoCommand(
      s,
      { type: "settings", ...s.settings, pointValue: 200 },
      "owner",
      now,
      "policy",
    );
    expect(s.sales[0].rewardDiscount).toBe(discount);
  });
  it("accepts three-decimal measured quantities despite binary float representation",()=>{const s=createDemoState("textile",now),n=executeDemoCommand(s,{type:"transfer",productId:"p-1",quantity:1.001,from:"central",to:"main"},"manager",now,"measured");expect(n.products[0].quantities.main).toBeCloseTo(s.products[0].quantities.main+1.001,3);});

});
