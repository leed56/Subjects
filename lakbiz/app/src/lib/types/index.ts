export type SectorId =
  | "grocery"
  | "pharmacy"
  | "electronics"
  | "mobile_shop"
  | "electricals"
  | "spare_parts"
  | "footwear"
  | "textile"
  | "ac_hvac"
  | "car_sales";

export type UserRole = "owner" | "manager" | "cashier" | "technician";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "cheque"
  | "credit"
  /** Display/read value for invoices finalized through the normalized tender ledger. */
  | "mixed";

/** Inventory lane: new stock vs used/refurbished (Phase A). */
export type ProductCondition = "new" | "used";

/** Customer account: person vs B2B company (Phase B — same credit ledger). */
export type ContactType = "individual" | "company";

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
  /** Discontinued/retired items stay in the catalogue (job/sale history still
   * references them by id) but drop out of sale pickers, reorder signals,
   * and the default stock list. Defaults true for every existing row. */
  active: boolean;
  /** Free-text notes (storage/handling caveats, discontinued reason, etc.) — generic across every sector, not sector-specific like customFields. */
  notes?: string;
  customFields: Record<string, string | number | boolean>;
}

export type TextileLengthUnit = "metre" | "yard";

export type TextileRollStatus =
  | "unopened"
  | "opened"
  | "reserved"
  | "exhausted"
  | "quarantined"
  | "returned";

/** Physical fabric identity. Aggregate Product.stockQty remains available for
 * legacy catalogue views; roll-ledger availability becomes authoritative when
 * Textile roll tracking is enabled. */
export interface TextileRoll {
  id: string;
  organizationId: string;
  productId: string;
  rollNo: string;
  barcode?: string;
  supplierId?: string;
  supplierLot?: string;
  dyeLot?: string;
  shade?: string;
  width?: number;
  widthUnit?: "inch" | "centimetre";
  lengthUnit: TextileLengthUnit;
  receivedLength: number;
  remainingLength: number;
  reservedLength: number;
  damagedLength: number;
  unitCost?: number;
  rackLocation?: string;
  status: TextileRollStatus;
  receivedAt: string;
  notes?: string;
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
