"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PaymentMethod } from "@/lib/types";
import type { BusinessInfo } from "@/lib/invoice";
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
  updateBusiness as mergeBusiness,
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

export type AppStoreValue = {
  data: AppData | null;
  ready: boolean;
  addProduct: (input: ProductInput) => void;
  updateProduct: (id: string, input: ProductInput) => void;
  deleteProduct: (id: string) => void;
  stockIn: (productId: string, qty: number, note?: string) => void;
  stockOut: (productId: string, qty: number, note?: string) => void;
  addCustomer: (input: CustomerInput) => void;
  updateCustomer: (id: string, input: CustomerInput) => void;
  deleteCustomer: (id: string) => void;
  addSupplier: (input: SupplierInput) => void;
  updateSupplier: (id: string, input: SupplierInput) => void;
  deleteSupplier: (id: string) => void;
  createPurchase: (input: PurchaseInput) => boolean;
  recordSupplierPayment: (
    supplierId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => boolean;
  recordCustomerPayment: (
    customerId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => boolean;
  addBankAccount: (input: BankAccountInput) => void;
  deleteBankAccount: (id: string) => void;
  addCheque: (input: ChequeInput) => void;
  updateChequeStatus: (
    chequeId: string,
    status: ChequeStatus,
    bankAccountId?: string,
  ) => void;
  createSale: (
    lines: { productId: string; qty: number }[],
    paymentMethod: PaymentMethod,
    options?: SaleOptions,
  ) => string | false;
  updateBusiness: (business: BusinessInfo) => void;
  addACJob: (input: ACJobInput) => void;
  updateACJob: (id: string, input: Partial<ACJobInput>) => void;
  deleteACJob: (id: string) => void;
  addVehicle: (input: VehicleInput) => boolean;
  updateVehicle: (id: string, input: Partial<VehicleInput>) => void;
  sellVehicle: (input: VehicleSaleInput) => boolean;
  deleteVehicle: (id: string) => void;
  resetAll: () => void;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

function useAppStoreState(): AppStoreValue {
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

  return useMemo(() => {
    const store: AppStoreValue = {
      data,
      ready,
      addProduct: (input) => {
        if (!data) return;
        persist(addProduct(data, input));
      },
      updateProduct: (id, input) => {
        if (!data) return;
        persist(updateProduct(data, id, input));
      },
      deleteProduct: (id) => {
        if (!data) return;
        persist(deleteProduct(data, id));
      },
      stockIn: (productId, qty, note) => {
        if (!data || qty <= 0) return;
        persist(adjustStock(data, productId, qty, "in", note));
      },
      stockOut: (productId, qty, note) => {
        if (!data || qty <= 0) return;
        persist(adjustStock(data, productId, qty, "out", note));
      },
      addCustomer: (input) => {
        if (!data) return;
        persist(addCustomer(data, input));
      },
      updateCustomer: (id, input) => {
        if (!data) return;
        persist(updateCustomer(data, id, input));
      },
      deleteCustomer: (id) => {
        if (!data) return;
        persist(deleteCustomer(data, id));
      },
      addSupplier: (input) => {
        if (!data) return;
        persist(addSupplier(data, input));
      },
      updateSupplier: (id, input) => {
        if (!data) return;
        persist(updateSupplier(data, id, input));
      },
      deleteSupplier: (id) => {
        if (!data) return;
        persist(deleteSupplier(data, id));
      },
      createPurchase: (input) => {
        if (!data) return false;
        const before = data.purchases.length;
        const next = createPurchase(data, input);
        if (next.purchases.length === before) return false;
        persist(next);
        return true;
      },
      recordSupplierPayment: (supplierId, amount, method, note) => {
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
      recordCustomerPayment: (customerId, amount, method, note) => {
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
      addBankAccount: (input) => {
        if (!data) return;
        persist(addBankAccount(data, input));
      },
      deleteBankAccount: (id) => {
        if (!data) return;
        persist(deleteBankAccount(data, id));
      },
      addCheque: (input) => {
        if (!data) return;
        persist(addCheque(data, input));
      },
      updateChequeStatus: (chequeId, status, bankAccountId) => {
        if (!data) return;
        persist(updateChequeStatus(data, chequeId, status, bankAccountId));
      },
      createSale: (lines, paymentMethod, options) => {
        if (!data) return false;
        const before = data.sales.length;
        const next = createSale(data, lines, paymentMethod, options);
        if (next.sales.length === before) return false;
        persist(next);
        return next.sales[0].id;
      },
      updateBusiness: (business) => {
        setData((current) => {
          const base = current ?? loadAppData();
          const next = mergeBusiness(base, business);
          saveAppData(next);
          return next;
        });
      },
      addACJob: (input) => {
        if (!data) return;
        persist(addACJob(data, input));
      },
      updateACJob: (id, input) => {
        if (!data) return;
        persist(updateACJob(data, id, input));
      },
      deleteACJob: (id) => {
        if (!data) return;
        persist(deleteACJob(data, id));
      },
      addVehicle: (input) => {
        if (!data) return false;
        const before = data.vehicles.length;
        const next = addVehicle(data, input);
        if (next.vehicles.length === before) return false;
        persist(next);
        return true;
      },
      updateVehicle: (id, input) => {
        if (!data) return;
        persist(updateVehicle(data, id, input));
      },
      sellVehicle: (input) => {
        if (!data) return false;
        const v = data.vehicles.find((x) => x.id === input.vehicleId);
        if (!v || v.status === "sold") return false;
        const next = sellVehicle(data, input);
        persist(next);
        return true;
      },
      deleteVehicle: (id) => {
        if (!data) return;
        persist(deleteVehicle(data, id));
      },
      resetAll: () => {
        clearAppData();
        setData(loadAppData());
      },
    };
    return store;
  }, [data, ready, persist]);
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const store = useAppStoreState();
  return (
    <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error("useAppStore must be used within AppStoreProvider");
  }
  return ctx;
}
