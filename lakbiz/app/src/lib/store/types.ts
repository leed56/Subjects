import type { PaymentMethod, Product, SectorId } from "@/lib/types";
import type { BusinessInfo } from "@/lib/invoice";
import { defaultBusiness } from "@/lib/invoice";
import type { ACJobStatus } from "@/lib/ac-jobs";
import type { ACJobType } from "@/lib/ac-job-types";

export type JobAssigneeType = "team" | "contractor";

export interface ACJob {
  id: string;
  jobNo: string;
  date: string;
  jobType: ACJobType;
  assignedTechnician?: string;
  /** Who does the work: in-house team member or external contractor */
  assigneeType?: JobAssigneeType;
  /** Workforce id (technician or contractor) */
  assigneeId?: string;
  /** Amount paid to the contractor for this job (contractor jobs only) */
  subcontractCost?: number;
  customerId?: string;
  customerName: string;
  phone?: string;
  address: string;
  brand?: string;
  btu?: number;
  unitType?: string;
  unitCount: number;
  description: string;
  quotedAmount: number;
  depositAmount: number;
  pipeMeters?: number;
  status: ACJobStatus;
  scheduledDate?: string;
  installedDate?: string;
  /** Next service/cleaning due (YYYY-MM-DD), set on install */
  serviceDueDate?: string;
  /** When true, due date is owner-set and not auto-calculated from interval */
  serviceDueManual?: boolean;
  lastServiceDate?: string;
  serviceIntervalMonths?: number;
  /** Days until next service after each visit (90, 180, 365…) */
  serviceIntervalDays?: number;
  /** Annual maintenance contract */
  amcContract?: boolean;
  notes?: string;
}

export interface ACJobInput {
  jobType?: ACJobType;
  assignedTechnician?: string;
  assigneeType?: JobAssigneeType;
  assigneeId?: string;
  subcontractCost?: number;
  customerId?: string;
  customerName: string;
  phone?: string;
  address: string;
  brand?: string;
  btu?: number;
  unitType?: string;
  unitCount: number;
  description: string;
  quotedAmount: number;
  depositAmount: number;
  pipeMeters?: number;
  status: ACJobStatus;
  scheduledDate?: string;
  installedDate?: string;
  /** Next service/cleaning due (YYYY-MM-DD), set on install */
  serviceDueDate?: string;
  /** When true, due date is owner-set and not auto-calculated from interval */
  serviceDueManual?: boolean;
  lastServiceDate?: string;
  serviceIntervalMonths?: number;
  /** Days until next service after each visit (90, 180, 365…) */
  serviceIntervalDays?: number;
  /** Annual maintenance contract */
  amcContract?: boolean;
  notes?: string;
}

export type RecordACServiceInput = {
  intervalDays?: number;
  visitNotes?: string;
};

export type VehicleStatus =
  | "incoming"
  | "reconditioning"
  | "for_sale"
  | "sold";

export interface VehicleRecord {
  id: string;
  stockId: string;
  dateAdded: string;
  make: string;
  model: string;
  year: number;
  chassisNo: string;
  engineNo?: string;
  regNo?: string;
  color?: string;
  fuel: "petrol" | "diesel" | "hybrid" | "electric";
  transmission: "auto" | "manual";
  mileageKm: number;
  condition: string;
  purchasePrice: number;
  reconditionCost: number;
  askPrice: number;
  minPrice?: number;
  status: VehicleStatus;
  customerId?: string;
  customerName?: string;
  soldPrice?: number;
  soldDate?: string;
  financePartner?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface VehicleInput {
  make: string;
  model: string;
  year: number;
  chassisNo: string;
  engineNo?: string;
  regNo?: string;
  color?: string;
  fuel: VehicleRecord["fuel"];
  transmission: VehicleRecord["transmission"];
  mileageKm: number;
  condition: string;
  purchasePrice: number;
  reconditionCost: number;
  askPrice: number;
  minPrice?: number;
  status: VehicleStatus;
  notes?: string;
}

export interface VehicleSaleInput {
  vehicleId: string;
  sellPrice: number;
  customerId?: string;
  customerName?: string;
  paymentMethod: PaymentMethod;
  financePartner?: string;
}

export interface SaleLine {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  buyPrice: number;
}

export interface Sale {
  id: string;
  billNo?: string;
  date: string;
  lines: SaleLine[];
  /** Ex-VAT amount (sell prices are VAT-inclusive) */
  subtotal?: number;
  outputVat?: number;
  /** Bill-level discount in LKR applied to the inclusive total */
  discount?: number;
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
  /** Max outstanding credit allowed (LKR); undefined = no limit */
  creditLimit?: number;
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

export type WorkSpecialty = "installation" | "service" | "repair";

export interface Technician {
  id: string;
  name: string;
  phone?: string;
  specialties: WorkSpecialty[];
  active: boolean;
  notes?: string;
}

export type TechnicianInput = {
  name: string;
  phone?: string;
  specialties?: WorkSpecialty[];
  active?: boolean;
  notes?: string;
};

export type ContractorRateType = "per_job" | "per_unit" | "per_meter" | "fixed";

export interface Contractor {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  specialties: WorkSpecialty[];
  rateType: ContractorRateType;
  rateAmount: number;
  /** Outstanding amount the shop owes this contractor (LKR) */
  payableBalance: number;
  active: boolean;
  notes?: string;
}

export type ContractorInput = {
  name: string;
  company?: string;
  phone?: string;
  specialties?: WorkSpecialty[];
  rateType?: ContractorRateType;
  rateAmount?: number;
  active?: boolean;
  notes?: string;
};

export type BankTransactionType =
  | "deposit"
  | "withdrawal"
  | "fee"
  | "interest"
  | "adjustment";

export interface BankTransaction {
  id: string;
  accountId: string;
  type: BankTransactionType;
  amount: number;
  description?: string;
  reference?: string;
  date: string;
}

export interface BankTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  date: string;
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

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  /** Supplier VAT/BR number — needed for input VAT claims */
  vatNumber?: string;
  contactPerson?: string;
  payableBalance: number;
}

export interface PurchaseLine {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
}

export interface Purchase {
  id: string;
  grnNo: string;
  date: string;
  supplierId: string;
  supplierName: string;
  lines: PurchaseLine[];
  /** Pre-VAT line sum */
  subtotal?: number;
  inputVat?: number;
  total: number;
  paymentMethod: PaymentMethod;
  creditAmount: number;
  note?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  note?: string;
}

export interface AppData {
  business: BusinessInfo;
  products: Product[];
  sales: Sale[];
  stockLogs: StockLog[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  suppliers: Supplier[];
  purchases: Purchase[];
  supplierPayments: SupplierPayment[];
  acJobs: ACJob[];
  technicians: Technician[];
  contractors: Contractor[];
  vehicles: VehicleRecord[];
  bankAccounts: BankAccountRecord[];
  bankTransactions: BankTransaction[];
  bankTransfers: BankTransfer[];
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
  /** Sector-specific fields (BTU, brand, barcode, etc.) — unit is stored separately */
  customFields?: Record<string, string | number | boolean>;
};

export type CustomerInput = {
  name: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
};

export type SupplierInput = {
  name: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  contactPerson?: string;
};

export type PurchaseInput = {
  supplierId: string;
  lines: { productId: string; qty: number; unitCost: number }[];
  paymentMethod: PaymentMethod;
  /** Input VAT on supplier bill (defaults to 18% of subtotal when VAT registered) */
  inputVat?: number;
  note?: string;
  chequeNo?: string;
  chequeBank?: string;
  chequeDate?: string;
  postDated?: boolean;
};

export type BankAccountInput = {
  bankName: string;
  branch?: string;
  accountName: string;
  accountNumber: string;
  balance: number;
};

export type BankTransactionInput = {
  accountId: string;
  type: BankTransactionType;
  amount: number;
  description?: string;
  reference?: string;
  date?: string;
};

export type BankTransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  date?: string;
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

export type SaleLineInput = {
  productId: string;
  qty: number;
  /** Optional per-line price override (negotiated price) */
  unitPrice?: number;
};

export type SaleOptions = {
  customerId?: string;
  customerName?: string;
  /** Bill-level discount in LKR */
  discount?: number;
  chequeNo?: string;
  chequeBank?: string;
  chequeDate?: string;
  postDated?: boolean;
};
