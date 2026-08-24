import { describe, expect, it } from "vitest";
import { sellVehicle } from "./actions";
import { emptyAppData } from "./storage";
import type { Customer, VehicleRecord } from "./types";

const vehicle: VehicleRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  stockId: "VEH-001",
  dateAdded: "2026-08-01T00:00:00.000Z",
  make: "Toyota",
  model: "Aqua",
  year: 2022,
  chassisNo: "NHP10-1234567",
  fuel: "hybrid",
  transmission: "auto",
  mileageKm: 24000,
  condition: "Reconditioned",
  purchasePrice: 6_000_000,
  reconditionCost: 500_000,
  askPrice: 7_500_000,
  status: "for_sale",
};

const customer: Customer = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Test Buyer",
  contactType: "individual",
  creditBalance: 0,
};

describe("sellVehicle", () => {
  it("creates a linked invoice sale with the correct revenue and cost", () => {
    const data = { ...emptyAppData(), vehicles: [vehicle], customers: [customer] };
    const next = sellVehicle(data, {
      vehicleId: vehicle.id,
      sellPrice: 7_200_000,
      customerId: customer.id,
      paymentMethod: "cash",
    });

    expect(next.vehicles[0].status).toBe("sold");
    expect(next.sales).toHaveLength(1);
    expect(next.sales[0]).toMatchObject({
      id: vehicle.id,
      total: 7_200_000,
      profit: 700_000,
      customerId: customer.id,
      creditAmount: 0,
    });
    expect(next.sales[0].lines[0]).toMatchObject({
      productId: "",
      productName: "VEH-001 · Toyota Aqua 2022",
      qty: 1,
      buyPrice: 6_500_000,
    });
  });

  it("creates one invoice and one receivable even when retried", () => {
    const data = { ...emptyAppData(), vehicles: [vehicle], customers: [customer] };
    const input = {
      vehicleId: vehicle.id,
      sellPrice: 7_200_000,
      customerId: customer.id,
      paymentMethod: "credit" as const,
      financePartner: "Finance Co",
    };
    const once = sellVehicle(data, input);
    const twice = sellVehicle(once, input);

    expect(twice.sales).toHaveLength(1);
    expect(twice.customers[0].creditBalance).toBe(7_200_000);
    expect(twice).toBe(once);
  });
});
