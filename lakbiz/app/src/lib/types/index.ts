export type SectorId =
  | "grocery"
  | "electronics"
  | "electricals"
  | "spare_parts"
  | "ac_hvac"
  | "car_sales";

export type UserRole = "owner" | "manager" | "cashier" | "technician";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "cheque"
  | "credit";

/** Inventory lane: new stock vs used/refurbished (Phase A). */
export type ProductCondition = "new" | "used";

export type ChequeStatus =
  | "pending"
  | "deposited"
  | "cleared"
  | "bounced"
  | "returned";

export interface SectorTemplate {
  id: SectorId;
  nameEn: string;
  nameSi: string;
  description: string;
  icon: string;
  extraFields: string[];
  reports: string[];
}

export interface BankAccount {
  id: string;
  bankName: string;
  branch?: string;
  accountName: string;
  accountNumber: string;
  balance: number;
}

export interface Cheque {
  id: string;
  direction: "received" | "paid";
  chequeNo: string;
  bankName: string;
  amount: number;
  chequeDate: string;
  postDated: boolean;
  status: ChequeStatus;
  linkedInvoiceId?: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  category: string;
  sectorId: SectorId;
  /** new = default lane; used = second-hand / refurbished stock */
  condition: ProductCondition;
  buyPrice: number;
  sellPrice: number;
  stockQty: number;
  reorderLevel?: number;
  customFields: Record<string, string | number | boolean>;
}

export interface VehicleUnit {
  id: string;
  stockId: string;
  make: string;
  model: string;
  year: number;
  chassisNo: string;
  mileageKm: number;
  purchasePrice: number;
  reconditionCost: number;
  askPrice: number;
  status: "incoming" | "reconditioning" | "for_sale" | "sold";
  daysInStock: number;
}

export interface DashboardSummary {
  todaySales: number;
  todayProfit: number;
  creditOutstanding: number;
  lowStockCount: number;
  chequesDueSoon: number;
  bankBalance: number;
  cashInHand: number;
}
