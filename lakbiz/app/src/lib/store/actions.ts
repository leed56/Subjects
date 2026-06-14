import { newId, todayKey } from "@/lib/format";
import type { Product } from "@/lib/types";
import type { AppData, ProductInput, Sale, StockLog } from "./types";

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

export function createSale(
  data: AppData,
  lines: { productId: string; qty: number }[],
  paymentMethod: Sale["paymentMethod"],
  customerName?: string,
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

  const sale: Sale = {
    id: newId(),
    date: new Date().toISOString(),
    lines: saleLines,
    total,
    profit,
    paymentMethod,
    customerName: customerName?.trim() || undefined,
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

  return {
    ...data,
    sales: [sale, ...data.sales],
    products: data.products.map((p) => {
      const sold = qtyByProduct.get(p.id);
      if (!sold) return p;
      return { ...p, stockQty: Math.max(0, p.stockQty - sold) };
    }),
    stockLogs: [...stockLogs, ...data.stockLogs],
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

  return {
    todaySales: salesTotal,
    todayProfit: profitTotal,
    saleCount: todaySales.length,
    productCount: data.products.length,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock,
    stockValue,
    recentSales: data.sales.slice(0, 5),
    recentLogs: data.stockLogs.slice(0, 5),
  };
}
