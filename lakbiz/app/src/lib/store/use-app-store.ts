"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentMethod } from "@/lib/types";
import {
  addACJob,
  addBankAccount,
  addCheque,
  addCustomer,
  addProduct,
  addSupplier,
  addVehicle,
  adjustStock,
  createPurchase,
  createSale,
  deleteACJob,
  deleteBankAccount,
  deleteCustomer,
  deleteProduct,
  deleteSupplier,
  deleteVehicle,
  recordCustomerPayment,
  recordSupplierPayment,
  sellVehicle,
  updateACJob,
  updateBusiness,
  updateChequeStatus,
  updateCustomer,
  updateProduct,
  updateSupplier,
  updateVehicle,
} from "./actions";
import { clearAppData, loadAppData, saveAppData } from "./storage";
import type {
  AppData,
  ACJobInput,
  BankAccountInput,
  ChequeInput,
  ChequeStatus,
  CustomerInput,
  ProductInput,
  PurchaseInput,
  SaleOptions,
  SupplierInput,
  VehicleInput,
  VehicleSaleInput,
} from "./types";
import type { BusinessInfo } from "@/lib/invoice";

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
    addSupplier: (input: SupplierInput) => {
      if (!data) return;
      persist(addSupplier(data, input));
    },
    updateSupplier: (id: string, input: SupplierInput) => {
      if (!data) return;
      persist(updateSupplier(data, id, input));
    },
    deleteSupplier: (id: string) => {
      if (!data) return;
      persist(deleteSupplier(data, id));
    },
    createPurchase: (input: PurchaseInput) => {
      if (!data) return false;
      const before = data.purchases.length;
      const next = createPurchase(data, input);
      if (next.purchases.length === before) return false;
      persist(next);
      return true;
    },
    recordSupplierPayment: (
      supplierId: string,
      amount: number,
      method: PaymentMethod,
      note?: string,
    ) => {
      if (!data) return false;
      const before = data.supplierPayments.length;
      const next = recordSupplierPayment(
        data,
        supplierId,
        amount,
        method,
        note,
      );
      if (next.supplierPayments.length === before) return false;
      persist(next);
      return true;
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
    ): string | false => {
      if (!data) return false;
      const before = data.sales.length;
      const next = createSale(data, lines, paymentMethod, options);
      if (next.sales.length === before) return false;
      persist(next);
      return next.sales[0].id;
    },
    updateBusiness: (business: BusinessInfo) => {
      if (!data) return;
      persist(updateBusiness(data, business));
    },
    addACJob: (input: ACJobInput) => {
      if (!data) return;
      persist(addACJob(data, input));
    },
    updateACJob: (id: string, input: Partial<ACJobInput>) => {
      if (!data) return;
      persist(updateACJob(data, id, input));
    },
    deleteACJob: (id: string) => {
      if (!data) return;
      persist(deleteACJob(data, id));
    },
    addVehicle: (input: VehicleInput) => {
      if (!data) return false;
      const before = data.vehicles.length;
      const next = addVehicle(data, input);
      if (next.vehicles.length === before) return false;
      persist(next);
      return true;
    },
    updateVehicle: (id: string, input: Partial<VehicleInput>) => {
      if (!data) return;
      persist(updateVehicle(data, id, input));
    },
    sellVehicle: (input: VehicleSaleInput) => {
      if (!data) return false;
      const v = data.vehicles.find((x) => x.id === input.vehicleId);
      if (!v || v.status === "sold") return false;
      const next = sellVehicle(data, input);
      persist(next);
      return true;
    },
    deleteVehicle: (id: string) => {
      if (!data) return;
      persist(deleteVehicle(data, id));
    },
    resetAll: () => {
      clearAppData();
      setData(loadAppData());
    },
  };

  return { data, ready, ...actions };
}
