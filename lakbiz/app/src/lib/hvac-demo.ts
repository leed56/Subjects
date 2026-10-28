import { emptyAppData } from "@/lib/store/storage";
import type { AppData, ACJob, Sale } from "@/lib/store/types";
import type { Product } from "@/lib/types";
import type { AcAsset } from "@/lib/supabase/ac-assets-client";

export const HVAC_DEMO_ID = "lakbiz-hvac-demo-v1";
export const HVAC_DEMO_ASSETS_KEY = "lakbiz-hvac-demo-assets-v1";
export const isHvacDemo = (org: { id: string | null; sector: string; isAuthenticated: boolean }) =>
  !org.isAuthenticated && org.sector === "ac_hvac" && org.id === HVAC_DEMO_ID;

function day(now: Date, offset: number): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
}

/** Fictional, browser-only records. This module has no database client. */
export function createHvacDemoData(now = new Date()): AppData {
  const data = emptyAppData();
  data.business = { ...data.business, name: "LakBiz Cooling Studio · Demo", nameSi: "LakBiz Cooling Studio · ආදර්ශ", address: "Sample service centre, Colombo", email: "demo@example.invalid", invoiceFooter: "DEMO BILL — sample data, no payment received." };
  data.customers = [
    ["Ocean View Apartments", "company", "Colombo 06", 45000],
    ["Nimali Perera", "individual", "Nugegoda", 0],
    ["Hillcrest Café", "company", "Kandy", 18000],
    ["Arun Fernando", "individual", "Dehiwala", 0],
    ["Greenleaf Office", "company", "Battaramulla", 0],
    ["Saman Jayawardena", "individual", "Maharagama", 0],
  ].map(([name, type, address, credit], i) => ({ id: `demo-customer-${i + 1}`, name: String(name), contactType: type as "company" | "individual", address: String(address), creditBalance: Number(credit), creditLimit: 150000 }));
  data.technicians = [
    { id: "demo-tech-1", name: "Kasun Silva", specialties: ["installation", "repair"], active: true, hourlyRate: 1800 },
    { id: "demo-tech-2", name: "Tharindu Perera", specialties: ["service", "repair"], active: true, hourlyRate: 1600 },
    { id: "demo-tech-3", name: "Rizwan Ahamed", specialties: ["installation", "service"], active: true, hourlyRate: 1700 },
    { id: "demo-tech-4", name: "Dinesh Kumar", specialties: ["service"], active: true, hourlyRate: 1500 },
  ];
  data.contractors = [{ id: "demo-contractor-1", name: "Sample Installation Crew", company: "Demo Field Services", specialties: ["installation"], rateType: "per_job", rateAmount: 18000, payableBalance: 18000, active: true }];
  data.suppliers = [
    { id: "demo-supplier-1", name: "Demo Climate Parts", address: "Colombo", payableBalance: 68000 },
    { id: "demo-supplier-2", name: "Sample Refrigeration Supply", address: "Kelaniya", payableBalance: 23400 },
  ];
  const catalogue: [string, string, number, number, number, number, string][] = [
    ["Inverter AC · 12,000 BTU", "Air conditioners", 132000, 169000, 8, 3, "unit"],
    ["Inverter AC · 18,000 BTU", "Air conditioners", 178000, 225000, 5, 2, "unit"],
    ["Copper pipe pair · insulated", "Installation materials", 3400, 4700, 72, 20, "m"],
    ["Wall mounting bracket", "Installation materials", 2800, 4200, 24, 8, "pair"],
    ["R32 refrigerant", "Refrigerants", 3900, 5800, 18, 5, "kg"],
    ["Run capacitor · 35 μF", "Electrical parts", 1250, 2200, 4, 6, "pcs"],
    ["Outdoor fan motor", "Replacement parts", 14200, 21500, 3, 4, "pcs"],
    ["Universal remote controller", "Accessories", 1200, 2300, 18, 5, "pcs"],
    ["Drain hose", "Installation materials", 160, 290, 120, 30, "m"],
    ["AC coil cleaner · 1 L", "Service supplies", 1400, 2400, 14, 5, "bottle"],
    ["Inverter control board", "Replacement parts", 26500, 39000, 0, 2, "pcs"],
    ["Service isolation switch", "Electrical parts", 1800, 2900, 12, 4, "pcs"],
  ];
  data.products = catalogue.map(([name, category, buyPrice, sellPrice, stockQty, reorderLevel, unit], i): Product => ({ id: `demo-product-${i + 1}`, name, category, sku: `DEMO-HVAC-${String(i + 1).padStart(3, "0")}`, sectorId: "ac_hvac", condition: "new", buyPrice, sellPrice, stockQty, reorderLevel, active: true, customFields: { unit }, notes: "Fictional demo product and sample LKR price." }));
  for (let i = 0; i < 21; i += 1) {
    const product = data.products[i % 10];
    const qty = i % 3 + 1;
    const total = qty * product.sellPrice;
    const customer = data.customers[i % data.customers.length];
    const sale: Sale = { id: `demo-sale-${i + 1}`, billNo: `DEMO-${String(i + 1).padStart(4, "0")}`, date: `${day(now, -Math.floor(i / 3))}T${String(9 + i % 8).padStart(2, "0")}:15:00+05:30`, lines: [{ productId: product.id, productName: product.name, qty, unitPrice: product.sellPrice, buyPrice: product.buyPrice }], subtotal: total, outputVat: 0, total, profit: qty * (product.sellPrice - product.buyPrice), paymentMethod: i % 2 ? "card" : "cash", customerId: customer.id, customerName: customer.name, creditAmount: 0 };
    data.sales.push(sale);
  }
  const jobs: [number, ACJob["jobType"], ACJob["status"], number, number, string][] = [
    [0, "installation", "scheduled", 1, 36000, "Install two inverter units and test drainage"],
    [0, "repair", "scheduled", 2, 18500, "Inspect low cooling and replace run capacitor"],
    [0, "service", "completed", 3, 15000, "Deep clean three split units"],
    [1, "installation", "deposit_received", 4, 28000, "Bedroom split AC installation"],
    [2, "service", "scheduled", 5, 22000, "Quarterly office maintenance visit"],
    [-5, "installation", "installed", 6, 32000, "New inverter unit installation complete"],
    [-7, "service", "service_due", 1, 12000, "Annual maintenance follow-up overdue"],
    [0, "repair", "quote", 3, 24000, "Outdoor fan motor inspection and quotation"],
    [-2, "repair", "completed", 2, 16500, "Drain blockage cleared and leak test complete"],
  ];
  data.acJobs = jobs.map(([offset, jobType, status, customerIndex, quotedAmount, complaint], i) => {
    const customer = data.customers[customerIndex - 1];
    return { id: `demo-job-${i + 1}`, jobNo: `DEMO-JOB-${String(i + 1).padStart(3, "0")}`, date: `${day(now, offset)}T09:00:00+05:30`, jobType, status, customerId: customer.id, customerName: customer.name, address: customer.address ?? "Colombo", brand: "Sample Climate", btu: i % 2 ? 18000 : 12000, unitType: "Wall mounted", unitCount: i === 0 ? 2 : i === 2 ? 3 : 1, description: `${i % 2 ? "18,000" : "12,000"} BTU · Wall mounted`, complaint, diagnosis: status === "completed" ? "Sample inspection completed and system tested." : undefined, quotedAmount, depositAmount: status === "completed" || status === "installed" ? quotedAmount : status === "quote" ? 0 : Math.round(quotedAmount / 2), assigneeType: "team", assigneeId: data.technicians[i % 4].id, scheduledDate: status === "quote" || status === "service_due" ? undefined : day(now, offset), installedDate: status === "installed" ? day(now, offset) : undefined, serviceDueDate: status === "service_due" ? day(now, -2) : status === "installed" ? day(now, 175) : undefined, serviceIntervalDays: 180, notes: "Fictional sample job for the HVAC demo." };
  });
  data.jobItems = data.acJobs.flatMap((job, i) => [
    { id: `demo-job-line-${i}-labour`, jobId: job.id, itemType: "labour" as const, name: "Technician labour", qty: 2, unit: "hrs", unitPrice: 1600, lineTotal: 3200, customerPrice: 2800, technicianId: job.assigneeId, invoiceable: true },
    { id: `demo-job-line-${i}-part`, jobId: job.id, itemType: "part" as const, name: i % 2 ? "Run capacitor · 35 μF" : "Copper pipe pair · insulated", qty: i % 2 ? 1 : 3, unit: i % 2 ? "pcs" : "m", unitPrice: i % 2 ? 1250 : 3400, lineTotal: i % 2 ? 1250 : 10200, customerPrice: i % 2 ? 2200 : 4700, source: "manual" as const, invoiceable: true },
  ]);
  data.bankAccounts = [{ id: "demo-bank-1", bankName: "Sample Bank", accountName: "HVAC Demo Account", accountNumber: "DEMO-0001", balance: 485000 }];
  data.bankTransactions = [{ id: "demo-bank-tx-1", accountId: "demo-bank-1", type: "deposit", amount: 28000, description: "Sample installation deposit", date: `${day(now, 0)}T10:00:00+05:30` }];
  data.purchases = [2, 4].map((productIndex, i) => {
    const product = data.products[productIndex];
    const qty = i ? 6 : 20;
    const total = qty * product.buyPrice;
    return { id: `demo-purchase-${i + 1}`, grnNo: `DEMO-GRN-00${i + 1}`, date: `${day(now, -21)}T09:00:00+05:30`, supplierId: data.suppliers[i].id, supplierName: data.suppliers[i].name, lines: [{ productId: product.id, productName: product.name, qty, unitCost: product.buyPrice }], subtotal: total, inputVat: 0, total, paymentMethod: "credit" as const, creditAmount: total, note: "Historical sample receipt included in demo opening stock." };
  });
  data.purchaseOrders = [{ id: "demo-po-1", poNo: "DEMO-PO-001", date: `${day(now, -1)}T11:00:00+05:30`, supplierId: data.suppliers[0].id, supplierName: data.suppliers[0].name, lines: [{ productId: data.products[5].id, productName: data.products[5].name, qtyOrdered: 12, qtyReceived: 0, unitCost: data.products[5].buyPrice }], expectedTotal: 15000, status: "pending", relatedJobId: data.acJobs[1].id, note: "Sample replenishment order for low-stock capacitors." }];
  data.stockLogs = data.products.flatMap((product) => {
    const sold = data.sales.flatMap((sale) => sale.lines.filter((line) => line.productId === product.id).map((line) => ({ sale, line })));
    return [{ id: `demo-receipt-${product.id}`, productId: product.id, productName: product.name, type: "in" as const, qty: product.stockQty + sold.reduce((sum, row) => sum + row.line.qty, 0), date: `${day(now, -14)}T08:00:00+05:30`, note: "Demo opening stock" }, ...sold.map(({ sale, line }) => ({ id: `demo-move-${sale.id}`, productId: product.id, productName: product.name, type: "sale" as const, qty: line.qty, date: sale.date, note: sale.billNo }))];
  });
  return data;
}

export function createHvacDemoAssets(now = new Date()): AcAsset[] {
  return Array.from({ length: 6 }, (_, i) => ({ id: `demo-asset-${i + 1}`, organizationId: HVAC_DEMO_ID, customerId: `demo-customer-${i + 1}`, siteAddress: ["Colombo 06", "Nugegoda", "Kandy", "Dehiwala", "Battaramulla", "Maharagama"][i], brand: "Sample Climate", model: `Inverter ${i % 2 ? "18" : "12"}K`, serialNo: `DEMO-AC-${1001 + i}`, indoorSerial: null, outdoorSerial: null, btu: i % 2 ? 18000 : 12000, acType: "split", refrigerantType: "R32", installDate: day(now, -180 - i * 20), warrantyExpiry: day(now, 185 - i * 20), locationInProperty: ["Living room", "Bedroom", "Dining area", "Master bedroom", "Meeting room", "Home office"][i], status: "active", nextServiceDate: day(now, i === 0 ? -2 : i * 9), notes: "Fictional demo equipment record.", createdAt: now.toISOString(), updatedAt: now.toISOString() }));
}
