"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentMethod } from "@/lib/types";
import {
  addProduct,
  adjustStock,
  createSale,
  deleteProduct,
  updateProduct,
} from "./actions";
import { clearAppData, loadAppData, saveAppData } from "./storage";
import type { AppData, ProductInput } from "./types";

export function useAppStore() {
  const [data, setData] = useState<AppData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadAppData());
    setReady(true);
  }, []);

  const persist = useCallback((next: AppData) => {
    setData(next);
    saveAppData(next);
  }, []);

  const actions = {
    addProduct: (input: ProductInput) => {
      if (!data) return;
      persist(addProduct(data, input));
    },
    updateProduct: (id: string, input: ProductInput) => {
      if (!data) return;
      persist(updateProduct(data, id, input));
    },
    deleteProduct: (id: string) => {
      if (!data) return;
      persist(deleteProduct(data, id));
    },
    stockIn: (productId: string, qty: number, note?: string) => {
      if (!data || qty <= 0) return;
      persist(adjustStock(data, productId, qty, "in", note));
    },
    stockOut: (productId: string, qty: number, note?: string) => {
      if (!data || qty <= 0) return;
      persist(adjustStock(data, productId, qty, "out", note));
    },
    createSale: (
      lines: { productId: string; qty: number }[],
      paymentMethod: PaymentMethod,
      customerName?: string,
    ) => {
      if (!data) return false;
      const before = data.sales.length;
      const next = createSale(data, lines, paymentMethod, customerName);
      if (next.sales.length === before) return false;
      persist(next);
      return true;
    },
    resetAll: () => {
      clearAppData();
      const empty = loadAppData();
      setData(empty);
    },
  };

  return { data, ready, ...actions };
}
