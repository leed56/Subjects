import type { ContactType, PaymentMethod, Product, SectorId, ProductCondition } from "@/lib/types";
import type { BusinessInfo } from "@/lib/invoice";
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
  /** What the customer reported (HVAC platform Phase 9) — distinct from
   * `description`, which is an auto-generated equipment summary
   * (brand/BTU/unit type), not an editable "what's wrong" field. */
  complaint?: string;
  /** What the technician found on inspection (Phase 9) — distinct from
   * the complaint, which is the customer's own account before diagnosis. */
  diagnosis?: string;
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
  /** What the customer reported (HVAC platform Phase 9) — distinct from
   * `description`, which is an auto-generated equipment summary
   * (brand/BTU/unit type), not an editable "what's wrong" field. */
  complaint?: string;
  /** What the technician found on inspection (Phase 9) — distinct from
   * the complaint, which is the customer's own account before diagnosis. */
  diagnosis?: string;
}

export type RecordACServiceInput = {
  intervalDays?: number;
  visitNotes?: string;
};

/** "transport"/"other" added in the job-parts-materials phase — Part/
 * charge concepts that don't belong in "service" (call-out/inspection/
 * cleaning) any more than they belong in "part"/"labour". Everything
 * that isn't "part"/"labour" already falls into computeJobProfitability's
 * Other bucket, so widening this enum needed no change to that function. */
export type JobItemType = "part" | "labour" | "service" | "transport" | "other";

/** Only meaningful when itemType === "part" (HVAC platform Phase 4/5;
 * "manual" added in the job-parts-materials phase).
 * - stock: decremented from real inventory, unitPrice frozen from the
 *   product's buyPrice at the moment this item is created. Also used for
 *   an external purchase received into inventory (see `purchasedForJob`)
 *   — the historical-cost guarantee applies identically either way.
 * - purchased: "External Purchase" in the UI — bought specifically for
 *   this job via the Expense-only path, not from warehouse stock.
 * - manual: a quick ad-hoc material entry with no product record and no
 *   purchase tracking (e.g. "copper pipe, 4m" from a bulk supply the
 *   shop doesn't track by SKU) — distinct from "purchased", which always
 *   implies a tracked external-purchase transaction.
 * - customer_supplied: the customer provided the part; no inventory
 *   decrement, unitPrice defaults to 0. */
export type JobItemSource = "stock" | "purchased" | "manual" | "customer_supplied";

/** What happened to the part this line replaced (job-parts-materials
 * phase, Part 6). Only meaningful when `isReplacement` is true. */
export type JobItemDisposition =
  | "returned_to_customer"
  | "retained_by_company"
  | "sent_for_warranty"
  | "disposed"
  | "repairable_core_return"
  | "unknown";

/** Who stands behind the warranty on a replaced/installed component
 * (job-parts-materials phase, Part 6). Distinct from `ac_assets.
 * warrantyExpiry`, which covers the whole installed unit, not one part. */
export type JobItemWarrantyType = "none" | "company" | "supplier" | "manufacturer";

export interface JobItem {
  id: string;
  jobId: string;
  itemType: JobItemType;
  name: string;
  qty: number;
  /** Internal cost per unit — NOT what the customer is charged (see
   * `customerPrice`). For source "stock" this is a historical snapshot,
   * frozen when the item is created; never recalculated from the
   * product's current price afterward. */
  unitPrice: number;
  lineTotal: number;
  source?: JobItemSource;
  /** Set only when source === "stock" — links back to the real product
   * this material was decremented from. */
  productId?: string;
  /** source === "purchased" only. */
  supplierId?: string;
  purchaseRef?: string;
  purchaseDate?: string;
  /** What the customer is being charged for this specific item, when the
   * owner wants to track it per-line. Applies to "part" and "labour"
   * lines (HVAC platform Phase 6 extended this from parts-only) plus
   * "transport"/"other"/"service" (job-parts-materials phase). Feeds the
   * itemized invoice (see `invoiceable`) when present. */
  customerPrice?: number;
  /** itemType === "labour" only (HVAC platform Phase 6) — which roster
   * technician performed this line. Multiple technicians on one job are
   * supported by adding multiple labour lines with different
   * technicianId, rather than a schema change to ACJob's single
   * assigneeId — a job already has many job_items, so this needed no new
   * join table. */
  technicianId?: string;
  /** Free-text unit ("pcs", "m", "hrs") — a suggestion list in the UI,
   * never a rigid enum; manual free text must always remain possible. */
  unit?: string;
  /** Flat LKR amount subtracted from qty × customerPrice on the itemized
   * invoice. Never affects the internal cost figures — a customer
   * discount doesn't change what the shop actually spent. */
  discount?: number;
  /** Whether this line may appear on the customer-facing invoice.
   * Defaults true for customer-facing lines; the internal purchase-cost
   * side of a "purchased" line is never itself invoiceable. */
  invoiceable: boolean;
  /** True when a source==="stock" line's stock was received specifically
   * for this job via the External-Purchase-to-Inventory path, even
   * though its `source` is correctly "stock" once received — powers the
   * Purchased-for-Job filter without conflating "already in the
   * warehouse" with "we just bought this for you." */
  purchasedForJob?: boolean;
  /** Part 6 — replacement/warranty tracking, all optional. */
  isReplacement?: boolean;
  oldComponentName?: string;
  oldComponentSerial?: string;
  oldComponentDisposition?: JobItemDisposition;
  newComponentSerial?: string;
  warrantyType?: JobItemWarrantyType;
  /** Stored in days, matching the existing serviceIntervalDays/
   * computeServiceDueFromDays convention (ac-service.ts) — the UI offers
   * day and month presets and converts. */
  warrantyDays?: number;
  warrantyStartDate?: string;
  /** Computed client-side at save time (warrantyStartDate + warrantyDays)
   * and stored — same "store the derived date" pattern service_due_date
   * already uses, for cheap sorting/querying later. */
  warrantyExpiryDate?: string;
  /** Free-text notes for this line, distinct from the job's own notes. */
  notes?: string;
}

export type JobItemInput = {
  jobId: string;
  itemType: JobItemType;
  name: string;
  qty: number;
  unitPrice: number;
  source?: JobItemSource;
  productId?: string;
  supplierId?: string;
  purchaseRef?: string;
  purchaseDate?: string;
  customerPrice?: number;
  technicianId?: string;
  unit?: string;
  discount?: number;
  invoiceable?: boolean;
  isReplacement?: boolean;
  oldComponentName?: string;
  oldComponentSerial?: string;
  oldComponentDisposition?: JobItemDisposition;
  newComponentSerial?: string;
  warrantyType?: JobItemWarrantyType;
  warrantyDays?: number;
  warrantyStartDate?: string;
  warrantyExpiryDate?: string;
  notes?: string;
  /** External-Purchase-to-Inventory only (job-parts-materials phase):
   * quantity actually received into stock, which may exceed `qty` (the
   * quantity used on this job) — the surplus stays as real spare stock.
   * Only meaningful together with source === "stock" and a purchase
   * reference; see addJobItem's handling in actions.ts. */
  receiveQty?: number;
  /** Set alongside `receiveQty` when no existing product matches — the
   * name for a brand-new Product to create before receiving stock into
   * it. Ignored when `productId` is already set. */
  newProductName?: string;
  newProductCategory?: string;
};

export interface JobStatusEntry {
  id: string;
  jobId: string;
  oldStatus?: string;
  newStatus: string;
  note?: string;
  date: string;
}

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
  /** Receiving account for electronic/card settlement. */
  bankAccountId?: string;
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

/** "in"/"out" = manual adjustment (Stock In / Stock Out); "sale" and
 * "purchase" are existing/renamed-going-forward automatic movements;
 * the rest are new (HVAC platform Phase 3). Old rows saved with "in" for
 * a purchase receipt (pre-Phase-3 data) are left as-is — this only
 * changes what new records get tagged, so nothing that reads `type`
 * needs a migration. */
export type StockMovementType =
  | "in"
  | "out"
  | "sale"
  | "purchase"
  | "job_usage"
  | "job_return"
  | "supplier_return"
  | "write_off";

export interface StockLog {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  qty: number;
  note?: string;
  date: string;
  /** job_usage/job_return only */
  relatedJobId?: string;
  /** purchase/supplier_return only — the Purchase record already implies
   * this for "purchase", but logging it directly keeps StockLog
   * self-describing without a join back to `purchases`. */
  relatedSupplierId?: string;
  /** Org member who performed this movement, when known. Cloud-authenticated
   * actions only — actions.ts itself has no auth context (it's a pure
   * data-in/data-out module), so this is populated by the caller
   * (app-store-provider.tsx, which does have the Supabase user) and stays
   * unset for anything before this field existed or done fully offline
   * without a resolved session. */
  userId?: string;
}

export interface Customer {
  id: string;
  name: string;
  contactType: ContactType;
  /** Primary contact name when contactType is company */
  contactPerson?: string;
  /** Company VAT/TIN for B2B */
  vatNumber?: string;
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

/** B2B wholesale override for one company × product (Phase C). */
export interface CustomerProductPrice {
  id: string;
  customerId: string;
  productId: string;
  price: number;
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
  /** Internal labor cost basis (LKR/hour) — HVAC platform Phase 6.
   * Optional: no fabricated cost for technicians with no configured rate.
   * Financial data, masked from non-financial roles at the DB level the
   * same way products.buyPrice is (see the Phase 6 migration). */
  hourlyRate?: number;
}

export type TechnicianInput = {
  name: string;
  phone?: string;
  specialties?: WorkSpecialty[];
  active?: boolean;
  notes?: string;
  hourlyRate?: number;
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

export interface ContractorPayment {
  id: string;
  contractorId: string;
  contractorName: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  note?: string;
}

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

/** HVAC platform Phase 13 — purchase orders are a distinct workflow from
 * `Purchase` (GRN): a PO is placed before goods arrive and may be received
 * in one or more partial deliveries. `Purchase`/GRN remains the "I already
 * have the goods + the supplier bill in hand" flow and is unaffected. */
export type PurchaseOrderStatus = "pending" | "partial" | "received" | "cancelled";

export interface PurchaseOrderLine {
  productId: string;
  productName: string;
  qtyOrdered: number;
  /** Cumulative quantity received against this line so far — never exceeds
   * qtyOrdered. Only qtyReceived (not qtyOrdered) ever moves stock. */
  qtyReceived: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  date: string;
  supplierId: string;
  supplierName: string;
  lines: PurchaseOrderLine[];
  /** Sum of qtyOrdered × unitCost across lines — an estimate, not a bill. */
  expectedTotal: number;
  status: PurchaseOrderStatus;
  /** Optional link to the job this stock was ordered for (HVAC Phase 13:
   * "linked job" per the spec's field list) — informational only, does not
   * itself move job costing; job costing still runs off job_items. */
  relatedJobId?: string;
  note?: string;
  /** Set once the PO first receives any quantity; not cleared on later
   * partial receipts, so it reads as "receiving started on". */
  receivedDate?: string;
}

export type PurchaseOrderInput = {
  supplierId: string;
  lines: { productId: string; qty: number; unitCost: number }[];
  relatedJobId?: string;
  note?: string;
};

/** One line's newly-received quantity for a single receiving event — not
 * the cumulative total, the delta being added now. */
export type PurchaseOrderReceiveLine = { productId: string; qtyReceived: number };

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
  customerProductPrices: CustomerProductPrice[];
  suppliers: Supplier[];
  purchases: Purchase[];
  purchaseOrders: PurchaseOrder[];
  supplierPayments: SupplierPayment[];
  acJobs: ACJob[];
  jobItems: JobItem[];
  jobStatusHistory: JobStatusEntry[];
  technicians: Technician[];
  contractors: Contractor[];
  contractorPayments: ContractorPayment[];
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
  condition?: ProductCondition;
  buyPrice: number;
  sellPrice: number;
  stockQty: number;
  reorderLevel?: number;
  unit: string;
  /** Sector-specific fields (BTU, brand, barcode, etc.) — unit is stored separately */
  customFields?: Record<string, string | number | boolean>;
  /** Defaults true when omitted (new items are active by default). */
  active?: boolean;
  notes?: string;
};

export type CustomerInput = {
  name: string;
  contactType?: ContactType;
  contactPerson?: string;
  vatNumber?: string;
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
  buyerPhone?: string;
  buyerAddress?: string;
  /** Create a Customers row when selling to a new buyer (walk-in) */
  addToCustomers?: boolean;
  /** Create an AC installation job for service follow-up */
  createInstallJob?: boolean;
  /** Bill-level discount in LKR */
  discount?: number;
  chequeNo?: string;
  chequeBank?: string;
  chequeDate?: string;
  postDated?: boolean;
};
