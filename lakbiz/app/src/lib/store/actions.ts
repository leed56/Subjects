import { newId, todayKey } from "@/lib/format";
import { generateBillNo, generateGrnNo, type BusinessInfo } from "@/lib/invoice";
import { generateJobNo } from "@/lib/ac-jobs";
import type { PaymentMethod, Product } from "@/lib/types";
import type {
  AppData,
  ACJobInput,
  BankAccountInput,
  ChequeInput,
  ChequeStatus,
  CustomerInput,
  ProductInput,
  Purchase,
  PurchaseInput,
  Sale,
  SaleOptions,
  StockLog,
  SupplierInput,
} from "./types";

export function addProduct(data: AppData, input: ProductInput): AppData {
  const product: Product = {
    id: newId(),
    name: input.name.trim(),
    sku: input.sku?.trim() || undefined,
    category: input.category.trim(),
    sectorId: input.sectorId,
    buyPrice: input.buyPrice,
    sellPrice: input.sellPrice,
    stockQty: input.stockQty,
    reorderLevel: input.reorderLevel,
    customFields: { unit: input.unit },
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
            buyPrice: input.buyPrice,
            sellPrice: input.sellPrice,
            stockQty: input.stockQty,
            reorderLevel: input.reorderLevel,
            customFields: { ...p.customFields, unit: input.unit },
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
  const customer = {
    id: newId(),
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    creditBalance: 0,
  };
  return { ...data, customers: [customer, ...data.customers] };
}

export function updateCustomer(
  data: AppData,
  id: string,
  input: CustomerInput,
): AppData {
  return {
    ...data,
    customers: data.customers.map((c) =>
      c.id === id
        ? {
            ...c,
            name: input.name.trim(),
            phone: input.phone?.trim() || undefined,
            address: input.address?.trim() || undefined,
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

  const total = purchaseLines.reduce((s, l) => s + l.unitCost * l.qty, 0);
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

  const job = {
    id: newId(),
    jobNo: generateJobNo(data.acJobs.length),
    date: new Date().toISOString(),
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
    status: input.status,
    scheduledDate: input.scheduledDate,
    installedDate: input.installedDate,
    notes: input.notes?.trim() || undefined,
  };

  return { ...data, acJobs: [job, ...data.acJobs] };
}

export function updateACJob(
  data: AppData,
  id: string,
  input: Partial<ACJobInput>,
): AppData {
  return {
    ...data,
    acJobs: data.acJobs.map((j) => {
      if (j.id !== id) return j;
      const customer = input.customerId
        ? data.customers.find((c) => c.id === input.customerId)
        : undefined;
      return {
        ...j,
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
        status: input.status ?? j.status,
        scheduledDate: input.scheduledDate ?? j.scheduledDate,
        installedDate: input.installedDate ?? j.installedDate,
        notes: input.notes?.trim() ?? j.notes,
      };
    }),
  };
}

export function deleteACJob(data: AppData, id: string): AppData {
  return { ...data, acJobs: data.acJobs.filter((j) => j.id !== id) };
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

export function createSale(
  data: AppData,
  lines: { productId: string; qty: number }[],
  paymentMethod: Sale["paymentMethod"],
  options: SaleOptions = {},
): AppData {
  const saleLines = lines
    .map(({ productId, qty }) => {
      const product = data.products.find((p) => p.id === productId);
      if (!product || qty <= 0 || product.stockQty < qty) return null;
      return {
        productId,
        productName: product.name,
        qty,
        unitPrice: product.sellPrice,
        buyPrice: product.buyPrice,
      };
    })
    .filter(Boolean) as Sale["lines"];

  if (saleLines.length === 0) return data;

  const total = saleLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const profit = saleLines.reduce(
    (s, l) => s + (l.unitPrice - l.buyPrice) * l.qty,
    0,
  );

  const customer = options.customerId
    ? data.customers.find((c) => c.id === options.customerId)
    : undefined;

  const customerName =
    customer?.name ?? (options.customerName?.trim() || undefined);

  if (paymentMethod === "credit" && !customer) return data;

  let cheques = data.cheques;
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
        customerId: options.customerId,
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
    total,
    profit,
    paymentMethod,
    customerId: options.customerId,
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

  let customers = data.customers;
  if (paymentMethod === "credit" && options.customerId) {
    customers = customers.map((c) =>
      c.id === options.customerId
        ? { ...c, creditBalance: c.creditBalance + total }
        : c,
    );
  }

  return {
    ...data,
    sales: [sale, ...data.sales],
    customers,
    cheques,
    products: data.products.map((p) => {
      const sold = qtyByProduct.get(p.id);
      if (!sold) return p;
      return { ...p, stockQty: Math.max(0, p.stockQty - sold) };
    }),
    stockLogs: [...stockLogs, ...data.stockLogs],
  };
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
  business: BusinessInfo,
): AppData {
  return {
    ...data,
    business: {
      name: business.name.trim() || "My Shop",
      nameSi: business.nameSi?.trim() || undefined,
      phone: business.phone?.trim() || undefined,
      address: business.address?.trim() || undefined,
      tin: business.tin?.trim() || undefined,
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
    recentLogs: data.stockLogs.slice(0, 5),
  };
}
