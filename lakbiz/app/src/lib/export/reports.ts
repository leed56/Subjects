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
