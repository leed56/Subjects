import { newId, todayKey } from "@/lib/format";
import { generateBillNo, generateGrnNo, type BusinessInfo } from "@/lib/invoice";
import { calcInputVat, isVatEnabled, splitInclusiveTotal } from "@/lib/vat";
import { generateJobNo } from "@/lib/ac-jobs";
import {
  computeServiceDueFromDays,
  DEFAULT_SERVICE_INTERVAL_DAYS,
  isServiceDueWithinDays,
  isServiceOverdue,
  resolveServiceIntervalDays,
} from "@/lib/ac-service";
import { defaultStatusForJobType, type ACJobType } from "@/lib/ac-job-types";
import {
  daysInStock,
  generateVehicleStockId,
  vehicleTotalCost,
} from "@/lib/vehicles";
import { sanitizeCustomFields } from "@/lib/sector-fields";
import { parseProductCondition } from "@/lib/product-condition";
import { parseContactType } from "@/lib/contact-type";
import type { PaymentMethod, Product } from "@/lib/types";
import type {
  AppData,
  ACJob,
  ACJobInput,
  RecordACServiceInput,
  BankAccountInput,
  BankTransaction,
  BankTransactionInput,
  BankTransactionType,
  BankTransfer,
  BankTransferInput,
  ChequeInput,
  ChequeStatus,
  Contractor,
  ContractorInput,
  ContractorPayment,
  JobItem,
  JobItemInput,
  JobStatusEntry,
  Technician,
  TechnicianInput,
  WorkSpecialty,
  CustomerInput,
  ProductInput,
  Purchase,
  PurchaseInput,
  Sale,
  SaleOptions,
  StockLog,
  SupplierInput,
  VehicleInput,
  VehicleSaleInput,
  VehicleRecord,
} from "./types";

export function addProduct(data: AppData, input: ProductInput): AppData {
  const product: Product = {
    id: newId(),
    name: input.name.trim(),
    sku: input.sku?.trim() || undefined,
    category: input.category.trim(),
    sectorId: input.sectorId,
    condition: parseProductCondition(input.condition),
    buyPrice: input.buyPrice,
    sellPrice: input.sellPrice,
    stockQty: input.stockQty,
    reorderLevel: input.reorderLevel,
    customFields: {
      unit: input.unit,
      ...sanitizeCustomFields(input.sectorId, input.customFields ?? {}),
    },
  };

  const stockLogs: StockLog[] = [...data.stockLogs];
  if (input.stockQty > 0) {
    stockLogs.unshift({
      id: newId(),
      productId: product.id,
      productName: product.name,
      type: "in",
      qty: input.stockQty,
      note: "Opening stock",
      date: new Date().toISOString(),
    });
  }

  return {
    ...data,
    products: [product, ...data.products],
    stockLogs,
  };
}

export function updateProduct(
  data: AppData,
  id: string,
  input: ProductInput,
): AppData {
  return {
    ...data,
    products: data.products.map((p) =>
      p.id === id
        ? {
            ...p,
            name: input.name.trim(),
            sku: input.sku?.trim() || undefined,
            category: input.category.trim(),
            sectorId: input.sectorId,
            condition: parseProductCondition(input.condition ?? p.condition),
            buyPrice: input.buyPrice,
            sellPrice: input.sellPrice,
            stockQty: input.stockQty,
            reorderLevel: input.reorderLevel,
            customFields: {
              unit: input.unit,
              ...sanitizeCustomFields(input.sectorId, input.customFields ?? {}),
            },
          }
        : p,
    ),
  };
}

export function deleteProduct(data: AppData, id: string): AppData {
  return {
    ...data,
    products: data.products.filter((p) => p.id !== id),
  };
}

export function adjustStock(
  data: AppData,
  productId: string,
  qty: number,
  type: "in" | "out",
  note?: string,
): AppData {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return data;

  const delta = type === "in" ? qty : -qty;
  const nextQty = Math.max(0, product.stockQty + delta);

  const log: StockLog = {
    id: newId(),
    productId,
    productName: product.name,
    type,
    qty,
    note,
    date: new Date().toISOString(),
  };

  return {
    ...data,
    products: data.products.map((p) =>
      p.id === productId ? { ...p, stockQty: nextQty } : p,
    ),
    stockLogs: [log, ...data.stockLogs],
  };
}

export function addCustomer(data: AppData, input: CustomerInput): AppData {
  const contactType = parseContactType(input.contactType);
  const isCompany = contactType === "company";
  const customer = {
    id: newId(),
    name: input.name.trim(),
    contactType,
    contactPerson: isCompany ? input.contactPerson?.trim() || undefined : undefined,
    vatNumber: isCompany ? input.vatNumber?.trim() || undefined : undefined,
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    creditLimit:
      input.creditLimit != null && input.creditLimit > 0
        ? input.creditLimit
        : undefined,
    creditBalance: 0,
  };
  return { ...data, customers: [customer, ...data.customers] };
}

export function updateCustomer(
  data: AppData,
  id: string,
  input: CustomerInput,
): AppData {
  const contactType = parseContactType(input.contactType);
  const isCompany = contactType === "company";
  return {
    ...data,
    customers: data.customers.map((c) =>
      c.id === id
        ? {
            ...c,
            name: input.name.trim(),
            contactType,
            contactPerson: isCompany
              ? input.contactPerson?.trim() || undefined
              : undefined,
            vatNumber: isCompany ? input.vatNumber?.trim() || undefined : undefined,
            phone: input.phone?.trim() || undefined,
            address: input.address?.trim() || undefined,
            creditLimit:
              input.creditLimit != null && input.creditLimit > 0
                ? input.creditLimit
                : undefined,
          }
        : c,
    ),
  };
}

export function deleteCustomer(data: AppData, id: string): AppData {
  return {
    ...data,
    customers: data.customers.filter((c) => c.id !== id),
  };
}

export function recordCustomerPayment(
  data: AppData,
  customerId: string,
  amount: number,
  method: PaymentMethod,
  note?: string,
): AppData {
  if (amount <= 0) return data;
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) return data;

  const payment = {
    id: newId(),
    customerId,
    customerName: customer.name,
    amount,
    date: new Date().toISOString(),
    method,
    note,
  };

  return {
    ...data,
    customerPayments: [payment, ...data.customerPayments],
    customers: data.customers.map((c) =>
      c.id === customerId
        ? { ...c, creditBalance: Math.max(0, c.creditBalance - amount) }
        : c,
    ),
  };
}

export function addSupplier(data: AppData, input: SupplierInput): AppData {
  const supplier = {
    id: newId(),
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    vatNumber: input.vatNumber?.trim() || undefined,
    contactPerson: input.contactPerson?.trim() || undefined,
    payableBalance: 0,
  };
  return { ...data, suppliers: [supplier, ...data.suppliers] };
}

export function updateSupplier(
  data: AppData,
  id: string,
  input: SupplierInput,
): AppData {
  return {
    ...data,
    suppliers: data.suppliers.map((s) =>
      s.id === id
        ? {
            ...s,
            name: input.name.trim(),
            phone: input.phone?.trim() || undefined,
            address: input.address?.trim() || undefined,
            vatNumber: input.vatNumber?.trim() || undefined,
            contactPerson: input.contactPerson?.trim() || undefined,
          }
        : s,
    ),
  };
}

export function deleteSupplier(data: AppData, id: string): AppData {
  return {
    ...data,
    suppliers: data.suppliers.filter((s) => s.id !== id),
  };
}

export function recordSupplierPayment(
  data: AppData,
  supplierId: string,
  amount: number,
  method: PaymentMethod,
  note?: string,
): AppData {
  if (amount <= 0) return data;
  const supplier = data.suppliers.find((s) => s.id === supplierId);
  if (!supplier) return data;

  const payment = {
    id: newId(),
    supplierId,
    supplierName: supplier.name,
    amount,
    date: new Date().toISOString(),
    method,
    note,
  };

  return {
    ...data,
    supplierPayments: [payment, ...data.supplierPayments],
    suppliers: data.suppliers.map((s) =>
      s.id === supplierId
        ? { ...s, payableBalance: Math.max(0, s.payableBalance - amount) }
        : s,
    ),
  };
}

export function createPurchase(
  data: AppData,
  input: PurchaseInput,
): AppData {
  const supplier = data.suppliers.find((s) => s.id === input.supplierId);
  if (!supplier) return data;

  const purchaseLines = input.lines
    .map(({ productId, qty, unitCost }) => {
      const product = data.products.find((p) => p.id === productId);
      if (!product || qty <= 0 || unitCost < 0) return null;
      return {
        productId,
        productName: product.name,
        qty,
        unitCost,
      };
    })
    .filter(Boolean) as Purchase["lines"];

  if (purchaseLines.length === 0) return data;

  if (input.paymentMethod === "credit" && !supplier) return data;
  if (
    input.paymentMethod === "cheque" &&
    (!input.chequeNo || !input.chequeBank || !input.chequeDate)
  ) {
    return data;
  }

  const subtotal = purchaseLines.reduce((s, l) => s + l.unitCost * l.qty, 0);
  const inputVat =
    input.inputVat != null
      ? Math.max(0, input.inputVat)
      : isVatEnabled(data.business)
        ? calcInputVat(subtotal)
        : 0;
  const total = subtotal + inputVat;
  const purchaseId = newId();
  const date = new Date().toISOString();

  let cheques = data.cheques;
  if (input.paymentMethod === "cheque") {
    cheques = [
      {
        id: newId(),
        direction: "paid" as const,
        chequeNo: input.chequeNo!.trim(),
        bankName: input.chequeBank!.trim(),
        partyName: supplier.name,
        amount: total,
        chequeDate: input.chequeDate!,
        postDated: input.postDated ?? false,
        status: "pending" as const,
        note: `GRN purchase`,
      },
      ...cheques,
    ];
  }

  const purchase: Purchase = {
    id: purchaseId,
    grnNo: generateGrnNo(data.purchases.length),
    date,
    supplierId: supplier.id,
    supplierName: supplier.name,
    lines: purchaseLines,
    subtotal,
    inputVat,
    total,
    paymentMethod: input.paymentMethod,
    creditAmount: input.paymentMethod === "credit" ? total : 0,
    note: input.note,
  };

  const qtyByProduct = new Map(
    purchaseLines.map((l) => [l.productId, l] as const),
  );

  const stockLogs: StockLog[] = purchaseLines.map((line) => ({
    id: newId(),
    productId: line.productId,
    productName: line.productName,
    type: "in",
    qty: line.qty,
    note: `GRN ${purchase.grnNo}`,
    date,
  }));

  let suppliers = data.suppliers;
  if (input.paymentMethod === "credit") {
    suppliers = suppliers.map((s) =>
      s.id === supplier.id
        ? { ...s, payableBalance: s.payableBalance + total }
        : s,
    );
  }

  return {
    ...data,
    purchases: [purchase, ...data.purchases],
    suppliers,
    cheques,
    products: data.products.map((p) => {
      const line = qtyByProduct.get(p.id);
      if (!line) return p;
      return {
        ...p,
        stockQty: p.stockQty + line.qty,
        buyPrice: line.unitCost,
      };
    }),
    stockLogs: [...stockLogs, ...data.stockLogs],
  };
}

export function addACJob(data: AppData, input: ACJobInput): AppData {
  const customer = input.customerId
    ? data.customers.find((c) => c.id === input.customerId)
    : undefined;

  const jobType: ACJobType = input.jobType ?? "installation";
  const intervalDays =
    input.serviceIntervalDays ??
    (input.serviceIntervalMonths != null
      ? input.serviceIntervalMonths * 30
      : DEFAULT_SERVICE_INTERVAL_DAYS);
  const status = input.status ?? defaultStatusForJobType(jobType);
  const installedDate = input.installedDate;
  const serviceDueManual = input.serviceDueManual ?? false;
  let serviceDueDate = input.serviceDueDate;

  if (!serviceDueManual) {
    if (!serviceDueDate && status === "installed" && installedDate) {
      serviceDueDate = computeServiceDueFromDays(installedDate, intervalDays);
    } else if (
      !serviceDueDate &&
      (jobType === "service" || jobType === "repair")
    ) {
      const base =
        input.scheduledDate ?? new Date().toISOString().slice(0, 10);
      serviceDueDate = computeServiceDueFromDays(base, intervalDays);
    }
  }

  const job = {
    id: newId(),
    jobNo: generateJobNo(data.acJobs.length),
    date: new Date().toISOString(),
    jobType,
    assignedTechnician: input.assignedTechnician?.trim() || undefined,
    assigneeType: input.assigneeType,
    assigneeId: input.assigneeId,
    subcontractCost:
      input.assigneeType === "contractor" ? input.subcontractCost : undefined,
    customerId: input.customerId,
    customerName: customer?.name ?? input.customerName.trim(),
    phone: input.phone?.trim() || customer?.phone || undefined,
    address: input.address.trim(),
    brand: input.brand?.trim() || undefined,
    btu: input.btu,
    unitType: input.unitType?.trim() || undefined,
    unitCount: input.unitCount,
    description: input.description.trim(),
    quotedAmount: input.quotedAmount,
    depositAmount: input.depositAmount,
    pipeMeters: input.pipeMeters,
    status,
    scheduledDate: input.scheduledDate,
    installedDate,
    serviceDueDate,
    serviceDueManual,
    lastServiceDate: input.lastServiceDate,
    serviceIntervalDays: intervalDays,
    serviceIntervalMonths: Math.max(1, Math.round(intervalDays / 30)),
    amcContract: input.amcContract ?? false,
    notes: input.notes?.trim() || undefined,
  };

  const statusEntry: JobStatusEntry = {
    id: newId(),
    jobId: job.id,
    newStatus: job.status,
    date: new Date().toISOString(),
  };

  return recomputeContractorPayables({
    ...data,
    acJobs: [job, ...data.acJobs],
    jobStatusHistory: [statusEntry, ...data.jobStatusHistory],
  });
}

export function updateACJob(
  data: AppData,
  id: string,
  input: Partial<ACJobInput>,
): AppData {
  const previous = data.acJobs.find((j) => j.id === id);
  let nextStatusValue: string | undefined;
  const acJobs = data.acJobs.map((j) => {
      if (j.id !== id) return j;
      const customer = input.customerId
        ? data.customers.find((c) => c.id === input.customerId)
        : undefined;
      const nextStatus = input.status ?? j.status;
      const installedDate =
        input.installedDate ??
        (nextStatus === "installed" && !j.installedDate
          ? new Date().toISOString().slice(0, 10)
          : j.installedDate);
      const intervalDays =
        input.serviceIntervalDays ??
        j.serviceIntervalDays ??
        (input.serviceIntervalMonths != null
          ? input.serviceIntervalMonths * 30
          : resolveServiceIntervalDays(j));

      const serviceDueManual =
        input.serviceDueManual ?? j.serviceDueManual ?? false;
      let serviceDueDate = input.serviceDueDate ?? j.serviceDueDate;

      if (!serviceDueManual) {
        if (
          nextStatus === "installed" &&
          installedDate &&
          (!serviceDueDate ||
            input.installedDate ||
            input.status === "installed")
        ) {
          serviceDueDate = computeServiceDueFromDays(installedDate, intervalDays);
        } else if (
          (input.serviceIntervalDays != null ||
            input.serviceIntervalMonths != null) &&
          input.serviceDueDate === undefined &&
          input.serviceDueManual === undefined
        ) {
          const base = j.lastServiceDate ?? j.installedDate ?? j.scheduledDate;
          if (
            base &&
            ["installed", "completed", "service_due"].includes(nextStatus)
          ) {
            serviceDueDate = computeServiceDueFromDays(base, intervalDays);
          }
        }
      } else if (input.serviceDueDate !== undefined) {
        serviceDueDate = input.serviceDueDate;
      }

      let status = nextStatus;
      if (
        serviceDueDate &&
        (status === "installed" || status === "completed") &&
        (isServiceOverdue(serviceDueDate) ||
          isServiceDueWithinDays(serviceDueDate, 0))
      ) {
        status = "service_due";
      }

      const result: ACJob = {
        ...j,
        jobType: input.jobType ?? j.jobType,
        assignedTechnician:
          input.assignedTechnician?.trim() ?? j.assignedTechnician,
        assigneeType: "assigneeType" in input ? input.assigneeType : j.assigneeType,
        assigneeId: "assigneeId" in input ? input.assigneeId : j.assigneeId,
        subcontractCost:
          "subcontractCost" in input
            ? input.assigneeType === "contractor"
              ? input.subcontractCost
              : "assigneeType" in input
                ? undefined
                : input.subcontractCost
            : j.subcontractCost,
        customerId: input.customerId ?? j.customerId,
        customerName:
          customer?.name ??
          (input.customerName?.trim() || j.customerName),
        phone: input.phone?.trim() ?? j.phone,
        address: input.address?.trim() ?? j.address,
        brand: input.brand?.trim() ?? j.brand,
        btu: input.btu ?? j.btu,
        unitType: input.unitType?.trim() ?? j.unitType,
        unitCount: input.unitCount ?? j.unitCount,
        description: input.description?.trim() ?? j.description,
        quotedAmount: input.quotedAmount ?? j.quotedAmount,
        depositAmount: input.depositAmount ?? j.depositAmount,
        pipeMeters: input.pipeMeters ?? j.pipeMeters,
        status,
        scheduledDate: input.scheduledDate ?? j.scheduledDate,
        installedDate,
        serviceDueDate,
        serviceDueManual,
        lastServiceDate: input.lastServiceDate ?? j.lastServiceDate,
        serviceIntervalDays: intervalDays,
        serviceIntervalMonths: Math.max(1, Math.round(intervalDays / 30)),
        amcContract: input.amcContract ?? j.amcContract ?? false,
        notes: input.notes?.trim() ?? j.notes,
      };
      nextStatusValue = result.status;
      return result;
    });

  const statusChanged =
    !!previous && nextStatusValue != null && previous.status !== nextStatusValue;
  const jobStatusHistory = statusChanged
    ? [
        {
          id: newId(),
          jobId: id,
          oldStatus: previous!.status,
          newStatus: nextStatusValue!,
          date: new Date().toISOString(),
        },
        ...data.jobStatusHistory,
      ]
    : data.jobStatusHistory;

  return recomputeContractorPayables({ ...data, acJobs, jobStatusHistory });
}

export function deleteACJob(data: AppData, id: string): AppData {
  return recomputeContractorPayables({
    ...data,
    acJobs: data.acJobs.filter((j) => j.id !== id),
    jobItems: data.jobItems.filter((i) => i.jobId !== id),
    jobStatusHistory: data.jobStatusHistory.filter((h) => h.jobId !== id),
  });
}

export function addJobItem(data: AppData, input: JobItemInput): AppData {
  const name = input.name.trim();
  if (!name || !data.acJobs.some((j) => j.id === input.jobId)) return data;
  const qty = input.qty > 0 ? input.qty : 1;
  const unitPrice = Math.max(0, input.unitPrice);
  const item: JobItem = {
    id: newId(),
    jobId: input.jobId,
    itemType: input.itemType,
    name,
    qty,
    unitPrice,
    lineTotal: Math.round(qty * unitPrice * 100) / 100,
  };
  return { ...data, jobItems: [item, ...data.jobItems] };
}

export function deleteJobItem(data: AppData, id: string): AppData {
  return { ...data, jobItems: data.jobItems.filter((i) => i.id !== id) };
}

/** Mark service visit complete and schedule next due date (days-based) */
export function recordACService(
  data: AppData,
  jobId: string,
  input: RecordACServiceInput = {},
): AppData {
  const job = data.acJobs.find((j) => j.id === jobId);
  if (!job) return data;

  const today = new Date().toISOString().slice(0, 10);
  const intervalDays =
    input.intervalDays ?? resolveServiceIntervalDays(job);
  const nextDue = computeServiceDueFromDays(today, intervalDays);
  const visitNote = input.visitNotes?.trim();
  const notes = visitNote
    ? [job.notes, `${today}: ${visitNote}`].filter(Boolean).join("\n")
    : job.notes;

  return updateACJob(data, jobId, {
    lastServiceDate: today,
    serviceDueDate: nextDue,
    serviceDueManual: false,
    serviceIntervalDays: intervalDays,
    serviceIntervalMonths: Math.max(1, Math.round(intervalDays / 30)),
    status: "completed",
    notes,
  });
}

const WORK_SPECIALTIES: WorkSpecialty[] = ["installation", "service", "repair"];

function cleanSpecialties(input?: WorkSpecialty[]): WorkSpecialty[] {
  if (!input) return [];
  return WORK_SPECIALTIES.filter((s) => input.includes(s));
}

export function addTechnician(data: AppData, input: TechnicianInput): AppData {
  const name = input.name.trim();
  if (!name) return data;
  const technician: Technician = {
    id: newId(),
    name,
    phone: input.phone?.trim() || undefined,
    specialties: cleanSpecialties(input.specialties),
    active: input.active ?? true,
    notes: input.notes?.trim() || undefined,
  };
  return { ...data, technicians: [technician, ...data.technicians] };
}

export function updateTechnician(
  data: AppData,
  id: string,
  input: Partial<TechnicianInput>,
): AppData {
  return {
    ...data,
    technicians: data.technicians.map((t) =>
      t.id === id
        ? {
            ...t,
            name: input.name?.trim() || t.name,
            phone:
              input.phone !== undefined ? input.phone.trim() || undefined : t.phone,
            specialties: input.specialties
              ? cleanSpecialties(input.specialties)
              : t.specialties,
            active: input.active ?? t.active,
            notes:
              input.notes !== undefined ? input.notes.trim() || undefined : t.notes,
          }
        : t,
    ),
  };
}

export function deleteTechnician(data: AppData, id: string): AppData {
  return { ...data, technicians: data.technicians.filter((t) => t.id !== id) };
}

/**
 * Derive each contractor's payable balance from completed contractor jobs
 * (subcontract cost) minus payouts. Deterministic — call after any change to
 * jobs or contractor payments so balances never drift.
 */
export function recomputeContractorPayables(data: AppData): AppData {
  const accrued = new Map<string, number>();
  for (const j of data.acJobs) {
    if (j.assigneeType === "contractor" && j.assigneeId && j.status === "completed") {
      accrued.set(
        j.assigneeId,
        (accrued.get(j.assigneeId) ?? 0) + (j.subcontractCost ?? 0),
      );
    }
  }
  const paid = new Map<string, number>();
  for (const p of data.contractorPayments) {
    paid.set(p.contractorId, (paid.get(p.contractorId) ?? 0) + p.amount);
  }
  return {
    ...data,
    contractors: data.contractors.map((c) => ({
      ...c,
      payableBalance: Math.max(0, (accrued.get(c.id) ?? 0) - (paid.get(c.id) ?? 0)),
    })),
  };
}

export function recordContractorPayment(
  data: AppData,
  contractorId: string,
  amount: number,
  method: PaymentMethod,
  note?: string,
): AppData {
  if (amount <= 0) return data;
  const contractor = data.contractors.find((c) => c.id === contractorId);
  if (!contractor) return data;

  const payment: ContractorPayment = {
    id: newId(),
    contractorId,
    contractorName: contractor.name,
    amount,
    date: new Date().toISOString(),
    method,
    note: note?.trim() || undefined,
  };

  return recomputeContractorPayables({
    ...data,
    contractorPayments: [payment, ...data.contractorPayments],
  });
}

export function addContractor(data: AppData, input: ContractorInput): AppData {
  const name = input.name.trim();
  if (!name) return data;
  const contractor: Contractor = {
    id: newId(),
    name,
    company: input.company?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    specialties: cleanSpecialties(input.specialties),
    rateType: input.rateType ?? "per_job",
    rateAmount: Math.max(0, input.rateAmount ?? 0),
    payableBalance: 0,
    active: input.active ?? true,
    notes: input.notes?.trim() || undefined,
  };
  return { ...data, contractors: [contractor, ...data.contractors] };
}

export function updateContractor(
  data: AppData,
  id: string,
  input: Partial<ContractorInput>,
): AppData {
  return {
    ...data,
    contractors: data.contractors.map((c) =>
      c.id === id
        ? {
            ...c,
            name: input.name?.trim() || c.name,
            company:
              input.company !== undefined
                ? input.company.trim() || undefined
                : c.company,
            phone:
              input.phone !== undefined ? input.phone.trim() || undefined : c.phone,
            specialties: input.specialties
              ? cleanSpecialties(input.specialties)
              : c.specialties,
            rateType: input.rateType ?? c.rateType,
            rateAmount:
              input.rateAmount != null
                ? Math.max(0, input.rateAmount)
                : c.rateAmount,
            active: input.active ?? c.active,
            notes:
              input.notes !== undefined ? input.notes.trim() || undefined : c.notes,
          }
        : c,
    ),
  };
}

export function deleteContractor(data: AppData, id: string): AppData {
  return { ...data, contractors: data.contractors.filter((c) => c.id !== id) };
}

export function addVehicle(data: AppData, input: VehicleInput): AppData {
  const chassis = input.chassisNo.trim().toUpperCase();
  if (data.vehicles.some((v) => v.chassisNo === chassis && v.status !== "sold")) {
    return data;
  }

  const vehicle: VehicleRecord = {
    id: newId(),
    stockId: generateVehicleStockId(data.vehicles.length),
    dateAdded: new Date().toISOString(),
    make: input.make.trim(),
    model: input.model.trim(),
    year: input.year,
    chassisNo: chassis,
    engineNo: input.engineNo?.trim() || undefined,
    regNo: input.regNo?.trim() || undefined,
    color: input.color?.trim() || undefined,
    fuel: input.fuel,
    transmission: input.transmission,
    mileageKm: input.mileageKm,
    condition: input.condition.trim(),
    purchasePrice: input.purchasePrice,
    reconditionCost: input.reconditionCost,
    askPrice: input.askPrice,
    minPrice: input.minPrice,
    status: input.status,
    notes: input.notes?.trim() || undefined,
  };

  return { ...data, vehicles: [vehicle, ...data.vehicles] };
}

export function updateVehicle(
  data: AppData,
  id: string,
  input: Partial<VehicleInput>,
): AppData {
  return {
    ...data,
    vehicles: data.vehicles.map((v) => {
      if (v.id !== id || v.status === "sold") return v;
      const chassis = input.chassisNo?.trim().toUpperCase();
      return {
        ...v,
        make: input.make?.trim() ?? v.make,
        model: input.model?.trim() ?? v.model,
        year: input.year ?? v.year,
        chassisNo: chassis ?? v.chassisNo,
        engineNo: input.engineNo?.trim() ?? v.engineNo,
        regNo: input.regNo?.trim() ?? v.regNo,
        color: input.color?.trim() ?? v.color,
        fuel: input.fuel ?? v.fuel,
        transmission: input.transmission ?? v.transmission,
        mileageKm: input.mileageKm ?? v.mileageKm,
        condition: input.condition?.trim() ?? v.condition,
        purchasePrice: input.purchasePrice ?? v.purchasePrice,
        reconditionCost: input.reconditionCost ?? v.reconditionCost,
        askPrice: input.askPrice ?? v.askPrice,
        minPrice: input.minPrice ?? v.minPrice,
        status: input.status ?? v.status,
        notes: input.notes?.trim() ?? v.notes,
      };
    }),
  };
}

export function sellVehicle(
  data: AppData,
  input: VehicleSaleInput,
): AppData {
  const vehicle = data.vehicles.find((v) => v.id === input.vehicleId);
  if (!vehicle || vehicle.status === "sold" || input.sellPrice <= 0) {
    return data;
  }

  const customer = input.customerId
    ? data.customers.find((c) => c.id === input.customerId)
    : undefined;

  const customerName =
    customer?.name ?? (input.customerName?.trim() || undefined);

  const cost = vehicleTotalCost(
    vehicle.purchasePrice,
    vehicle.reconditionCost,
  );
  const profit = input.sellPrice - cost;
  const soldDate = new Date().toISOString();

  let customers = data.customers;
  if (input.paymentMethod === "credit" && input.customerId) {
    customers = customers.map((c) =>
      c.id === input.customerId
        ? { ...c, creditBalance: c.creditBalance + input.sellPrice }
        : c,
    );
  }

  return {
    ...data,
    customers,
    vehicles: data.vehicles.map((v) =>
      v.id === input.vehicleId
        ? {
            ...v,
            status: "sold" as const,
            soldPrice: input.sellPrice,
            soldDate,
            customerId: input.customerId,
            customerName,
            financePartner: input.financePartner,
            paymentMethod: input.paymentMethod,
          }
        : v,
    ),
  };
}

export function deleteVehicle(data: AppData, id: string): AppData {
  const vehicle = data.vehicles.find((v) => v.id === id);
  if (!vehicle || vehicle.status === "sold") return data;
  return { ...data, vehicles: data.vehicles.filter((v) => v.id !== id) };
}

export function addBankAccount(
  data: AppData,
  input: BankAccountInput,
): AppData {
  const account = {
    id: newId(),
    bankName: input.bankName.trim(),
    branch: input.branch?.trim() || undefined,
    accountName: input.accountName.trim(),
    accountNumber: input.accountNumber.trim(),
    balance: input.balance,
  };
  return { ...data, bankAccounts: [account, ...data.bankAccounts] };
}

export function deleteBankAccount(data: AppData, id: string): AppData {
  return {
    ...data,
    bankAccounts: data.bankAccounts.filter((a) => a.id !== id),
  };
}

/** Signed effect of a transaction on its account balance. */
function txnBalanceDelta(type: BankTransactionType, amount: number): number {
  if (type === "withdrawal" || type === "fee") return -amount;
  return amount; // deposit, interest, adjustment (adjustment may be negative)
}

export function addBankTransaction(
  data: AppData,
  input: BankTransactionInput,
): AppData {
  const account = data.bankAccounts.find((a) => a.id === input.accountId);
  if (!account || input.amount === 0) return data;

  const txn: BankTransaction = {
    id: newId(),
    accountId: input.accountId,
    type: input.type,
    amount: input.amount,
    description: input.description?.trim() || undefined,
    reference: input.reference?.trim() || undefined,
    date: input.date ?? new Date().toISOString(),
  };

  const delta = txnBalanceDelta(input.type, input.amount);

  return {
    ...data,
    bankTransactions: [txn, ...data.bankTransactions],
    bankAccounts: data.bankAccounts.map((a) =>
      a.id === input.accountId ? { ...a, balance: a.balance + delta } : a,
    ),
  };
}

export function deleteBankTransaction(data: AppData, id: string): AppData {
  const txn = data.bankTransactions.find((t) => t.id === id);
  if (!txn) return data;

  const delta = txnBalanceDelta(txn.type, txn.amount);

  return {
    ...data,
    bankTransactions: data.bankTransactions.filter((t) => t.id !== id),
    bankAccounts: data.bankAccounts.map((a) =>
      a.id === txn.accountId ? { ...a, balance: a.balance - delta } : a,
    ),
  };
}

export function addBankTransfer(
  data: AppData,
  input: BankTransferInput,
): AppData {
  if (
    input.amount <= 0 ||
    input.fromAccountId === input.toAccountId ||
    !data.bankAccounts.some((a) => a.id === input.fromAccountId) ||
    !data.bankAccounts.some((a) => a.id === input.toAccountId)
  ) {
    return data;
  }

  const transfer: BankTransfer = {
    id: newId(),
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    description: input.description?.trim() || undefined,
    date: input.date ?? new Date().toISOString(),
  };

  return {
    ...data,
    bankTransfers: [transfer, ...data.bankTransfers],
    bankAccounts: data.bankAccounts.map((a) => {
      if (a.id === input.fromAccountId) return { ...a, balance: a.balance - input.amount };
      if (a.id === input.toAccountId) return { ...a, balance: a.balance + input.amount };
      return a;
    }),
  };
}

export function addCheque(data: AppData, input: ChequeInput): AppData {
  const cheque = {
    id: newId(),
    direction: input.direction,
    chequeNo: input.chequeNo.trim(),
    bankName: input.bankName.trim(),
    partyName: input.partyName.trim(),
    customerId: input.customerId,
    amount: input.amount,
    chequeDate: input.chequeDate,
    postDated: input.postDated,
    status: "pending" as ChequeStatus,
    note: input.note,
  };
  return { ...data, cheques: [cheque, ...data.cheques] };
}

export function updateChequeStatus(
  data: AppData,
  chequeId: string,
  status: ChequeStatus,
  bankAccountId?: string,
): AppData {
  const cheque = data.cheques.find((c) => c.id === chequeId);
  if (!cheque || cheque.status === status) return data;

  let bankAccounts = data.bankAccounts;
  const prev = cheque.status;
  const accountId = bankAccountId ?? cheque.bankAccountId;

  if (status === "cleared" && prev !== "cleared" && accountId) {
    const delta = cheque.direction === "received" ? cheque.amount : -cheque.amount;
    bankAccounts = bankAccounts.map((a) =>
      a.id === accountId ? { ...a, balance: a.balance + delta } : a,
    );
  }

  if (prev === "cleared" && status !== "cleared" && accountId) {
    const delta = cheque.direction === "received" ? -cheque.amount : cheque.amount;
    bankAccounts = bankAccounts.map((a) =>
      a.id === accountId ? { ...a, balance: a.balance + delta } : a,
    );
  }

  return {
    ...data,
    bankAccounts,
    cheques: data.cheques.map((c) =>
      c.id === chequeId
        ? { ...c, status, bankAccountId: accountId ?? c.bankAccountId }
        : c,
    ),
  };
}

function acInstallHintsFromSaleLines(
  data: AppData,
  saleLines: Pick<Sale["lines"][number], "productId" | "productName" | "qty">[],
): Pick<ACJobInput, "brand" | "btu" | "unitType" | "unitCount" | "description"> {
  let unitCount = 0;
  let brand: string | undefined;
  let btu: number | undefined;
  let unitType: string | undefined;
  const names: string[] = [];

  for (const line of saleLines) {
    unitCount += line.qty;
    names.push(line.productName);
    const product = data.products.find((p) => p.id === line.productId);
    if (!product) continue;
    const cf = product.customFields ?? {};
    if (!brand && cf.brand != null && String(cf.brand).trim()) {
      brand = String(cf.brand).trim();
    }
    if (btu == null && cf.btu != null) {
      const n = Number(cf.btu);
      if (Number.isFinite(n) && n > 0) btu = n;
    }
    if (!unitType && cf.unitType != null && String(cf.unitType).trim()) {
      unitType = String(cf.unitType).trim();
    }
  }

  return {
    brand,
    btu,
    unitType,
    unitCount: Math.max(1, unitCount),
    description: names.join(" · ") || "AC unit sale",
  };
}

export function createSale(
  data: AppData,
  lines: { productId: string; qty: number; unitPrice?: number }[],
  paymentMethod: Sale["paymentMethod"],
  options: SaleOptions = {},
): AppData {
  const saleLines = lines
    .map(({ productId, qty, unitPrice }) => {
      const product = data.products.find((p) => p.id === productId);
      if (!product || qty <= 0 || product.stockQty < qty) return null;
      const price =
        unitPrice != null && unitPrice >= 0 ? unitPrice : product.sellPrice;
      return {
        productId,
        productName: product.name,
        qty,
        unitPrice: price,
        buyPrice: product.buyPrice,
      };
    })
    .filter(Boolean) as Sale["lines"];

  if (saleLines.length === 0) return data;

  let working = data;
  let resolvedCustomerId = options.customerId;
  let resolvedName = options.customerName?.trim();
  const buyerPhone = options.buyerPhone?.trim();
  const buyerAddress = options.buyerAddress?.trim();

  if (resolvedCustomerId) {
    const existing = working.customers.find((c) => c.id === resolvedCustomerId);
    if (existing) {
      resolvedName = existing.name;
      if (
        (buyerPhone && buyerPhone !== existing.phone) ||
        (buyerAddress && buyerAddress !== existing.address)
      ) {
        working = updateCustomer(working, existing.id, {
          name: existing.name,
          phone: buyerPhone || existing.phone,
          address: buyerAddress || existing.address,
        });
      }
    }
  } else if (options.addToCustomers && resolvedName) {
    working = addCustomer(working, {
      name: resolvedName,
      phone: buyerPhone,
      address: buyerAddress,
    });
    const created = working.customers[0];
    resolvedCustomerId = created.id;
    resolvedName = created.name;
  }

  const grossInclusive = saleLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discount = Math.min(
    Math.max(0, Math.round((options.discount ?? 0) * 100) / 100),
    grossInclusive,
  );
  const inclusiveTotal = grossInclusive - discount;
  const vatSplit = isVatEnabled(data.business)
    ? splitInclusiveTotal(inclusiveTotal)
    : { subtotal: inclusiveTotal, vat: 0, total: inclusiveTotal };
  const total = vatSplit.total;
  const profit =
    saleLines.reduce((s, l) => s + (l.unitPrice - l.buyPrice) * l.qty, 0) -
    discount;

  const customer = resolvedCustomerId
    ? working.customers.find((c) => c.id === resolvedCustomerId)
    : undefined;

  const customerName =
    customer?.name ?? (resolvedName || undefined);

  if (paymentMethod === "credit" && !customer) return data;

  let cheques = working.cheques;
  let chequeId: string | undefined;
  if (paymentMethod === "cheque") {
    if (!options.chequeNo || !options.chequeBank || !options.chequeDate) {
      return data;
    }
    chequeId = newId();
    cheques = [
      {
        id: chequeId,
        direction: "received",
        chequeNo: options.chequeNo.trim(),
        bankName: options.chequeBank.trim(),
        partyName: customerName ?? "Walk-in customer",
        customerId: resolvedCustomerId,
        amount: total,
        chequeDate: options.chequeDate,
        postDated: options.postDated ?? false,
        status: "pending",
        linkedSaleId: undefined,
        note: "From sale",
      },
      ...cheques,
    ];
  }

  const saleId = newId();
  if (chequeId) {
    cheques = cheques.map((c) =>
      c.id === chequeId ? { ...c, linkedSaleId: saleId } : c,
    );
  }

  const sale: Sale = {
    id: saleId,
    billNo: generateBillNo(data.sales.length),
    date: new Date().toISOString(),
    lines: saleLines,
    subtotal: vatSplit.subtotal,
    outputVat: vatSplit.vat,
    discount: discount > 0 ? discount : undefined,
    total,
    profit,
    paymentMethod,
    customerId: resolvedCustomerId,
    customerName,
    creditAmount: paymentMethod === "credit" ? total : 0,
    chequeId,
  };

  const qtyByProduct = new Map(
    saleLines.map((l) => [l.productId, l.qty] as const),
  );

  const stockLogs: StockLog[] = saleLines.map((line) => ({
    id: newId(),
    productId: line.productId,
    productName: line.productName,
    type: "sale",
    qty: line.qty,
    note: `Bill ${sale.id.slice(0, 8)}`,
    date: sale.date,
  }));

  let customers = working.customers;
  if (paymentMethod === "credit" && resolvedCustomerId) {
    customers = customers.map((c) =>
      c.id === resolvedCustomerId
        ? { ...c, creditBalance: c.creditBalance + total }
        : c,
    );
  }

  let next: AppData = {
    ...working,
    sales: [sale, ...working.sales],
    customers,
    cheques,
    products: working.products.map((p) => {
      const sold = qtyByProduct.get(p.id);
      if (!sold) return p;
      return { ...p, stockQty: Math.max(0, p.stockQty - sold) };
    }),
    stockLogs: [...stockLogs, ...working.stockLogs],
  };

  if (options.createInstallJob && buyerAddress) {
    const hints = acInstallHintsFromSaleLines(working, saleLines);
    const deposit = paymentMethod !== "credit" ? total : 0;
    const status =
      deposit >= total && total > 0 ? "deposit_received" : "quote";
    next = addACJob(next, {
      jobType: "installation",
      customerId: resolvedCustomerId,
      customerName: customerName ?? "Customer",
      phone: buyerPhone || customer?.phone,
      address: buyerAddress,
      brand: hints.brand,
      btu: hints.btu,
      unitType: hints.unitType,
      unitCount: hints.unitCount,
      description: hints.description,
      quotedAmount: total,
      depositAmount: deposit,
      status,
    });
  }

  return next;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function updateBusiness(
  data: AppData,
  business: Partial<BusinessInfo> & Pick<BusinessInfo, "name">,
): AppData {
  const prev = data.business;
  return {
    ...data,
    business: {
      name: business.name.trim() || prev.name || "My Shop",
      nameSi: business.nameSi?.trim() ?? prev.nameSi,
      phone: business.phone?.trim() ?? prev.phone,
      address: business.address?.trim() ?? prev.address,
      tin: business.tin?.trim() ?? prev.tin,
      vatRegistered:
        "vatRegistered" in business
          ? (business.vatRegistered ?? false)
          : (prev.vatRegistered ?? false),
      vatNumber:
        "vatNumber" in business
          ? business.vatNumber?.trim() || undefined
          : prev.vatNumber,
      quarterStartMonth:
        business.quarterStartMonth ?? prev.quarterStartMonth ?? 4,
    },
  };
}

export function getDashboardStats(data: AppData) {
  const today = todayKey();
  const todaySales = data.sales.filter((s) => s.date.startsWith(today));
  const salesTotal = todaySales.reduce((s, sale) => s + sale.total, 0);
  const profitTotal = todaySales.reduce((s, sale) => s + sale.profit, 0);
  const lowStock = data.products.filter(
    (p) => p.reorderLevel != null && p.stockQty <= p.reorderLevel,
  );
  const stockValue = data.products.reduce(
    (s, p) => s + p.buyPrice * p.stockQty,
    0,
  );
  const creditOutstanding = data.customers.reduce(
    (s, c) => s + c.creditBalance,
    0,
  );
  const payableOutstanding = data.suppliers.reduce(
    (s, sup) => s + sup.payableBalance,
    0,
  );
  const bankBalance = data.bankAccounts.reduce((s, a) => s + a.balance, 0);
  const chequesDueSoon = data.cheques.filter(
    (c) =>
      c.status === "pending" &&
      c.direction === "received" &&
      daysUntil(c.chequeDate) >= 0 &&
      daysUntil(c.chequeDate) <= 7,
  );
  const pendingCheques = data.cheques.filter((c) => c.status === "pending");
  const pendingACJobs = data.acJobs.filter((j) =>
    ["quote", "deposit_received", "scheduled"].includes(j.status),
  );
  const serviceDueJobs = data.acJobs.filter((j) => j.status === "service_due");
  const acServiceDueToday = data.acJobs
    .filter(
      (j) =>
        j.serviceDueDate &&
        daysUntil(j.serviceDueDate!) === 0 &&
        j.status !== "cancelled",
    )
    .sort(
      (a, b) =>
        (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""),
    );
  const acServiceDueSoon = data.acJobs
    .filter(
      (j) =>
        j.serviceDueDate &&
        isServiceDueWithinDays(j.serviceDueDate, 7) &&
        !["cancelled", "quote", "deposit_received", "scheduled"].includes(
          j.status,
        ),
    )
    .sort(
      (a, b) =>
        daysUntil(a.serviceDueDate!) - daysUntil(b.serviceDueDate!),
    );
  const acServiceOverdue = data.acJobs.filter(
    (j) =>
      j.serviceDueDate &&
      isServiceOverdue(j.serviceDueDate) &&
      j.status !== "cancelled",
  );
  const forSaleVehicles = data.vehicles.filter((v) => v.status === "for_sale");
  const aging60Vehicles = forSaleVehicles.filter(
    (v) => daysInStock(v.dateAdded) >= 60,
  );
  const soldVehicles = data.vehicles.filter((v) => v.status === "sold");
  const thisMonth = todayKey().slice(0, 7);
  const soldThisMonth = soldVehicles.filter(
    (v) => v.soldDate?.startsWith(thisMonth),
  );
  const vehicleProfitThisMonth = soldThisMonth.reduce((s, v) => {
    const cost = vehicleTotalCost(v.purchasePrice, v.reconditionCost);
    return s + ((v.soldPrice ?? 0) - cost);
  }, 0);

  return {
    todaySales: salesTotal,
    todayProfit: profitTotal,
    saleCount: todaySales.length,
    productCount: data.products.length,
    customerCount: data.customers.length,
    supplierCount: data.suppliers.length,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock,
    stockValue,
    creditOutstanding,
    payableOutstanding,
    bankBalance,
    chequesDueSoonCount: chequesDueSoon.length,
    chequesDueSoon,
    pendingChequeCount: pendingCheques.length,
    topDebtors: [...data.customers]
      .filter((c) => c.creditBalance > 0)
      .sort((a, b) => b.creditBalance - a.creditBalance)
      .slice(0, 5),
    topPayables: [...data.suppliers]
      .filter((s) => s.payableBalance > 0)
      .sort((a, b) => b.payableBalance - a.payableBalance)
      .slice(0, 5),
    recentPurchases: data.purchases.slice(0, 5),
    recentSales: data.sales.slice(0, 5),
    pendingACJobCount: pendingACJobs.length,
    pendingACJobs: pendingACJobs.slice(0, 5),
    serviceDueCount: serviceDueJobs.length,
    serviceDueJobs: serviceDueJobs.slice(0, 5),
    acServiceDueSoonCount: acServiceDueSoon.length,
    acServiceDueSoon: acServiceDueSoon.slice(0, 8),
    acServiceDueTodayCount: acServiceDueToday.length,
    acServiceDueToday: acServiceDueToday.slice(0, 8),
    acServiceOverdueCount: acServiceOverdue.length,
    forSaleVehicleCount: forSaleVehicles.length,
    aging60VehicleCount: aging60Vehicles.length,
    aging60Vehicles: aging60Vehicles.slice(0, 5),
    vehicleProfitThisMonth,
    recentSoldVehicles: soldVehicles.slice(0, 5),
    recentLogs: data.stockLogs.slice(0, 5),
  };
}
