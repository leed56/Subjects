"use client";

import type { PaymentMethod, Product, SectorId } from "@/lib/types";
import type { BusinessInfo } from "@/lib/invoice";
import { defaultBusiness } from "@/lib/invoice";
import { emptyAppData } from "@/lib/store/storage";
import type { AppData } from "@/lib/store/types";
import { businessFromOrg, fetchOrgShopSettings } from "./org-settings";
import { createBrowserClient } from "./client";

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

export function isEmptyBusinessData(data: AppData): boolean {
  return (
    data.products.length === 0 &&
    data.sales.length === 0 &&
    data.customers.length === 0 &&
    data.suppliers.length === 0 &&
    data.purchases.length === 0 &&
    data.customerPayments.length === 0 &&
    data.supplierPayments.length === 0 &&
    data.stockLogs.length === 0 &&
    data.bankAccounts.length === 0 &&
    data.cheques.length === 0 &&
    data.acJobs.length === 0 &&
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
    supplierPaymentsRes,
    stockLogsRes,
    bankAccountsRes,
    chequesRes,
    acJobsRes,
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
      .from("supplier_payments")
      .select("*")
      .eq("organization_id", organizationId),
    supabase.from("stock_logs").select("*").eq("organization_id", organizationId),
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("organization_id", organizationId),
    supabase.from("cheques").select("*").eq("organization_id", organizationId),
    supabase.from("ac_jobs").select("*").eq("organization_id", organizationId),
    supabase.from("vehicles").select("*").eq("organization_id", organizationId),
    fetchOrgShopSettings(organizationId),
  ]);

  const firstError =
    productsRes.error ??
    customersRes.error ??
    suppliersRes.error ??
    salesRes.error ??
    saleLinesRes.error ??
    purchasesRes.error ??
    purchaseLinesRes.error ??
    customerPaymentsRes.error ??
    supplierPaymentsRes.error ??
    stockLogsRes.error ??
    bankAccountsRes.error ??
    chequesRes.error ??
    acJobsRes.error ??
    vehiclesRes.error;

  if (firstError) return null;

  const saleLinesBySale = new Map<string, typeof saleLinesRes.data>();
  for (const line of saleLinesRes.data ?? []) {
    const list = saleLinesBySale.get(line.sale_id) ?? [];
    list.push(line);
    saleLinesBySale.set(line.sale_id, list);
  }

  const purchaseLinesByPurchase = new Map<
    string,
    typeof purchaseLinesRes.data
  >();
  for (const line of purchaseLinesRes.data ?? []) {
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
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      creditBalance: num(row.credit_balance),
    })),
    suppliers: (suppliersRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
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
        total: num(row.total),
        profit: num(row.profit),
        paymentMethod: asPaymentMethod(row.payment_method),
        customerId: row.customer_id ?? undefined,
        customerName: row.customer_name ?? undefined,
        creditAmount: num(row.credit_amount),
        chequeId: row.cheque_id ?? undefined,
      };
    }),
    purchases: (purchasesRes.data ?? []).map((row) => {
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
    customerPayments: (customerPaymentsRes.data ?? []).map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      amount: num(row.amount),
      date: row.payment_date,
      method: asPaymentMethod(row.method),
      note: row.note ?? undefined,
    })),
    supplierPayments: (supplierPaymentsRes.data ?? []).map((row) => ({
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      amount: num(row.amount),
      date: row.payment_date,
      method: asPaymentMethod(row.method),
      note: row.note ?? undefined,
    })),
    stockLogs: (stockLogsRes.data ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      type: row.log_type as "in" | "out" | "sale",
      qty: num(row.qty),
      note: row.note ?? undefined,
      date: row.log_date,
    })),
    bankAccounts: (bankAccountsRes.data ?? []).map((row) => ({
      id: row.id,
      bankName: row.bank_name,
      branch: row.branch ?? undefined,
      accountName: row.account_name,
      accountNumber: row.account_number,
      balance: num(row.balance),
    })),
    cheques: (chequesRes.data ?? []).map((row) => ({
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
    acJobs: (acJobsRes.data ?? []).map((row) => ({
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
      amcContract: row.amc_contract ?? undefined,
      jobType: (row.job_type as AppData["acJobs"][number]["jobType"]) ?? "installation",
      assignedTechnician: row.assigned_technician ?? undefined,
      notes: row.notes ?? undefined,
    })),
    vehicles: (vehiclesRes.data ?? []).map((row) => ({
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

async function deleteOrgRows(
  table:
    | "products"
    | "customers"
    | "suppliers"
    | "sales"
    | "purchases"
    | "customer_payments"
    | "supplier_payments"
    | "stock_logs"
    | "bank_accounts"
    | "cheques"
    | "ac_jobs"
    | "vehicles"
    | "sale_lines"
    | "purchase_lines",
  organizationId: string,
): Promise<string | null> {
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("organization_id", organizationId);
  return error?.message ?? null;
}

async function insertOrgRows(
  table:
    | "products"
    | "customers"
    | "suppliers"
    | "sales"
    | "purchases"
    | "customer_payments"
    | "supplier_payments"
    | "stock_logs"
    | "bank_accounts"
    | "cheques"
    | "ac_jobs"
    | "vehicles"
    | "sale_lines"
    | "purchase_lines",
  rows: Record<string, unknown>[],
): Promise<string | null> {
  if (rows.length === 0) return null;
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";

  const { error } = await supabase.from(table).insert(rows);
  return error?.message ?? null;
}

export async function pushBusinessData(
  organizationId: string,
  data: AppData,
): Promise<string | null> {
  const productRows = data.products.map((p) => ({
    id: p.id,
    organization_id: organizationId,
    name: p.name,
    sku: p.sku ?? null,
    category: p.category,
    sector_id: p.sectorId,
    buy_price: p.buyPrice,
    sell_price: p.sellPrice,
    stock_qty: p.stockQty,
    reorder_level: p.reorderLevel ?? null,
    unit: (p.customFields.unit as string) || "pcs",
    custom_fields: p.customFields,
  }));

  const customerRows = data.customers.map((c) => ({
    id: c.id,
    organization_id: organizationId,
    name: c.name,
    phone: c.phone ?? null,
    address: c.address ?? null,
    credit_balance: c.creditBalance,
  }));

  const supplierRows = data.suppliers.map((s) => ({
    id: s.id,
    organization_id: organizationId,
    name: s.name,
    phone: s.phone ?? null,
    address: s.address ?? null,
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
    amc_contract: job.amcContract ?? null,
    job_type: job.jobType ?? "installation",
    assigned_technician: job.assignedTechnician ?? null,
    notes: job.notes ?? null,
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

  const deleteSteps: Array<
    | "sale_lines"
    | "purchase_lines"
    | "sales"
    | "purchases"
    | "customer_payments"
    | "supplier_payments"
    | "stock_logs"
    | "cheques"
    | "ac_jobs"
    | "vehicles"
    | "products"
    | "customers"
    | "suppliers"
    | "bank_accounts"
  > = [
    "sale_lines",
    "purchase_lines",
    "sales",
    "purchases",
    "customer_payments",
    "supplier_payments",
    "stock_logs",
    "cheques",
    "ac_jobs",
    "vehicles",
    "products",
    "customers",
    "suppliers",
    "bank_accounts",
  ];

  for (const table of deleteSteps) {
    const err = await deleteOrgRows(table, organizationId);
    if (err) return err;
  }

  const insertSteps: Array<{
    table:
      | "products"
      | "customers"
      | "suppliers"
      | "bank_accounts"
      | "sales"
      | "purchases"
      | "sale_lines"
      | "purchase_lines"
      | "customer_payments"
      | "supplier_payments"
      | "stock_logs"
      | "cheques"
      | "ac_jobs"
      | "vehicles";
    rows: Record<string, unknown>[];
  }> = [
    { table: "products", rows: productRows },
    { table: "customers", rows: customerRows },
    { table: "suppliers", rows: supplierRows },
    { table: "bank_accounts", rows: bankRows },
    { table: "sales", rows: saleRows },
    { table: "purchases", rows: purchaseRows },
    { table: "sale_lines", rows: saleLineRows },
    { table: "purchase_lines", rows: purchaseLineRows },
    { table: "customer_payments", rows: customerPaymentRows },
    { table: "supplier_payments", rows: supplierPaymentRows },
    { table: "stock_logs", rows: stockLogRows },
    { table: "cheques", rows: chequeRows },
    { table: "ac_jobs", rows: acJobRows },
    { table: "vehicles", rows: vehicleRows },
  ];

  for (const step of insertSteps) {
    const err = await insertOrgRows(step.table, step.rows);
    if (err) return err;
  }

  return null;
}

export async function syncBusinessData(
  organizationId: string,
  local: AppData,
): Promise<{ data: AppData; error: string | null }> {
  const cloud = await pullBusinessData(organizationId, local.business);

  if (cloud && !isEmptyBusinessData(cloud)) {
    return { data: cloud, error: null };
  }

  if (!isEmptyBusinessData(local)) {
    const pushError = await pushBusinessData(organizationId, local);
    return { data: local, error: pushError };
  }

  return { data: cloud ?? emptyAppData(), error: null };
}
