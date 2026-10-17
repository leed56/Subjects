import type { SectorId } from "@/lib/types";
import type { DemoRole } from "./industry-templates";

/** Money is integer minor units; no floating-point accounting in the engine. */
export type DemoProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  price: number;
  cost: number;
  reorder: number;
  quantities: Record<string, number>;
  identity: string;
  expiry?: string;
  blocked: boolean;
  attributes: Record<string, string>;
};
export type DemoCustomer = {
  id: string;
  name: string;
  company: boolean;
  city: string;
  credit: number;
  creditLimit: number;
  points: number;
  tier: "Member" | "Silver" | "Gold";
};
export type DemoLine = {
  productId: string;
  quantity: number;
  unitAmount: number;
  cost?: number;
};
export type DemoSale = {
  id: string;
  date: string;
  customerId?: string;
  lines: DemoLine[];
  total: number;
  tax: number;
  cost: number;
  payment: "cash" | "card" | "credit";
  warehouseId: string;
  returned: boolean;
  rewardDiscount: number;
  redeemedPoints: number;
  earnedPoints: number;
};
export type DemoPurchase = {
  id: string;
  date: string;
  supplier: string;
  lines: DemoLine[];
  status: "ordered" | "received";
  total: number;
  warehouseId: string;
};
export type DemoShipment = {
  id: string;
  reference: string;
  supplier: string;
  origin: string;
  currency: "USD" | "EUR" | "LKR";
  exchangeRate: number;
  foreignGoods: number;
  freight: number;
  duty: number;
  insurance: number;
  clearing: number;
  recoverableVat: number;
  basis: "value" | "quantity";
  lines: DemoLine[];
  status: "draft" | "in_transit" | "customs" | "received";
  warehouseId: string;
  eta: string;
};
export type DemoMovement = {
  id: string;
  date: string;
  productId: string;
  quantity: number;
  type: "opening" | "sale" | "purchase" | "transfer" | "write_off" | "return";
  from?: string;
  to?: string;
  reference: string;
  reason?: string;
};
export type DemoJournalLine = {
  account: string;
  debit: number;
  credit: number;
};
export type DemoJournal = {
  id: string;
  date: string;
  reference: string;
  memo: string;
  lines: DemoJournalLine[];
};
export type DemoState = {
  schemaVersion: 1;
  industry: SectorId;
  revision: number;
  settings: {
    name: string;
    currency: "LKR";
    timezone: "Asia/Colombo";
    vatRegistered: boolean;
    vatRate: number;
    loyaltySpend: number;
    pointValue: number;
    plan: "Business" | "Pro";
  };
  products: DemoProduct[];
  customers: DemoCustomer[];
  sales: DemoSale[];
  purchases: DemoPurchase[];
  shipments: DemoShipment[];
  movements: DemoMovement[];
  journals: DemoJournal[];
  warehouses: { id: string; name: string; city: string; manager: string }[];
  staff: {
    id: string;
    name: string;
    job: string;
    role: DemoRole;
    location: string;
    status: "Active" | "Invited";
  }[];
  suppliers: {
    id: string;
    name: string;
    origin: string;
    payable: number;
    leadDays: number;
  }[];
  audit: {
    id: string;
    date: string;
    actor: DemoRole;
    action: string;
    reference: string;
  }[];
};
export type DemoCommand =
  | {
      type: "sale";
      lines: { productId: string; quantity: number }[];
      customerId?: string;
      payment: DemoSale["payment"];
      warehouseId: string;
      redeemPoints: number;
    }
  | {
      type: "purchase";
      supplier: string;
      productId: string;
      quantity: number;
      unitCost: number;
      warehouseId: string;
    }
  | { type: "receive_purchase"; id: string }
  | { type: "shipment"; shipment: Omit<DemoShipment, "id" | "status"> }
  | { type: "advance_shipment"; id: string }
  | {
      type: "transfer";
      productId: string;
      quantity: number;
      from: string;
      to: string;
    }
  | {
      type: "write_off";
      productId: string;
      quantity: number;
      warehouseId: string;
      reason: string;
    }
  | { type: "return"; saleId: string; disposition: "restock" | "quarantine" }
  | {
      type: "journal";
      memo: string;
      debitAccount: string;
      creditAccount: string;
      amount: number;
    }
  | {
      type: "customer";
      name: string;
      city: string;
      company: boolean;
      creditLimit: number;
    }
  | { type: "staff"; name: string; job: string; role: DemoRole }
  | {
      type: "settings";
      name: string;
      vatRegistered: boolean;
      vatRate: number;
      loyaltySpend: number;
      pointValue: number;
      plan: "Business" | "Pro";
    };
