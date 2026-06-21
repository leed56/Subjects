"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/components/auth-provider";
import type { PaymentMethod } from "@/lib/types";
import type { BusinessInfo } from "@/lib/invoice";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { getPlan } from "@/lib/subscription/plans";
import {
  pushBusinessData,
  syncBusinessData,
} from "@/lib/supabase/business-sync";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  addACJob,
  addBankAccount,
  addBankTransaction,
  addBankTransfer,
  addCheque,
  addContractor,
  addCustomer,
  addProduct,
  addSupplier,
  addTechnician,
  addVehicle,
  adjustStock,
  createPurchase,
  createSale,
  deleteACJob,
  deleteBankAccount,
  deleteBankTransaction,
  deleteContractor,
  deleteCustomer,
  deleteProduct,
  deleteSupplier,
  deleteTechnician,
  deleteVehicle,
  recordACService,
  recordContractorPayment,
  updateContractor,
  updateTechnician,
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
import { clearAppData, loadAppData, saveAppData, setStorageOrgId } from "./storage";
import type {
  AppData,
  ACJobInput,
  BankAccountInput,
  BankTransactionInput,
  BankTransferInput,
  ChequeInput,
  ChequeStatus,
  ContractorInput,
  TechnicianInput,
  CustomerInput,
  ProductInput,
  PurchaseInput,
  SaleOptions,
  SupplierInput,
  RecordACServiceInput,
  VehicleInput,
  VehicleSaleInput,
} from "./types";

export type AppStoreValue = {
  data: AppData | null;
  ready: boolean;
  cloudSyncing: boolean;
  cloudSyncError: string | null;
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
  addBankTransaction: (input: BankTransactionInput) => boolean;
  deleteBankTransaction: (id: string) => void;
  addBankTransfer: (input: BankTransferInput) => boolean;
  addCheque: (input: ChequeInput) => void;
  updateChequeStatus: (
    chequeId: string,
    status: ChequeStatus,
    bankAccountId?: string,
  ) => void;
  createSale: (
    lines: { productId: string; qty: number; unitPrice?: number }[],
    paymentMethod: PaymentMethod,
    options?: SaleOptions,
  ) => string | false;
  updateBusiness: (business: BusinessInfo) => void;
  addACJob: (input: ACJobInput) => void;
  updateACJob: (id: string, input: Partial<ACJobInput>) => void;
  deleteACJob: (id: string) => void;
  recordACService: (jobId: string, input?: RecordACServiceInput) => void;
  addTechnician: (input: TechnicianInput) => void;
  updateTechnician: (id: string, input: Partial<TechnicianInput>) => void;
  deleteTechnician: (id: string) => void;
  addContractor: (input: ContractorInput) => void;
  updateContractor: (id: string, input: Partial<ContractorInput>) => void;
  deleteContractor: (id: string) => void;
  recordContractorPayment: (
    contractorId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => boolean;
  addVehicle: (input: VehicleInput) => boolean;
  updateVehicle: (id: string, input: Partial<VehicleInput>) => void;
  sellVehicle: (input: VehicleSaleInput) => boolean;
  deleteVehicle: (id: string) => void;
  resetAll: () => void;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

const CLOUD_SYNC_DEBOUNCE_MS = 1500;

function useAppStoreState(): AppStoreValue {
  const { user } = useAuth();
  const { org, isReadOnly, subscription, can } = useSubscription();
  const [data, setData] = useState<AppData | null>(null);
  const [ready, setReady] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const cloudLoadedRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<AppData | null>(null);

  useEffect(() => {
    setStorageOrgId(org.id);
    const initial = loadAppData(org.id);
    setData(initial);
    latestDataRef.current = initial;
    setReady(true);
    cloudLoadedRef.current = false;
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
  }, [org.id]);

  useEffect(() => {
    if (!org.id) {
      setStorageOrgId(null);
    }
  }, [org.id]);

  const scheduleCloudPush = useCallback(
    (next: AppData) => {
      if (!isSupabaseConfigured() || !user || !org.id || !org.isAuthenticated) {
        return;
      }

      latestDataRef.current = next;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        const payload = latestDataRef.current;
        if (!payload || !org.id) return;
        setCloudSyncing(true);
        void pushBusinessData(org.id, payload).then((err) => {
          setCloudSyncing(false);
          setCloudSyncError(err);
        });
      }, CLOUD_SYNC_DEBOUNCE_MS);
    },
    [org.id, org.isAuthenticated, user],
  );

  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!ready || !user || !org.id || !org.isAuthenticated) {
      cloudLoadedRef.current = false;
      return;
    }

    if (cloudLoadedRef.current) return;

    let cancelled = false;
    const local = loadAppData(org.id);

    setCloudSyncing(true);
    setCloudSyncError(null);

    void syncBusinessData(org.id, local).then(({ data: synced, error }) => {
      if (cancelled) return;
      cloudLoadedRef.current = true;
      setData(synced);
      latestDataRef.current = synced;
      saveAppData(synced, org.id);
      setCloudSyncing(false);
      setCloudSyncError(error);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, user, org.id, org.isAuthenticated]);

  const persist = useCallback(
    (next: AppData) => {
      if (isReadOnly || !can("write")) return;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);
      scheduleCloudPush(next);
    },
    [isReadOnly, can, org.id, scheduleCloudPush],
  );

  const canAddProduct = useCallback(
    (current: AppData) => {
      const plan = getPlan(subscription.planId);
      if (plan.maxProducts == null) return true;
      return current.products.length < plan.maxProducts;
    },
    [subscription.planId],
  );

  return useMemo(() => {
    const store: AppStoreValue = {
      data,
      ready,
      cloudSyncing,
      cloudSyncError,
      addProduct: (input) => {
        if (!data || isReadOnly || !canAddProduct(data)) return;
        persist(addProduct(data, input));
      },
      updateProduct: (id, input) => {
        if (!data || isReadOnly) return;
        persist(updateProduct(data, id, input));
      },
      deleteProduct: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteProduct(data, id));
      },
      stockIn: (productId, qty, note) => {
        if (!data || isReadOnly || qty <= 0) return;
        persist(adjustStock(data, productId, qty, "in", note));
      },
      stockOut: (productId, qty, note) => {
        if (!data || isReadOnly || qty <= 0) return;
        persist(adjustStock(data, productId, qty, "out", note));
      },
      addCustomer: (input) => {
        if (!data || isReadOnly) return;
        persist(addCustomer(data, input));
      },
      updateCustomer: (id, input) => {
        if (!data || isReadOnly) return;
        persist(updateCustomer(data, id, input));
      },
      deleteCustomer: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteCustomer(data, id));
      },
      addSupplier: (input) => {
        if (!data || isReadOnly) return;
        persist(addSupplier(data, input));
      },
      updateSupplier: (id, input) => {
        if (!data || isReadOnly) return;
        persist(updateSupplier(data, id, input));
      },
      deleteSupplier: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteSupplier(data, id));
      },
      createPurchase: (input) => {
        if (!data || isReadOnly) return false;
        const before = data.purchases.length;
        const next = createPurchase(data, input);
        if (next.purchases.length === before) return false;
        persist(next);
        return true;
      },
      recordSupplierPayment: (supplierId, amount, method, note) => {
        if (!data || isReadOnly) return false;
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
        if (!data || isReadOnly) return false;
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
        if (!data || isReadOnly) return;
        persist(addBankAccount(data, input));
      },
      deleteBankAccount: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteBankAccount(data, id));
      },
      addBankTransaction: (input) => {
        if (!data || isReadOnly) return false;
        const before = data.bankTransactions.length;
        const next = addBankTransaction(data, input);
        if (next.bankTransactions.length === before) return false;
        persist(next);
        return true;
      },
      deleteBankTransaction: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteBankTransaction(data, id));
      },
      addBankTransfer: (input) => {
        if (!data || isReadOnly) return false;
        const before = data.bankTransfers.length;
        const next = addBankTransfer(data, input);
        if (next.bankTransfers.length === before) return false;
        persist(next);
        return true;
      },
      addCheque: (input) => {
        if (!data || isReadOnly) return;
        persist(addCheque(data, input));
      },
      updateChequeStatus: (chequeId, status, bankAccountId) => {
        if (!data || isReadOnly) return;
        persist(updateChequeStatus(data, chequeId, status, bankAccountId));
      },
      createSale: (lines, paymentMethod, options) => {
        if (!data || isReadOnly) return false;
        const before = data.sales.length;
        const next = createSale(data, lines, paymentMethod, options);
        if (next.sales.length === before) return false;
        persist(next);
        return next.sales[0].id;
      },
      updateBusiness: (business) => {
        if (isReadOnly || !can("write")) return;
        setData((current) => {
          const base = current ?? loadAppData(org.id);
          const next = mergeBusiness(base, business);
          latestDataRef.current = next;
          saveAppData(next, org.id);
          scheduleCloudPush(next);
          return next;
        });
      },
      addACJob: (input) => {
        if (!data || isReadOnly) return;
        persist(addACJob(data, input));
      },
      updateACJob: (id, input) => {
        if (!data || isReadOnly) return;
        persist(updateACJob(data, id, input));
      },
      deleteACJob: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteACJob(data, id));
      },
      recordACService: (jobId, input) => {
        if (!data || isReadOnly) return;
        persist(recordACService(data, jobId, input));
      },
      addTechnician: (input) => {
        if (!data || isReadOnly) return;
        persist(addTechnician(data, input));
      },
      updateTechnician: (id, input) => {
        if (!data || isReadOnly) return;
        persist(updateTechnician(data, id, input));
      },
      deleteTechnician: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteTechnician(data, id));
      },
      addContractor: (input) => {
        if (!data || isReadOnly) return;
        persist(addContractor(data, input));
      },
      updateContractor: (id, input) => {
        if (!data || isReadOnly) return;
        persist(updateContractor(data, id, input));
      },
      deleteContractor: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteContractor(data, id));
      },
      recordContractorPayment: (contractorId, amount, method, note) => {
        if (!data || isReadOnly) return false;
        const before = data.contractorPayments.length;
        const next = recordContractorPayment(data, contractorId, amount, method, note);
        if (next.contractorPayments.length === before) return false;
        persist(next);
        return true;
      },
      addVehicle: (input) => {
        if (!data || isReadOnly) return false;
        const before = data.vehicles.length;
        const next = addVehicle(data, input);
        if (next.vehicles.length === before) return false;
        persist(next);
        return true;
      },
      updateVehicle: (id, input) => {
        if (!data || isReadOnly) return;
        persist(updateVehicle(data, id, input));
      },
      sellVehicle: (input) => {
        if (!data || isReadOnly) return false;
        const v = data.vehicles.find((x) => x.id === input.vehicleId);
        if (!v || v.status === "sold") return false;
        const next = sellVehicle(data, input);
        persist(next);
        return true;
      },
      deleteVehicle: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteVehicle(data, id));
      },
      resetAll: () => {
        clearAppData(org.id);
        const fresh = loadAppData(org.id);
        setData(fresh);
        latestDataRef.current = fresh;
      },
    };
    return store;
  }, [
    data,
    ready,
    cloudSyncing,
    cloudSyncError,
    isReadOnly,
    can,
    canAddProduct,
    persist,
    scheduleCloudPush,
  ]);
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
