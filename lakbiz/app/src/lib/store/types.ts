import type { PaymentMethod, Product, SectorId } from "@/lib/types";

export interface SaleLine {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  buyPrice: number;
}

export interface Sale {
  id: string;
  date: string;
  lines: SaleLine[];
  total: number;
  profit: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
}

export interface StockLog {
  id: string;
  productId: string;
  productName: string;
  type: "in" | "out" | "sale";
  qty: number;
  note?: string;
  date: string;
}

export interface AppData {
  products: Product[];
  sales: Sale[];
  stockLogs: StockLog[];
}

export type ProductInput = {
  name: string;
  sku?: string;
  category: string;
  sectorId: SectorId;
  buyPrice: number;
  sellPrice: number;
  stockQty: number;
  reorderLevel?: number;
  unit: string;
};
