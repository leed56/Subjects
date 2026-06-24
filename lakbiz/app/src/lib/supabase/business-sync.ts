"use client";

import { parseProductCondition } from "@/lib/product-condition";
import { parseContactType } from "@/lib/contact-type";
import type { PaymentMethod, Product, SectorId } from "@/lib/types";
import type { BusinessInfo } from "@/lib/invoice";
import { defaultBusiness } from "@/lib/invoice";
import { emptyAppData } from "@/lib/store/storage";
import type { AppData } from "@/lib/store/types";
import { businessFromOrg, fetchOrgShopSettings } from "./org-settings";
import { createBrowserClient } from "./client";
import {
  hasSyncConflict,
  localHasUnsyncedRecordsFromData,
  mergeAppData,
  mergePullWithLocal,
} from "@/lib/offline/sync-conflict";
import { localDataWatermark } from "./sync-watermark";

export type CloudPushResult = {
  error: string | null;
  stale: boolean;
  generation: number;
};

export async function fetchOrgSyncGeneration(organizationId: string): Promise<number> {
  const supabase = createBrowserClient();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc("get_org_sync_generation", {
    p_org_id: organizationId,
  });
  if (error) {
    console.warn("[sync] get_org_sync_generation:", error.message);
    return 0;
  }
  const n = Number(data);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function advanceOrgSyncGeneration(
  organizationId: string,
  seenGeneration: number,
): Promise<{ ok: boolean; generation: number }> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, generation: seenGeneration };

  const { data, error } = await supabase.rpc("try_advance_org_sync_generation", {
    p_org_id: organizationId,
    p_seen_generation: seenGeneration,
  });
  if (error) {
    if (
      error.message.includes("try_advance_org_sync_generation") ||
      error.message.includes("get_org_sync_generation")
    ) {
      return { ok: true, generation: seenGeneration };
    }
    console.warn("[sync] try_advance_org_sync_generation:", error.message);
    return { ok: false, generation: seenGeneration };
  }

  const n = Number(data);
  if (n === -1) {
    const current = await fetchOrgSyncGeneration(organizationId);
    return { ok: false, generation: current };
  }
  return { ok: true, generation: n };
}

function num(value: number | string | null | undefined, fallback = 0): number {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asPaymentMethod(value: string | null | undefined): PaymentMethod {
  if (
    value === "cash" ||
    value === "bank_transfer" ||
    value === "card" ||
    value === "cheque" ||
    value === "credit"
  ) {
    return value;
  }
  return "cash";
}

function asSectorId(value: string | null | undefined): SectorId {
  const allowed: SectorId[] = [
    "grocery",
    "electronics",
    "electricals",
    "spare_parts",
    "ac_hvac",
    "car_sales",
  ];
  return allowed.includes(value as SectorId) ? (value as SectorId) : "grocery";
}

function customFieldsFromDb(
  raw: Record<string, unknown> | null | undefined,
  unit: string,
): Product["customFields"] {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Product["customFields"])
      : {};
  return { ...base, unit };
}

function rowsOrEmpty<T>(
  res: { data: T[] | null; error: { message: string } | null },
  label: string,
): T[] {
  if (res.error) {
    console.warn(`[pullBusinessData] ${label}:`, res.error.message);
    return [];
  }
  return res.data ?? [];
}

export function isEmptyBusinessData(data: AppData): boolean {
  return (
    data.products.length === 0 &&
    data.sales.length === 0 &&
    data.customers.length === 0 &&
    data.suppliers.length === 0 &&
    data.purchases.length === 0 &&
    data.customerPayments.length === 0 &&
    data.customerProductPrices.length === 0 &&
    data.supplierPayments.length === 0 &&
    data.stockLogs.length === 0 &&
    data.bankAccounts.length === 0 &&
    data.bankTransactions.length === 0 &&
    data.bankTransfers.length === 0 &&
    data.cheques.length === 0 &&
    data.acJobs.length === 0 &&
    data.jobItems.length === 0 &&
    data.jobStatusHistory.length === 0 &&
    data.technicians.length === 0 &&
    data.contractors.length === 0 &&
    data.contractorPayments.length === 0 &&
    data.vehicles.length === 0
  );
}

export async function pullBusinessData(
  organizationId: string,
  localBusiness: BusinessInfo,
): Promise<AppData | null> {
  const supabase = createBrowserClient();
  if (!supabase) return null;

  const [
    productsRes,
    customersRes,
    suppliersRes,
    salesRes,
    saleLinesRes,
    purchasesRes,
    purchaseLinesRes,
    customerPaymentsRes,
    customerProductPricesRes,
    supplierPaymentsRes,
    stockLogsRes,
    bankAccountsRes,
    bankTransactionsRes,
    bankTransfersRes,
    chequesRes,
    acJobsRes,
    jobItemsRes,
    jobStatusHistoryRes,
    techniciansRes,
    contractorsRes,
    contractorPaymentsRes,
    vehiclesRes,
    business,
  ] = await Promise.all([
    supabase.from("products").select("*").eq("organization_id", organizationId),
    supabase.from("customers").select("*").eq("organization_id", organizationId),
    supabase.from("suppliers").select("*").eq("organization_id", organizationId),
    supabase.from("sales").select("*").eq("organization_id", organizationId),
    supabase.from("sale_lines").select("*").eq("organization_id", organizationId),
    supabase.from("purchases").select("*").eq("organization_id", organizationId),
    supabase
      .from("purchase_lines")
      .select("*")
      .eq("organization_id", organizationId),
    supabase
      .from("customer_payments")
      .select("*")
      .eq("organization_id", organizationId),
    supabase
      .from("customer_product_prices")
      .select("*")
      .eq("organization_id", organizationId),
    supabase
      .from("supplier_payments")
      .select("*")
      .eq("organization_id", organizationId),
    supabase.from("stock_logs").select("*").eq("organization_id", organizationId),
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("organization_id", organizationId),
    supabase
      .from("bank_transactions")
      .select("*")
      .eq("organization_id", organizationId),
    supabase
      .from("bank_transfers")
      .select("*")
      .eq("organization_id", organizationId),
    supabase.from("cheques").select("*").eq("organization_id", organizationId),
    supabase.from("ac_jobs").select("*").eq("organization_id", organizationId),
    supabase.from("job_items").select("*").eq("organization_id", organizationId),
    supabase
      .from("job_status_history")
      .select("*")
      .eq("organization_id", organizationId),
    supabase.from("technicians").select("*").eq("organization_id", organizationId),
    supabase.from("contractors").select("*").eq("organization_id", organizationId),
    supabase
      .from("contractor_payments")
      .select("*")
      .eq("organization_id", organizationId),
    supabase.from("vehicles").select("*").eq("organization_id", organizationId),
    fetchOrgShopSettings(organizationId),
  ]);

  if (productsRes.error || customersRes.error || salesRes.error) {
    return null;
  }

  const saleLines = rowsOrEmpty(saleLinesRes, "sale_lines");
  const purchaseLines = rowsOrEmpty(purchaseLinesRes, "purchase_lines");
  const suppliers = rowsOrEmpty(suppliersRes, "suppliers");
  const purchases = rowsOrEmpty(purchasesRes, "purchases");
  const customerPayments = rowsOrEmpty(customerPaymentsRes, "customer_payments");
  const customerProductPrices = rowsOrEmpty(
    customerProductPricesRes,
    "customer_product_prices",
  );
  const supplierPayments = rowsOrEmpty(supplierPaymentsRes, "supplier_payments");
  const stockLogs = rowsOrEmpty(stockLogsRes, "stock_logs");
  const bankAccounts = rowsOrEmpty(bankAccountsRes, "bank_accounts");
  const bankTransactions = rowsOrEmpty(bankTransactionsRes, "bank_transactions");
  const bankTransfers = rowsOrEmpty(bankTransfersRes, "bank_transfers");
  const cheques = rowsOrEmpty(chequesRes, "cheques");
  const acJobs = rowsOrEmpty(acJobsRes, "ac_jobs");
  const jobItems = rowsOrEmpty(jobItemsRes, "job_items");
  const jobStatusHistory = rowsOrEmpty(jobStatusHistoryRes, "job_status_history");
  const technicians = rowsOrEmpty(techniciansRes, "technicians");
  const contractors = rowsOrEmpty(contractorsRes, "contractors");
  const contractorPayments = rowsOrEmpty(contractorPaymentsRes, "contractor_payments");
  const vehicles = rowsOrEmpty(vehiclesRes, "vehicles");

  const saleLinesBySale = new Map<string, typeof saleLines>();
  for (const line of saleLines) {
    const list = saleLinesBySale.get(line.sale_id) ?? [];
    list.push(line);
    saleLinesBySale.set(line.sale_id, list);
  }

  const purchaseLinesByPurchase = new Map<string, typeof purchaseLines>();
  for (const line of purchaseLines) {
    const list = purchaseLinesByPurchase.get(line.purchase_id) ?? [];
    list.push(line);
    purchaseLinesByPurchase.set(line.purchase_id, list);
  }

  const data: AppData = {
    business: business ?? localBusiness ?? defaultBusiness(),
    products: (productsRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku ?? undefined,
      category: row.category,
      sectorId: asSectorId(row.sector_id),
      condition: parseProductCondition(row.condition),
      buyPrice: num(row.buy_price),
      sellPrice: num(row.sell_price),
      stockQty: num(row.stock_qty),
      reorderLevel: row.reorder_level != null ? num(row.reorder_level) : undefined,
      customFields: customFieldsFromDb(
        row.custom_fields as Record<string, unknown>,
        row.unit,
      ),
    })),
    customers: (customersRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      contactType: parseContactType(row.contact_type),
      contactPerson: row.contact_person ?? undefined,
      vatNumber: row.vat_number ?? undefined,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      creditBalance: num(row.credit_balance),
      creditLimit: row.credit_limit != null ? num(row.credit_limit) : undefined,
    })),
    suppliers: suppliers.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      vatNumber: row.vat_number ?? undefined,
      contactPerson: row.contact_person ?? undefined,
      payableBalance: num(row.payable_balance),
    })),
    sales: (salesRes.data ?? []).map((row) => {
      const lines = (saleLinesBySale.get(row.id) ?? [])
        .sort((a, b) => a.line_order - b.line_order)
        .map((line) => ({
          productId: line.product_id ?? "",
          productName: line.product_name,
          qty: num(line.qty),
          unitPrice: num(line.unit_price),
          buyPrice: num(line.buy_price),
        }));

      return {
        id: row.id,
        billNo: row.bill_no ?? undefined,
        date: row.sale_date,
        lines,
        subtotal: row.subtotal != null ? num(row.subtotal) : undefined,
        outputVat: row.output_vat != null ? num(row.output_vat) : undefined,
        discount: row.discount != null ? num(row.discount) : undefined,
        total: num(row.total),
        profit: num(row.profit),
        paymentMethod: asPaymentMethod(row.payment_method),
        customerId: row.customer_id ?? undefined,
        customerName: row.customer_name ?? undefined,
        creditAmount: num(row.credit_amount),
        chequeId: row.cheque_id ?? undefined,
      };
    }),
    purchases: purchases.map((row) => {
      const lines = (purchaseLinesByPurchase.get(row.id) ?? [])
        .sort((a, b) => a.line_order - b.line_order)
        .map((line) => ({
          productId: line.product_id ?? "",
          productName: line.product_name,
          qty: num(line.qty),
          unitCost: num(line.unit_cost),
        }));

      return {
        id: row.id,
        grnNo: row.grn_no,
        date: row.purchase_date,
        supplierId: row.supplier_id ?? "",
        supplierName: row.supplier_name,
        lines,
        subtotal: row.subtotal != null ? num(row.subtotal) : undefined,
        inputVat: row.input_vat != null ? num(row.input_vat) : undefined,
        total: num(row.total),
        paymentMethod: asPaymentMethod(row.payment_method),
        creditAmount: num(row.credit_amount),
        note: row.note ?? undefined,
      };
    }),
    customerPayments: customerPayments.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      amount: num(row.amount),
      date: row.payment_date,
      method: asPaymentMethod(row.method),
      note: row.note ?? undefined,
    })),
    customerProductPrices: customerProductPrices.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      productId: row.product_id,
      price: num(row.price),
    })),
    supplierPayments: supplierPayments.map((row) => ({
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      amount: num(row.amount),
      date: row.payment_date,
      method: asPaymentMethod(row.method),
      note: row.note ?? undefined,
    })),
    stockLogs: stockLogs.map((row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      type: row.log_type as "in" | "out" | "sale",
      qty: num(row.qty),
      note: row.note ?? undefined,
      date: row.log_date,
    })),
    bankAccounts: bankAccounts.map((row) => ({
      id: row.id,
      bankName: row.bank_name,
      branch: row.branch ?? undefined,
      accountName: row.account_name,
      accountNumber: row.account_number,
      balance: num(row.balance),
    })),
    bankTransactions: bankTransactions.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      type: row.type as AppData["bankTransactions"][number]["type"],
      amount: num(row.amount),
      description: row.description ?? undefined,
      reference: row.reference ?? undefined,
      date: row.txn_date,
    })),
    bankTransfers: bankTransfers.map((row) => ({
      id: row.id,
      fromAccountId: row.from_account_id,
      toAccountId: row.to_account_id,
      amount: num(row.amount),
      description: row.description ?? undefined,
      date: row.transfer_date,
    })),
    cheques: cheques.map((row) => ({
      id: row.id,
      direction: row.direction as "received" | "paid",
      chequeNo: row.cheque_no,
      bankName: row.bank_name,
      partyName: row.party_name,
      customerId: row.customer_id ?? undefined,
      amount: num(row.amount),
      chequeDate: row.cheque_date,
      postDated: row.post_dated,
      status: row.status as AppData["cheques"][number]["status"],
      linkedSaleId: row.linked_sale_id ?? undefined,
      bankAccountId: row.bank_account_id ?? undefined,
      note: row.note ?? undefined,
    })),
    acJobs: acJobs.map((row) => ({
      id: row.id,
      jobNo: row.job_no,
      date: row.job_date,
      customerId: row.customer_id ?? undefined,
      customerName: row.customer_name,
      phone: row.phone ?? undefined,
      address: row.address,
      brand: row.brand ?? undefined,
      btu: row.btu ?? undefined,
      unitType: row.unit_type ?? undefined,
      unitCount: row.unit_count,
      description: row.description,
      quotedAmount: num(row.quoted_amount),
      depositAmount: num(row.deposit_amount),
      pipeMeters: row.pipe_meters != null ? num(row.pipe_meters) : undefined,
      status: row.status as AppData["acJobs"][number]["status"],
      scheduledDate: row.scheduled_date ?? undefined,
      installedDate: row.installed_date ?? undefined,
      serviceDueDate: row.service_due_date ?? undefined,
      serviceDueManual: row.service_due_manual ?? false,
      lastServiceDate: row.last_service_date ?? undefined,
      serviceIntervalMonths: row.service_interval_months ?? undefined,
      serviceIntervalDays: row.service_interval_days ?? undefined,
      amcContract: row.amc_contract ?? undefined,
      jobType: (row.job_type as AppData["acJobs"][number]["jobType"]) ?? "installation",
      assignedTechnician: row.assigned_technician ?? undefined,
      assigneeType:
        (row.assignee_type as AppData["acJobs"][number]["assigneeType"]) ?? undefined,
      assigneeId: row.assignee_id ?? undefined,
      subcontractCost:
        row.subcontract_cost != null ? num(row.subcontract_cost) : undefined,
      notes: row.notes ?? undefined,
    })),
    jobItems: jobItems.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      itemType: row.item_type as AppData["jobItems"][number]["itemType"],
      name: row.name,
      qty: num(row.qty),
      unitPrice: num(row.unit_price),
      lineTotal: num(row.line_total),
    })),
    jobStatusHistory: jobStatusHistory.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      oldStatus: row.old_status ?? undefined,
      newStatus: row.new_status,
      note: row.note ?? undefined,
      date: row.created_at,
    })),
    technicians: technicians.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone ?? undefined,
      specialties: Array.isArray(row.specialties)
        ? (row.specialties as AppData["technicians"][number]["specialties"])
        : [],
      active: row.active ?? true,
      notes: row.notes ?? undefined,
    })),
    contractors: contractors.map((row) => ({
      id: row.id,
      name: row.name,
      company: row.company ?? undefined,
      phone: row.phone ?? undefined,
      specialties: Array.isArray(row.specialties)
        ? (row.specialties as AppData["contractors"][number]["specialties"])
        : [],
      rateType:
        (row.rate_type as AppData["contractors"][number]["rateType"]) ?? "per_job",
      rateAmount: num(row.rate_amount),
      payableBalance: num(row.payable_balance),
      active: row.active ?? true,
      notes: row.notes ?? undefined,
    })),
    contractorPayments: contractorPayments.map((row) => ({
      id: row.id,
      contractorId: row.contractor_id,
      contractorName: row.contractor_name ?? "",
      amount: num(row.amount),
      date: row.payment_date,
      method: asPaymentMethod(row.method),
      note: row.note ?? undefined,
    })),
    vehicles: vehicles.map((row) => ({
      id: row.id,
      stockId: row.stock_id,
      dateAdded: row.date_added,
      make: row.make,
      model: row.model,
      year: row.year,
      chassisNo: row.chassis_no,
      engineNo: row.engine_no ?? undefined,
      regNo: row.reg_no ?? undefined,
      color: row.color ?? undefined,
      fuel: row.fuel as AppData["vehicles"][number]["fuel"],
      transmission: row.transmission as AppData["vehicles"][number]["transmission"],
      mileageKm: row.mileage_km,
      condition: row.condition,
      purchasePrice: num(row.purchase_price),
      reconditionCost: num(row.recondition_cost),
      askPrice: num(row.ask_price),
      minPrice: row.min_price != null ? num(row.min_price) : undefined,
      status: row.status as AppData["vehicles"][number]["status"],
      customerId: row.customer_id ?? undefined,
      customerName: row.customer_name ?? undefined,
      soldPrice: row.sold_price != null ? num(row.sold_price) : undefined,
      soldDate: row.sold_date ?? undefined,
      financePartner: row.finance_partner ?? undefined,
      paymentMethod: row.payment_method
        ? asPaymentMethod(row.payment_method)
        : undefined,
      notes: row.notes ?? undefined,
    })),
  };

  if (!business) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select(
        "name, phone, address, tin, vat_registered, vat_number, quarter_start_month",
      )
      .eq("id", organizationId)
      .maybeSingle();
    if (orgRow) {
      data.business = businessFromOrg(orgRow);
    }
  }

  return data;
}

async function upsertOrgRows(
  table:
    | "products"
    | "products_base"
    | "customers"
    | "suppliers"
    | "sales"
    | "sales_base"
    | "purchases"
    | "customer_payments"
    | "customer_product_prices"
    | "supplier_payments"
    | "stock_logs"
    | "bank_accounts"
    | "bank_transactions"
    | "bank_transfers"
    | "cheques"
    | "ac_jobs"
    | "job_items"
    | "job_status_history"
    | "technicians"
    | "contractors"
    | "contractor_payments"
    | "vehicles"
    | "sale_lines"
    | "purchase_lines",
  rows: Record<string, unknown>[],
): Promise<string | null> {
  if (rows.length === 0) return null;
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  return error?.message ?? null;
}

function customerRowsForOrg(
  organizationId: string,
  customers: AppData["customers"],
): Record<string, unknown>[] {
  return customers.map((c) => ({
    id: c.id,
    organization_id: organizationId,
    name: c.name,
    contact_type: c.contactType,
    contact_person: c.contactPerson ?? null,
    vat_number: c.vatNumber ?? null,
    phone: c.phone ?? null,
    address: c.address ?? null,
    credit_balance: c.creditBalance,
    credit_limit: c.creditLimit ?? null,
  }));
}

/** Upsert customers only — used for immediate save-to-cloud on the Customers screen. */
export async function pushCustomersToCloud(
  organizationId: string,
  customers: AppData["customers"],
): Promise<string | null> {
  return upsertOrgRows("customers", customerRowsForOrg(organizationId, customers));
}

/** Upsert customers and mirror deletions (single-staff shops only). */
export async function syncCustomersSnapshot(
  organizationId: string,
  customers: AppData["customers"],
): Promise<string | null> {
  const upsertErr = await pushCustomersToCloud(organizationId, customers);
  if (upsertErr) return upsertErr;

  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { count: memberCount } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if ((memberCount ?? 0) > 1) return null;

  return deleteOrgRowsNotIn(
    "customers",
    organizationId,
    customers.map((c) => c.id),
  );
}

/** Upsert via masked views (INSTEAD OF triggers write to *_base). */
async function upsertMaskedViewRows(
  table: "sales" | "products",
  _organizationId: string,
  rows: Record<string, unknown>[],
): Promise<string | null> {
  return upsertOrgRows(table, rows);
}

async function deleteOrgRowsNotIn(
  table:
    | "products"
    | "products_base"
    | "customers"
    | "suppliers"
    | "sales"
    | "sales_base"
    | "purchases"
    | "customer_payments"
    | "customer_product_prices"
    | "supplier_payments"
    | "stock_logs"
    | "bank_accounts"
    | "bank_transactions"
    | "bank_transfers"
    | "cheques"
    | "ac_jobs"
    | "job_items"
    | "job_status_history"
    | "technicians"
    | "contractors"
    | "contractor_payments"
    | "vehicles",
  organizationId: string,
  keepIds: string[],
): Promise<string | null> {
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { data: rows, error: fetchError } = await supabase
    .from(table)
    .select("id")
    .eq("organization_id", organizationId);

  if (fetchError) return fetchError.message;

  const keep = new Set(keepIds);
  const toDelete = (rows ?? []).map((row) => row.id).filter((id) => !keep.has(id));
  if (toDelete.length === 0) return null;

  const batchSize = 50;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const { error } = await supabase.from(table).delete().in("id", batch);
    if (error) return error.message;
  }

  return null;
}

async function latestTimestamp(
  supabase: NonNullable<ReturnType<typeof createBrowserClient>>,
  table: string,
  organizationId: string,
  column: string,
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq("organization_id", organizationId)
    .order(column, { ascending: false })
    .limit(1);

  if (error || !data?.[0]) return 0;
  const row = data[0] as unknown as Record<string, string | null | undefined>;
  const value = row[column];
  return value ? Date.parse(value) || 0 : 0;
}

async function fetchCloudWatermark(organizationId: string): Promise<number> {
  const supabase = createBrowserClient();
  if (!supabase) return 0;

  const stamps = await Promise.all([
    latestTimestamp(supabase, "products", organizationId, "updated_at"),
    latestTimestamp(supabase, "customers", organizationId, "updated_at"),
    latestTimestamp(supabase, "suppliers", organizationId, "updated_at"),
    latestTimestamp(supabase, "bank_accounts", organizationId, "updated_at"),
    latestTimestamp(supabase, "bank_transactions", organizationId, "updated_at"),
    latestTimestamp(supabase, "bank_transfers", organizationId, "updated_at"),
    latestTimestamp(supabase, "cheques", organizationId, "updated_at"),
    latestTimestamp(supabase, "ac_jobs", organizationId, "updated_at"),
    latestTimestamp(supabase, "job_items", organizationId, "updated_at"),
    latestTimestamp(supabase, "job_status_history", organizationId, "updated_at"),
    latestTimestamp(supabase, "technicians", organizationId, "updated_at"),
    latestTimestamp(supabase, "contractors", organizationId, "updated_at"),
    latestTimestamp(supabase, "contractor_payments", organizationId, "updated_at"),
    latestTimestamp(supabase, "vehicles", organizationId, "updated_at"),
    latestTimestamp(supabase, "sales", organizationId, "sale_date"),
    latestTimestamp(supabase, "purchases", organizationId, "purchase_date"),
    latestTimestamp(supabase, "customer_payments", organizationId, "payment_date"),
    latestTimestamp(supabase, "customer_product_prices", organizationId, "updated_at"),
    latestTimestamp(supabase, "supplier_payments", organizationId, "payment_date"),
    latestTimestamp(supabase, "stock_logs", organizationId, "log_date"),
  ]);

  return Math.max(0, ...stamps);
}

async function replaceSaleLines(
  organizationId: string,
  saleId: string,
  rows: Record<string, unknown>[],
): Promise<string | null> {
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { error: delErr } = await supabase
    .from("sale_lines")
    .delete()
    .eq("organization_id", organizationId)
    .eq("sale_id", saleId);
  if (delErr) return delErr.message;

  if (rows.length === 0) return null;
  const { error: insErr } = await supabase.from("sale_lines").insert(rows);
  return insErr?.message ?? null;
}

async function replacePurchaseLines(
  organizationId: string,
  purchaseId: string,
  rows: Record<string, unknown>[],
): Promise<string | null> {
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { error: delErr } = await supabase
    .from("purchase_lines")
    .delete()
    .eq("organization_id", organizationId)
    .eq("purchase_id", purchaseId);
  if (delErr) return delErr.message;

  if (rows.length === 0) return null;
  const { error: insErr } = await supabase.from("purchase_lines").insert(rows);
  return insErr?.message ?? null;
}

export async function pushBusinessData(
  organizationId: string,
  data: AppData,
  options?: { preserveBuyPrices?: boolean; seenGeneration?: number },
): Promise<CloudPushResult> {
  const seenGeneration =
    options?.seenGeneration ?? (await fetchOrgSyncGeneration(organizationId));
  // When preserveBuyPrices is set, callers lack financial SELECT; *_base triggers keep cloud buy_price on update.
  const products = data.products;

  const productRows = products.map((p) => ({
    id: p.id,
    organization_id: organizationId,
    name: p.name,
    sku: p.sku ?? null,
    category: p.category,
    sector_id: p.sectorId,
    condition: parseProductCondition(p.condition),
    buy_price: p.buyPrice,
    sell_price: p.sellPrice,
    stock_qty: p.stockQty,
    reorder_level: p.reorderLevel ?? null,
    unit: (p.customFields.unit as string) || "pcs",
    custom_fields: p.customFields,
  }));

  const customerRows = customerRowsForOrg(organizationId, data.customers);

  const supplierRows = data.suppliers.map((s) => ({
    id: s.id,
    organization_id: organizationId,
    name: s.name,
    phone: s.phone ?? null,
    address: s.address ?? null,
    vat_number: s.vatNumber ?? null,
    contact_person: s.contactPerson ?? null,
    payable_balance: s.payableBalance,
  }));

  const bankRows = data.bankAccounts.map((b) => ({
    id: b.id,
    organization_id: organizationId,
    bank_name: b.bankName,
    branch: b.branch ?? null,
    account_name: b.accountName,
    account_number: b.accountNumber,
    balance: b.balance,
  }));

  const saleRows = data.sales.map((s) => ({
    id: s.id,
    organization_id: organizationId,
    bill_no: s.billNo ?? null,
    sale_date: s.date,
    subtotal: s.subtotal ?? null,
    output_vat: s.outputVat ?? null,
    discount: s.discount ?? 0,
    total: s.total,
    profit: s.profit,
    payment_method: s.paymentMethod,
    customer_id: s.customerId ?? null,
    customer_name: s.customerName ?? null,
    credit_amount: s.creditAmount,
    cheque_id: s.chequeId ?? null,
  }));

  const saleLineRows = data.sales.flatMap((sale) =>
    sale.lines.map((line, index) => ({
      organization_id: organizationId,
      sale_id: sale.id,
      product_id: line.productId || null,
      product_name: line.productName,
      qty: line.qty,
      unit_price: line.unitPrice,
      buy_price: line.buyPrice,
      line_order: index,
    })),
  );

  const purchaseRows = data.purchases.map((p) => ({
    id: p.id,
    organization_id: organizationId,
    grn_no: p.grnNo,
    purchase_date: p.date,
    supplier_id: p.supplierId || null,
    supplier_name: p.supplierName,
    subtotal: p.subtotal ?? null,
    input_vat: p.inputVat ?? null,
    total: p.total,
    payment_method: p.paymentMethod,
    credit_amount: p.creditAmount,
    note: p.note ?? null,
  }));

  const purchaseLineRows = data.purchases.flatMap((purchase) =>
    purchase.lines.map((line, index) => ({
      organization_id: organizationId,
      purchase_id: purchase.id,
      product_id: line.productId || null,
      product_name: line.productName,
      qty: line.qty,
      unit_cost: line.unitCost,
      line_order: index,
    })),
  );

  const customerPaymentRows = data.customerPayments.map((p) => ({
    id: p.id,
    organization_id: organizationId,
    customer_id: p.customerId,
    customer_name: p.customerName,
    amount: p.amount,
    payment_date: p.date,
    method: p.method,
    note: p.note ?? null,
  }));

  const customerProductPriceRows = data.customerProductPrices.map((p) => ({
    id: p.id,
    organization_id: organizationId,
    customer_id: p.customerId,
    product_id: p.productId,
    price: p.price,
  }));

  const supplierPaymentRows = data.supplierPayments.map((p) => ({
    id: p.id,
    organization_id: organizationId,
    supplier_id: p.supplierId,
    supplier_name: p.supplierName,
    amount: p.amount,
    payment_date: p.date,
    method: p.method,
    note: p.note ?? null,
  }));

  const stockLogRows = data.stockLogs.map((log) => ({
    id: log.id,
    organization_id: organizationId,
    product_id: log.productId,
    product_name: log.productName,
    log_type: log.type,
    qty: log.qty,
    note: log.note ?? null,
    log_date: log.date,
  }));

  const bankTransactionRows = data.bankTransactions.map((tx) => ({
    id: tx.id,
    organization_id: organizationId,
    account_id: tx.accountId,
    type: tx.type,
    amount: tx.amount,
    description: tx.description ?? null,
    reference: tx.reference ?? null,
    txn_date: tx.date,
  }));

  const bankTransferRows = data.bankTransfers.map((tr) => ({
    id: tr.id,
    organization_id: organizationId,
    from_account_id: tr.fromAccountId,
    to_account_id: tr.toAccountId,
    amount: tr.amount,
    description: tr.description ?? null,
    transfer_date: tr.date,
  }));

  const chequeRows = data.cheques.map((c) => ({
    id: c.id,
    organization_id: organizationId,
    direction: c.direction,
    cheque_no: c.chequeNo,
    bank_name: c.bankName,
    party_name: c.partyName,
    customer_id: c.customerId ?? null,
    amount: c.amount,
    cheque_date: c.chequeDate,
    post_dated: c.postDated,
    status: c.status,
    linked_sale_id: c.linkedSaleId ?? null,
    bank_account_id: c.bankAccountId ?? null,
    note: c.note ?? null,
  }));

  const acJobRows = data.acJobs.map((job) => ({
    id: job.id,
    organization_id: organizationId,
    job_no: job.jobNo,
    job_date: job.date,
    customer_id: job.customerId ?? null,
    customer_name: job.customerName,
    phone: job.phone ?? null,
    address: job.address,
    brand: job.brand ?? null,
    btu: job.btu ?? null,
    unit_type: job.unitType ?? null,
    unit_count: job.unitCount,
    description: job.description,
    quoted_amount: job.quotedAmount,
    deposit_amount: job.depositAmount,
    pipe_meters: job.pipeMeters ?? null,
    status: job.status,
    scheduled_date: job.scheduledDate ?? null,
    installed_date: job.installedDate ?? null,
    service_due_date: job.serviceDueDate ?? null,
    service_due_manual: job.serviceDueManual ?? false,
    last_service_date: job.lastServiceDate ?? null,
    service_interval_months: job.serviceIntervalMonths ?? null,
    service_interval_days: job.serviceIntervalDays ?? null,
    amc_contract: job.amcContract ?? null,
    job_type: job.jobType ?? "installation",
    assigned_technician: job.assignedTechnician ?? null,
    assignee_type: job.assigneeType ?? null,
    assignee_id: job.assigneeId ?? null,
    subcontract_cost: job.subcontractCost ?? null,
    notes: job.notes ?? null,
  }));

  const jobItemRows = data.jobItems.map((i) => ({
    id: i.id,
    organization_id: organizationId,
    job_id: i.jobId,
    item_type: i.itemType,
    name: i.name,
    qty: i.qty,
    unit_price: i.unitPrice,
    line_total: i.lineTotal,
  }));

  const jobStatusHistoryRows = data.jobStatusHistory.map((h) => ({
    id: h.id,
    organization_id: organizationId,
    job_id: h.jobId,
    old_status: h.oldStatus ?? null,
    new_status: h.newStatus,
    note: h.note ?? null,
    created_at: h.date,
  }));

  const technicianRows = data.technicians.map((tch) => ({
    id: tch.id,
    organization_id: organizationId,
    name: tch.name,
    phone: tch.phone ?? null,
    specialties: tch.specialties,
    active: tch.active,
    notes: tch.notes ?? null,
  }));

  const contractorRows = data.contractors.map((c) => ({
    id: c.id,
    organization_id: organizationId,
    name: c.name,
    company: c.company ?? null,
    phone: c.phone ?? null,
    specialties: c.specialties,
    rate_type: c.rateType,
    rate_amount: c.rateAmount,
    payable_balance: c.payableBalance,
    active: c.active,
    notes: c.notes ?? null,
  }));

  const contractorPaymentRows = data.contractorPayments.map((p) => ({
    id: p.id,
    organization_id: organizationId,
    contractor_id: p.contractorId,
    contractor_name: p.contractorName,
    amount: p.amount,
    payment_date: p.date,
    method: p.method,
    note: p.note ?? null,
  }));

  const vehicleRows = data.vehicles.map((v) => ({
    id: v.id,
    organization_id: organizationId,
    stock_id: v.stockId,
    date_added: v.dateAdded,
    make: v.make,
    model: v.model,
    year: v.year,
    chassis_no: v.chassisNo,
    engine_no: v.engineNo ?? null,
    reg_no: v.regNo ?? null,
    color: v.color ?? null,
    fuel: v.fuel,
    transmission: v.transmission,
    mileage_km: v.mileageKm,
    condition: v.condition,
    purchase_price: v.purchasePrice,
    recondition_cost: v.reconditionCost,
    ask_price: v.askPrice,
    min_price: v.minPrice ?? null,
    status: v.status,
    customer_id: v.customerId ?? null,
    customer_name: v.customerName ?? null,
    sold_price: v.soldPrice ?? null,
    sold_date: v.soldDate ?? null,
    finance_partner: v.financePartner ?? null,
    payment_method: v.paymentMethod ?? null,
    notes: v.notes ?? null,
  }));

  const upsertSteps: Array<{
    table:
      | "products"
      | "products_base"
      | "customers"
      | "suppliers"
      | "bank_accounts"
      | "sales"
      | "sales_base"
      | "purchases"
      | "customer_payments"
      | "customer_product_prices"
      | "supplier_payments"
      | "stock_logs"
      | "bank_transactions"
      | "bank_transfers"
      | "cheques"
      | "ac_jobs"
      | "job_items"
      | "job_status_history"
      | "technicians"
      | "contractors"
      | "contractor_payments"
      | "vehicles";
    rows: Record<string, unknown>[];
  }> = [
    { table: "customers", rows: customerRows },
    { table: "suppliers", rows: supplierRows },
    { table: "bank_accounts", rows: bankRows },
    { table: "bank_transactions", rows: bankTransactionRows },
    { table: "bank_transfers", rows: bankTransferRows },
    { table: "customer_payments", rows: customerPaymentRows },
    { table: "customer_product_prices", rows: customerProductPriceRows },
    { table: "supplier_payments", rows: supplierPaymentRows },
    { table: "stock_logs", rows: stockLogRows },
    { table: "cheques", rows: chequeRows },
    { table: "ac_jobs", rows: acJobRows },
    { table: "job_items", rows: jobItemRows },
    { table: "job_status_history", rows: jobStatusHistoryRows },
    { table: "technicians", rows: technicianRows },
    { table: "contractors", rows: contractorRows },
    { table: "contractor_payments", rows: contractorPaymentRows },
    { table: "vehicles", rows: vehicleRows },
    { table: "products", rows: productRows },
    { table: "sales", rows: saleRows },
    { table: "purchases", rows: purchaseRows },
  ];

  for (const step of upsertSteps) {
    const err =
      step.table === "sales" || step.table === "products"
        ? await upsertMaskedViewRows(step.table, organizationId, step.rows)
        : await upsertOrgRows(step.table, step.rows);
    if (err) return { error: err, stale: false, generation: seenGeneration };
  }

  for (const sale of data.sales) {
    const lines = saleLineRows.filter((row) => row.sale_id === sale.id);
    const err = await replaceSaleLines(organizationId, sale.id, lines);
    if (err) return { error: err, stale: false, generation: seenGeneration };
  }

  for (const purchase of data.purchases) {
    const lines = purchaseLineRows.filter((row) => row.purchase_id === purchase.id);
    const err = await replacePurchaseLines(organizationId, purchase.id, lines);
    if (err) return { error: err, stale: false, generation: seenGeneration };
  }

  const supabase = createBrowserClient();
  if (!supabase) {
    return { error: "Supabase not configured", stale: false, generation: seenGeneration };
  }
  const { count: memberCount } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  // Multi-staff shops: skip prune so one device cannot delete another user's rows.
  if ((memberCount ?? 0) > 1) {
    const advanced = await advanceOrgSyncGeneration(organizationId, seenGeneration);
    if (!advanced.ok) {
      return { error: null, stale: true, generation: advanced.generation };
    }
    return { error: null, stale: false, generation: advanced.generation };
  }

  const pruneSteps: Array<{
    table:
      | "sales"
      | "purchases"
      | "customer_payments"
      | "customer_product_prices"
      | "supplier_payments"
      | "stock_logs"
      | "cheques"
      | "ac_jobs"
      | "vehicles"
      | "products"
      | "customers"
      | "suppliers"
      | "bank_accounts"
      | "bank_transactions"
      | "bank_transfers"
      | "technicians"
      | "contractors"
      | "contractor_payments"
      | "job_items"
      | "job_status_history";
    ids: string[];
  }> = [
    { table: "sales", ids: data.sales.map((s) => s.id) },
    { table: "purchases", ids: data.purchases.map((p) => p.id) },
    { table: "customer_payments", ids: data.customerPayments.map((p) => p.id) },
    {
      table: "customer_product_prices",
      ids: data.customerProductPrices.map((p) => p.id),
    },
    { table: "supplier_payments", ids: data.supplierPayments.map((p) => p.id) },
    { table: "stock_logs", ids: data.stockLogs.map((l) => l.id) },
    { table: "bank_transactions", ids: data.bankTransactions.map((t) => t.id) },
    { table: "bank_transfers", ids: data.bankTransfers.map((t) => t.id) },
    { table: "cheques", ids: data.cheques.map((c) => c.id) },
    { table: "ac_jobs", ids: data.acJobs.map((j) => j.id) },
    { table: "job_items", ids: data.jobItems.map((i) => i.id) },
    { table: "job_status_history", ids: data.jobStatusHistory.map((h) => h.id) },
    { table: "technicians", ids: data.technicians.map((tch) => tch.id) },
    { table: "contractors", ids: data.contractors.map((c) => c.id) },
    { table: "contractor_payments", ids: data.contractorPayments.map((p) => p.id) },
    { table: "vehicles", ids: data.vehicles.map((v) => v.id) },
    { table: "products", ids: data.products.map((p) => p.id) },
    { table: "customers", ids: data.customers.map((c) => c.id) },
    { table: "suppliers", ids: data.suppliers.map((s) => s.id) },
    { table: "bank_accounts", ids: data.bankAccounts.map((b) => b.id) },
  ];

  for (const step of pruneSteps) {
    const err = await deleteOrgRowsNotIn(step.table, organizationId, step.ids);
    if (err) return { error: err, stale: false, generation: seenGeneration };
  }

  const advanced = await advanceOrgSyncGeneration(organizationId, seenGeneration);
  if (!advanced.ok) {
    return { error: null, stale: true, generation: advanced.generation };
  }
  return { error: null, stale: false, generation: advanced.generation };
}

export type SyncBusinessResult = {
  data: AppData;
  error: string | null;
  generation: number;
  conflictRemote: AppData | null;
};

export async function syncBusinessData(
  organizationId: string,
  local: AppData,
  localGeneration: number,
): Promise<SyncBusinessResult> {
  const cloudGen = await fetchOrgSyncGeneration(organizationId);
  const cloud = await pullBusinessData(organizationId, local.business);
  const cloudHasData = cloud != null && !isEmptyBusinessData(cloud);
  const localHasData = !isEmptyBusinessData(local);

  if (!cloudHasData && localHasData) {
    const push = await pushBusinessData(organizationId, local, {
      seenGeneration: cloudGen,
    });
    if (push.stale && cloud && hasSyncConflict(local, cloud)) {
      return {
        data: local,
        error: null,
        generation: push.generation,
        conflictRemote: cloud,
      };
    }
    return {
      data: local,
      error: push.error,
      generation: push.generation,
      conflictRemote: null,
    };
  }

  if (cloudHasData && !localHasData) {
    return { data: cloud, error: null, generation: cloudGen, conflictRemote: null };
  }

  if (!cloudHasData && !localHasData) {
    return {
      data: cloud ?? emptyAppData(),
      error: null,
      generation: cloudGen,
      conflictRemote: null,
    };
  }

  if (cloud && cloudGen > localGeneration && hasSyncConflict(local, cloud)) {
    return {
      data: local,
      error: null,
      generation: cloudGen,
      conflictRemote: cloud,
    };
  }

  if (cloud && cloudGen > localGeneration) {
    if (localHasUnsyncedRecordsFromData(local, cloud)) {
      const merged = mergeAppData(local, cloud);
      const push = await pushBusinessData(organizationId, merged, {
        seenGeneration: cloudGen,
      });
      if (push.stale && hasSyncConflict(local, cloud)) {
        return {
          data: merged,
          error: null,
          generation: push.generation,
          conflictRemote: cloud,
        };
      }
      return {
        data: merged,
        error: push.error,
        generation: push.generation,
        conflictRemote: null,
      };
    }
    return { data: cloud, error: null, generation: cloudGen, conflictRemote: null };
  }

  const [cloudTs, localTs] = await Promise.all([
    fetchCloudWatermark(organizationId),
    Promise.resolve(localDataWatermark(local, organizationId)),
  ]);

  if (cloud && hasSyncConflict(local, cloud)) {
    return {
      data: local,
      error: null,
      generation: cloudGen,
      conflictRemote: cloud,
    };
  }

  if (localTs >= cloudTs || localGeneration >= cloudGen) {
    const push = await pushBusinessData(organizationId, local, {
      seenGeneration: cloudGen,
    });
    if (push.stale && cloud) {
      const fresh = await pullBusinessData(organizationId, local.business);
      if (fresh && hasSyncConflict(local, fresh)) {
        return {
          data: local,
          error: null,
          generation: push.generation,
          conflictRemote: fresh,
        };
      }
      const resolved = fresh
        ? mergePullWithLocal(local, fresh)
        : cloud;
      return {
        data: resolved ?? cloud,
        error: null,
        generation: push.generation,
        conflictRemote: null,
      };
    }
    return {
      data: local,
      error: push.error,
      generation: push.generation,
      conflictRemote: null,
    };
  }

  return {
    data: mergePullWithLocal(local, cloud!),
    error: null,
    generation: cloudGen,
    conflictRemote: null,
  };
}

export async function fetchCloudSyncWatermark(organizationId: string): Promise<number> {
  return fetchCloudWatermark(organizationId);
}

/** Pull cloud snapshot when another device saved newer data and local is not ahead. */
export async function pullRemoteIfNewer(
  organizationId: string,
  local: AppData,
  lastKnownCloudTs: number,
  lastKnownGeneration: number,
): Promise<{
  data: AppData;
  cloudTs: number;
  cloudGen: number;
  refreshed: boolean;
  error: string | null;
}> {
  const [cloudTs, cloudGen] = await Promise.all([
    fetchCloudWatermark(organizationId),
    fetchOrgSyncGeneration(organizationId),
  ]);

  const generationAhead = cloudGen > lastKnownGeneration;
  const timestampAhead = cloudTs > lastKnownCloudTs;

  if (!generationAhead && !timestampAhead) {
    return { data: local, cloudTs, cloudGen, refreshed: false, error: null };
  }

  const localTs = localDataWatermark(local, organizationId);
  if (!generationAhead && localTs > cloudTs) {
    return { data: local, cloudTs, cloudGen, refreshed: false, error: null };
  }

  const cloud = await pullBusinessData(organizationId, local.business);
  if (!cloud) {
    return {
      data: local,
      cloudTs,
      cloudGen,
      refreshed: false,
      error: "Could not load cloud data",
    };
  }

  return {
    data: mergePullWithLocal(local, cloud),
    cloudTs,
    cloudGen,
    refreshed: true,
    error: null,
  };
}
