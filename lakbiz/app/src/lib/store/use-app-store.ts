"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentMethod } from "@/lib/types";
import {
  addBankAccount,
  addCheque,
  addCustomer,
  addProduct,
  adjustStock,
  createSale,
  deleteBankAccount,
  deleteCustomer,
  deleteProduct,
  recordCustomerPayment,
  updateChequeStatus,
  updateCustomer,
  updateProduct,
} from "./actions";
import { clearAppData, loadAppData, saveAppData } from "./storage";
import type {
  AppData,
  BankAccountInput,
  ChequeInput,
  ChequeStatus,
  CustomerInput,
  ProductInput,
  SaleOptions,
} from "./types";

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
    addCustomer: (input: CustomerInput) => {
      if (!data) return;
      persist(addCustomer(data, input));
    },
    updateCustomer: (id: string, input: CustomerInput) => {
      if (!data) return;
      persist(updateCustomer(data, id, input));
    },
    deleteCustomer: (id: string) => {
      if (!data) return;
      persist(deleteCustomer(data, id));
    },
    recordCustomerPayment: (
      customerId: string,
      amount: number,
      method: PaymentMethod,
      note?: string,
    ) => {
      if (!data) return false;
      const before = data.customerPayments.length;
      const next = recordCustomerPayment(
        data,
        customerId,
        amount,
        method,
        note,
      );
      if (next.customerPayments.length === before) return false;
      persist(next);
      return true;
    },
    addBankAccount: (input: BankAccountInput) => {
      if (!data) return;
      persist(addBankAccount(data, input));
    },
    deleteBankAccount: (id: string) => {
      if (!data) return;
      persist(deleteBankAccount(data, id));
    },
    addCheque: (input: ChequeInput) => {
      if (!data) return;
      persist(addCheque(data, input));
    },
    updateChequeStatus: (
      chequeId: string,
      status: ChequeStatus,
      bankAccountId?: string,
    ) => {
      if (!data) return;
      persist(updateChequeStatus(data, chequeId, status, bankAccountId));
    },
    createSale: (
      lines: { productId: string; qty: number }[],
      paymentMethod: PaymentMethod,
      options?: SaleOptions,
    ) => {
      if (!data) return false;
      const before = data.sales.length;
      const next = createSale(data, lines, paymentMethod, options);
      if (next.sales.length === before) return false;
      persist(next);
      return true;
    },
    resetAll: () => {
      clearAppData();
      setData(loadAppData());
    },
  };

  return { data, ready, ...actions };
}
