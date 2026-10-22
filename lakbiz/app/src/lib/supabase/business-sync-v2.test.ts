import { describe, expect, it } from "vitest";
import type { AppData } from "@/lib/store/types";
import { applyTenderPaymentMethods } from "./business-sync-v2";

function snapshot(): AppData {
  return {
    sales: [
      { id: "sale-mixed", paymentMethod: "cash" },
      { id: "sale-card", paymentMethod: "cash" },
      { id: "sale-legacy", paymentMethod: "cheque" },
      { id: "sale-return-credit", paymentMethod: "cash" },
    ],
  } as unknown as AppData;
}

describe("applyTenderPaymentMethods", () => {
  it("marks a multi-row tender sale as mixed", () => {
    const result = applyTenderPaymentMethods(snapshot(), [
      { sale_id: "sale-mixed", kind: "cash" },
      { sale_id: "sale-mixed", kind: "card" },
    ]);
    expect(result.sales.find((sale) => sale.id === "sale-mixed")?.paymentMethod).toBe("mixed");
  });

  it("restores a single normalized tender method", () => {
    const result = applyTenderPaymentMethods(snapshot(), [
      { sale_id: "sale-card", kind: "card" },
    ]);
    expect(result.sales.find((sale) => sale.id === "sale-card")?.paymentMethod).toBe("card");
  });

  it("leaves legacy sales without tender rows unchanged", () => {
    const result = applyTenderPaymentMethods(snapshot(), [
      { sale_id: "sale-card", kind: "card" },
    ]);
    expect(result.sales.find((sale) => sale.id === "sale-legacy")?.paymentMethod).toBe("cheque");
  });

  it("does not misrepresent return-credit-only settlement as cash", () => {
    const result = applyTenderPaymentMethods(snapshot(), [
      { sale_id: "sale-return-credit", kind: "return_credit" },
    ]);
    expect(result.sales.find((sale) => sale.id === "sale-return-credit")?.paymentMethod).toBe("mixed");
  });
});
