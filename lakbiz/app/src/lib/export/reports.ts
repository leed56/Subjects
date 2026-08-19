import type { BusinessInfo } from "@/lib/invoice";
import type { Customer, Purchase, Sale } from "@/lib/store/types";
import type { PaymentMethod, Product } from "@/lib/types";
import type { VatQuarterSummary } from "@/lib/vat";
import { downloadCsv, exportFilename, rowsToCsv } from "./csv";
import { printHtmlReport, tableHtml } from "./print-report";

export type SalesExportLabels = {
  billNo: string;
  date: string;
  customer: string;
  payment: string;
  items: string;
  discount: string;
  subtotal: string;
  vat: string;
  total: string;
  profit: string;
};

export type CustomerExportLabels = {
  name: string;
  type: string;
  contactPerson: string;
  phone: string;
  address: string;
  vatNumber: string;
  creditBalance: string;
  creditLimit: string;
};

export type StockExportLabels = {
  name: string;
  sku: string;
  category: string;
  condition: string;
  qty: string;
  sellPrice: string;
  buyPrice: string;
  reorderLevel: string;
};

export type VatExportLabels = {
  billNo: string;
  date: string;
  customer: string;
  outputVat: string;
  grnNo: string;
  supplier: string;
  inputVat: string;
  netPayable: string;
  outputTotal: string;
  inputTotal: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-LK");
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK");
}

export function buildSalesCsv(
  sales: Sale[],
  options: {
    includeProfit: boolean;
    labels: SalesExportLabels;
    paymentLabel: (method: PaymentMethod) => string;
  },
): string {
  const header = [
    options.labels.billNo,
    options.labels.date,
    options.labels.customer,
    options.labels.payment,
    options.labels.items,
    options.labels.discount,
    options.labels.subtotal,
    options.labels.vat,
    options.labels.total,
    ...(options.includeProfit ? [options.labels.profit] : []),
  ];

  const rows = sales.map((s) => [
    s.billNo ?? s.id.slice(0, 8),
    formatDate(s.date),
    s.customerName ?? "",
    options.paymentLabel(s.paymentMethod),
    s.lines.reduce((sum, l) => sum + l.qty, 0),
    s.discount ?? 0,
    s.subtotal ?? s.total - (s.outputVat ?? 0),
    s.outputVat ?? 0,
    s.total,
    ...(options.includeProfit ? [s.profit] : []),
  ]);

  return rowsToCsv([header, ...rows]);
}

export function buildCustomersCsv(
  customers: Customer[],
  options: {
    labels: CustomerExportLabels;
    typeLabel: (type: Customer["contactType"]) => string;
  },
): string {
  const header = [
    options.labels.name,
    options.labels.type,
    options.labels.contactPerson,
    options.labels.phone,
    options.labels.address,
    options.labels.vatNumber,
    options.labels.creditBalance,
    options.labels.creditLimit,
  ];

  const rows = customers.map((c) => [
    c.name,
    options.typeLabel(c.contactType),
    c.contactPerson ?? "",
    c.phone ?? "",
    c.address ?? "",
    c.vatNumber ?? "",
    c.creditBalance,
    c.creditLimit ?? "",
  ]);

  return rowsToCsv([header, ...rows]);
}

export function buildStockCsv(
  products: Product[],
  options: {
    includeBuyPrice: boolean;
    labels: StockExportLabels;
    conditionLabel: (condition: Product["condition"]) => string;
  },
): string {
  const header = [
    options.labels.name,
    options.labels.sku,
    options.labels.category,
    options.labels.condition,
    options.labels.qty,
    options.labels.sellPrice,
    ...(options.includeBuyPrice ? [options.labels.buyPrice] : []),
    options.labels.reorderLevel,
  ];

  const rows = products.map((p) => [
    p.name,
    p.sku ?? "",
    p.category,
    options.conditionLabel(p.condition),
    p.stockQty,
    p.sellPrice,
    ...(options.includeBuyPrice ? [p.buyPrice] : []),
    p.reorderLevel ?? "",
  ]);

  return rowsToCsv([header, ...rows]);
}

export function buildVatCsv(
  sales: Sale[],
  purchases: Purchase[],
  summary: VatQuarterSummary,
  labels: VatExportLabels,
): string {
  const sections: (string | number)[][] = [
    [labels.netPayable, summary.netPayable],
    [labels.outputTotal, summary.outputVat],
    [labels.inputTotal, summary.inputVat],
    [],
    [labels.billNo, labels.date, labels.customer, labels.outputVat],
    ...sales.map((s) => [
      s.billNo ?? s.id.slice(0, 8),
      formatDateShort(s.date),
      s.customerName ?? "",
      s.outputVat ?? 0,
    ]),
    [],
    [labels.grnNo, labels.date, labels.supplier, labels.inputVat],
    ...purchases.map((p) => [
      p.grnNo,
      formatDateShort(p.date),
      p.supplierName,
      p.inputVat ?? 0,
    ]),
  ];

  return rowsToCsv(sections);
}

export function exportSalesCsv(
  business: BusinessInfo,
  sales: Sale[],
  options: Parameters<typeof buildSalesCsv>[1],
): void {
  downloadCsv(
    exportFilename(business.name, "sales"),
    buildSalesCsv(sales, options),
  );
}

export function exportCustomersCsv(
  business: BusinessInfo,
  customers: Customer[],
  options: Parameters<typeof buildCustomersCsv>[1],
): void {
  downloadCsv(
    exportFilename(business.name, "customers"),
    buildCustomersCsv(customers, options),
  );
}

export function exportStockCsv(
  business: BusinessInfo,
  products: Product[],
  options: Parameters<typeof buildStockCsv>[1],
): void {
  downloadCsv(
    exportFilename(business.name, "stock"),
    buildStockCsv(products, options),
  );
}

export function exportVatCsv(
  business: BusinessInfo,
  sales: Sale[],
  purchases: Purchase[],
  summary: VatQuarterSummary,
  labels: VatExportLabels,
): void {
  downloadCsv(
    exportFilename(business.name, "vat-return"),
    buildVatCsv(sales, purchases, summary, labels),
  );
}

export type AccountantPackOptions = {
  includeProfit: boolean;
  includeBuyPrice: boolean;
  salesLabels: SalesExportLabels;
  stockLabels: StockExportLabels;
  customerLabels: CustomerExportLabels;
  paymentLabel: (method: PaymentMethod) => string;
  typeLabel: (type: Customer["contactType"]) => string;
  conditionLabel: (condition: Product["condition"]) => string;
};

export function buildAccountantPackCsv(
  business: BusinessInfo,
  data: {
    sales: Sale[];
    products: Product[];
    customers: Customer[];
  },
  options: AccountantPackOptions,
): string {
  const generated = new Date().toLocaleString("en-LK");
  const sections = [
    ["LakBiz Accountant Export"],
    [`Shop`, business.name],
    [`Generated`, generated],
    [],
    ["=== SALES ==="],
    buildSalesCsv(data.sales, {
      includeProfit: options.includeProfit,
      labels: options.salesLabels,
      paymentLabel: options.paymentLabel,
    }).split("\n"),
    [],
    ["=== STOCK ==="],
    buildStockCsv(data.products, {
      includeBuyPrice: options.includeBuyPrice,
      labels: options.stockLabels,
      conditionLabel: options.conditionLabel,
    }).split("\n"),
    [],
    ["=== CUSTOMERS ==="],
    buildCustomersCsv(data.customers, {
      labels: options.customerLabels,
      typeLabel: options.typeLabel,
    }).split("\n"),
  ];

  return sections.flat().join("\n");
}

export function exportAccountantPack(
  business: BusinessInfo,
  data: {
    sales: Sale[];
    products: Product[];
    customers: Customer[];
  },
  options: AccountantPackOptions,
): void {
  downloadCsv(
    exportFilename(business.name, "accountant-pack"),
    buildAccountantPackCsv(business, data, options),
  );
}

export function printSalesReport(
  business: BusinessInfo,
  sales: Sale[],
  options: {
    includeProfit: boolean;
    labels: SalesExportLabels;
    reportTitle: string;
    paymentLabel: (method: PaymentMethod) => string;
  },
): void {
  const headers = [
    options.labels.billNo,
    options.labels.date,
    options.labels.customer,
    options.labels.payment,
    options.labels.total,
    ...(options.includeProfit ? [options.labels.profit] : []),
  ];
  const numericCols = options.includeProfit ? [4, 5] : [4];
  const rows = sales.map((s) => [
    s.billNo ?? s.id.slice(0, 8),
    formatDateShort(s.date),
    s.customerName ?? "—",
    options.paymentLabel(s.paymentMethod),
    s.total,
    ...(options.includeProfit ? [s.profit] : []),
  ]);
  const total = sales.reduce((sum, s) => sum + s.total, 0);
  const profit = sales.reduce((sum, s) => sum + s.profit, 0);

  printHtmlReport({
    title: options.reportTitle,
    shopName: business.name,
    bodyHtml:
      tableHtml(headers, rows, numericCols) +
      `<table style="margin-top:16px"><tfoot><tr>` +
      `<td colspan="${headers.length - (options.includeProfit ? 2 : 1)}">Total</td>` +
      `<td class="num">${total}</td>` +
      (options.includeProfit ? `<td class="num">${profit}</td>` : "") +
      `</tr></tfoot></table>`,
  });
}

export function printVatReport(
  business: BusinessInfo,
  sales: Sale[],
  purchases: Purchase[],
  summary: VatQuarterSummary,
  labels: VatExportLabels,
  reportTitle: string,
): void {
  const salesTable = tableHtml(
    [labels.billNo, labels.date, labels.customer, labels.outputVat],
    sales.map((s) => [
      s.billNo ?? s.id.slice(0, 8),
      formatDateShort(s.date),
      s.customerName ?? "—",
      s.outputVat ?? 0,
    ]),
    [3],
  );
  const purchasesTable = tableHtml(
    [labels.grnNo, labels.date, labels.supplier, labels.inputVat],
    purchases.map((p) => [
      p.grnNo,
      formatDateShort(p.date),
      p.supplierName,
      p.inputVat ?? 0,
    ]),
    [3],
  );

  printHtmlReport({
    title: reportTitle,
    subtitle: summary.bounds.label,
    shopName: business.name,
    bodyHtml: `
      <p><strong>${labels.netPayable}:</strong> ${summary.netPayable.toLocaleString("en-LK")}</p>
      <p><strong>${labels.outputTotal}:</strong> ${summary.outputVat.toLocaleString("en-LK")}
         · <strong>${labels.inputTotal}:</strong> ${summary.inputVat.toLocaleString("en-LK")}</p>
      <h2 style="font-size:1rem;margin:24px 0 8px">${labels.outputVat}</h2>
      ${salesTable}
      <h2 style="font-size:1rem;margin:24px 0 8px">${labels.inputVat}</h2>
      ${purchasesTable}
    `,
  });
}

/**
 * Phase 24 follow-up — /reports itself (revenue/profit/top-products/
 * top-customers, plus the Phase 24 AC job performance section) never
 * had CSV/print export: the per-domain helpers above (sales/customers/
 * stock/VAT) don't fit its aggregate, period-summarized shape, and it
 * was never wired to any of them — a gap this file's own header
 * comments and IMPLEMENTATION_PROGRESS.md's "Not started" list already
 * flagged. `acJobs` is optional so orgs without the AC/HVAC module (no
 * `can("ac_jobs")`) get the same export shape they always would have —
 * nothing appears for a section they never saw on screen either.
 */
export type ReportsExportLabels = {
  period: string;
  totalRevenue: string;
  totalProfit: string;
  salesCount: string;
  avgSale: string;
  topProducts: string;
  productName: string;
  qty: string;
  revenue: string;
  topCustomers: string;
  customerName: string;
  orders: string;
  total: string;
  acJobsTitle: string;
  totalQuoted: string;
  totalCost: string;
  totalMargin: string;
  jobsNeedingAttention: string;
  jobCustomer: string;
  jobNo: string;
  margin: string;
  marginPct: string;
};

export type ReportsExportData = {
  periodLabel: string;
  totalRevenue: number;
  totalProfit: number;
  salesCount: number;
  avgSale: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  topCustomers: { name: string; orders: number; total: number }[];
  /** Omitted entirely for an org/role that doesn't see the AC job
   * performance section on screen (see reports/page.tsx's own
   * can("ac_jobs") gate) — never populated with zeros to imply data
   * that was never actually computed. */
  acJobs?: {
    totalQuoted: number;
    totalCost: number;
    totalMargin: number;
    lowMarginJobs: { customerName: string; jobNo: string; grossProfit: number; grossMarginPct: number }[];
  };
};

export function buildReportsCsv(
  data: ReportsExportData,
  labels: ReportsExportLabels,
): string {
  const sections: (string | number)[][] = [
    [labels.period, data.periodLabel],
    [],
    [labels.totalRevenue, data.totalRevenue],
    [labels.totalProfit, data.totalProfit],
    [labels.salesCount, data.salesCount],
    [labels.avgSale, data.avgSale],
    [],
    [labels.topProducts],
    [labels.productName, labels.qty, labels.revenue],
    ...data.topProducts.map((p) => [p.name, p.qty, p.revenue]),
    [],
    [labels.topCustomers],
    [labels.customerName, labels.orders, labels.total],
    ...data.topCustomers.map((c) => [c.name, c.orders, c.total]),
  ];

  if (data.acJobs) {
    sections.push(
      [],
      [labels.acJobsTitle],
      [labels.totalQuoted, data.acJobs.totalQuoted],
      [labels.totalCost, data.acJobs.totalCost],
      [labels.totalMargin, data.acJobs.totalMargin],
      [],
      [labels.jobsNeedingAttention],
      [labels.jobCustomer, labels.jobNo, labels.margin, labels.marginPct],
      ...data.acJobs.lowMarginJobs.map((j) => [
        j.customerName,
        j.jobNo,
        j.grossProfit,
        `${j.grossMarginPct.toFixed(1)}%`,
      ]),
    );
  }

  return rowsToCsv(sections);
}

export function exportReportsCsv(
  business: BusinessInfo,
  data: ReportsExportData,
  labels: ReportsExportLabels,
): void {
  downloadCsv(
    exportFilename(business.name, "reports"),
    buildReportsCsv(data, labels),
  );
}

export function printReportsSummary(
  business: BusinessInfo,
  data: ReportsExportData,
  labels: ReportsExportLabels,
  reportTitle: string,
): void {
  const productsTable = tableHtml(
    [labels.productName, labels.qty, labels.revenue],
    data.topProducts.map((p) => [p.name, p.qty, p.revenue]),
    [1, 2],
  );
  const customersTable = tableHtml(
    [labels.customerName, labels.orders, labels.total],
    data.topCustomers.map((c) => [c.name, c.orders, c.total]),
    [1, 2],
  );

  const acJobsHtml = data.acJobs
    ? `
      <h2 style="font-size:1rem;margin:24px 0 8px">${labels.acJobsTitle}</h2>
      <p><strong>${labels.totalQuoted}:</strong> ${data.acJobs.totalQuoted.toLocaleString("en-LK")}
         · <strong>${labels.totalCost}:</strong> ${data.acJobs.totalCost.toLocaleString("en-LK")}
         · <strong>${labels.totalMargin}:</strong> ${data.acJobs.totalMargin.toLocaleString("en-LK")}</p>
      ${
        data.acJobs.lowMarginJobs.length > 0
          ? `<h3 style="font-size:0.9rem;margin:16px 0 8px">${labels.jobsNeedingAttention}</h3>` +
            tableHtml(
              [labels.jobCustomer, labels.jobNo, labels.margin, labels.marginPct],
              data.acJobs.lowMarginJobs.map((j) => [
                j.customerName,
                j.jobNo,
                j.grossProfit,
                `${j.grossMarginPct.toFixed(1)}%`,
              ]),
              [2, 3],
            )
          : ""
      }
    `
    : "";

  printHtmlReport({
    title: reportTitle,
    subtitle: data.periodLabel,
    shopName: business.name,
    bodyHtml: `
      <p><strong>${labels.totalRevenue}:</strong> ${data.totalRevenue.toLocaleString("en-LK")}
         · <strong>${labels.totalProfit}:</strong> ${data.totalProfit.toLocaleString("en-LK")}
         · <strong>${labels.salesCount}:</strong> ${data.salesCount}
         · <strong>${labels.avgSale}:</strong> ${data.avgSale.toLocaleString("en-LK")}</p>
      <h2 style="font-size:1rem;margin:24px 0 8px">${labels.topProducts}</h2>
      ${productsTable}
      <h2 style="font-size:1rem;margin:24px 0 8px">${labels.topCustomers}</h2>
      ${customersTable}
      ${acJobsHtml}
    `,
  });
}
