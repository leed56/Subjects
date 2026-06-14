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
  customerId?: string;
  customerName?: string;
  creditAmount: number;
  chequeId?: string;
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

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  creditBalance: number;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  note?: string;
}

export interface BankAccountRecord {
  id: string;
  bankName: string;
  branch?: string;
  accountName: string;
  accountNumber: string;
  balance: number;
}

export type ChequeStatus = "pending" | "deposited" | "cleared" | "bounced";

export interface ChequeRecord {
  id: string;
  direction: "received" | "paid";
  chequeNo: string;
  bankName: string;
  partyName: string;
  customerId?: string;
  amount: number;
  chequeDate: string;
  postDated: boolean;
  status: ChequeStatus;
  linkedSaleId?: string;
  bankAccountId?: string;
  note?: string;
}

export interface AppData {
  products: Product[];
  sales: Sale[];
  stockLogs: StockLog[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  bankAccounts: BankAccountRecord[];
  cheques: ChequeRecord[];
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

export type CustomerInput = {
  name: string;
  phone?: string;
  address?: string;
};

export type BankAccountInput = {
  bankName: string;
  branch?: string;
  accountName: string;
  accountNumber: string;
  balance: number;
};

export type ChequeInput = {
  direction: "received" | "paid";
  chequeNo: string;
  bankName: string;
  partyName: string;
  customerId?: string;
  amount: number;
  chequeDate: string;
  postDated: boolean;
  note?: string;
};

export type SaleOptions = {
  customerId?: string;
  customerName?: string;
  chequeNo?: string;
  chequeBank?: string;
  chequeDate?: string;
  postDated?: boolean;
};
