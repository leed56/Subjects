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
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { useOfflineLeaveGuard } from "@/hooks/use-offline-leave-guard";
import type { PaymentMethod } from "@/lib/types";
import type { BusinessInfo } from "@/lib/invoice";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import {
  canUseBankingModule,
  canUseSuppliersModule,
} from "@/lib/org-role/permissions";
import { stripFinancialData } from "@/lib/org-role/strip-financials";
import { getPlan } from "@/lib/subscription/plans";
import {
  pushBusinessData,
  pullBusinessData,
  pullRemoteIfNewer,
  syncBusinessData,
  fetchCloudSyncWatermark,
  isEmptyBusinessData,
} from "@/lib/supabase/business-sync";
import { localDataWatermark } from "@/lib/supabase/sync-watermark";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isBrowserOnline, useOnlineStatus } from "@/lib/offline/connectivity";
import {
  bumpOfflinePendingChange,
  clearOfflinePendingSync,
  getOfflinePendingSync,
  hasOfflinePendingSync,
  touchOfflinePending,
} from "@/lib/offline/pending-sync";
import {
  CLOUD_SYNC_MAX_RETRIES,
  cloudSyncRetryDelayMs,
  withCloudSyncRetry,
} from "@/lib/offline/sync-retry";
import {
  hasSyncConflict,
  mergeAppData,
  summarizeSyncConflict,
  type SyncConflictResolution,
  type SyncConflictSummary,
} from "@/lib/offline/sync-conflict";
import { SyncConflictDialog } from "@/components/sync-conflict-dialog";
import {
  addACJob,
  addBankAccount,
  addBankTransaction,
  addBankTransfer,
  addCheque,
  addContractor,
  addCustomer,
  addJobItem,
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
  deleteJobItem,
  deleteProduct,
  deleteSupplier,
  deleteTechnician,
  deleteVehicle,
  recordACService,
  recordContractorPayment,
  updateContractor,
  updateTechnician,
  setCustomerProductPrice,
  removeCustomerProductPrice,
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
import { normalizeProductCategory, parseSectorId } from "@/lib/sectors";
import type {
  AppData,
  ACJobInput,
  BankAccountInput,
  BankTransactionInput,
  BankTransferInput,
  ChequeInput,
  ChequeStatus,
  ContractorInput,
  JobItemInput,
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
import type { SectorId } from "@/lib/types";

export type AppStoreValue = {
  data: AppData | null;
  ready: boolean;
  cloudSyncing: boolean;
  cloudSyncError: string | null;
  cloudRemoteNotice: boolean;
  offlinePendingSync: boolean;
  offlinePendingChangeCount: number;
  syncConflict: SyncConflictSummary | null;
  retryCloudSync: () => void;
  resolveSyncConflict: (resolution: SyncConflictResolution) => void;
  dismissCloudRemoteNotice: () => void;
  addProduct: (input: ProductInput) => boolean;
  updateProduct: (id: string, input: ProductInput) => boolean;
  deleteProduct: (id: string) => void;
  stockIn: (productId: string, qty: number, note?: string) => void;
  stockOut: (productId: string, qty: number, note?: string) => void;
  addCustomer: (input: CustomerInput) => boolean;
  updateCustomer: (id: string, input: CustomerInput) => boolean;
  deleteCustomer: (id: string) => void;
  setCustomerProductPrice: (
    customerId: string,
    productId: string,
    price: number,
  ) => boolean;
  removeCustomerProductPrice: (customerId: string, productId: string) => boolean;
  addSupplier: (input: SupplierInput) => boolean;
  updateSupplier: (id: string, input: SupplierInput) => boolean;
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
  addBankAccount: (input: BankAccountInput) => boolean;
  deleteBankAccount: (id: string) => void;
  addBankTransaction: (input: BankTransactionInput) => boolean;
  deleteBankTransaction: (id: string) => void;
  addBankTransfer: (input: BankTransferInput) => boolean;
  addCheque: (input: ChequeInput) => boolean;
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
  addACJob: (input: ACJobInput) => boolean;
  updateACJob: (id: string, input: Partial<ACJobInput>) => boolean;
  deleteACJob: (id: string) => void;
  recordACService: (jobId: string, input?: RecordACServiceInput) => boolean;
  addJobItem: (input: JobItemInput) => boolean;
  deleteJobItem: (id: string) => boolean;
  addTechnician: (input: TechnicianInput) => boolean;
  updateTechnician: (id: string, input: Partial<TechnicianInput>) => void;
  deleteTechnician: (id: string) => void;
  addContractor: (input: ContractorInput) => boolean;
  updateContractor: (id: string, input: Partial<ContractorInput>) => void;
  deleteContractor: (id: string) => void;
  recordContractorPayment: (
    contractorId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => boolean;
  addVehicle: (input: VehicleInput) => boolean;
  updateVehicle: (id: string, input: Partial<VehicleInput>) => boolean;
  sellVehicle: (input: VehicleSaleInput) => boolean;
  deleteVehicle: (id: string) => void;
  resetAll: () => void;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

const CLOUD_SYNC_DEBOUNCE_MS = 1500;
const CLOUD_POLL_MS = 60_000;

function normalizeProductForShop(
  input: ProductInput,
  shopSector: SectorId,
): ProductInput {
  return {
    ...input,
    sectorId: shopSector,
    category: normalizeProductCategory(shopSector, input.category),
  };
}

function useAppStoreState(): AppStoreValue {
  const { user } = useAuth();
  const { org, isReadOnly, subscription, can, orgRole, canSeeFinancials } =
    useSubscription();
  const isOnline = useOnlineStatus();
  const [data, setData] = useState<AppData | null>(null);
  const [ready, setReady] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [cloudRemoteNotice, setCloudRemoteNotice] = useState(false);
  const [offlinePendingSync, setOfflinePendingSync] = useState(false);
  const [offlinePendingChangeCount, setOfflinePendingChangeCount] = useState(0);
  const [syncConflict, setSyncConflict] = useState<{
    summary: SyncConflictSummary;
    local: AppData;
    remote: AppData;
    cloudTs: number;
  } | null>(null);
  const cloudLoadedRef = useRef(false);
  const lastCloudWatermarkRef = useRef(0);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const skipConflictCheckRef = useRef(false);
  const latestDataRef = useRef<AppData | null>(null);

  const raiseSyncConflict = useCallback(
    (local: AppData, remote: AppData, cloudTs: number) => {
      setSyncConflict({
        summary: summarizeSyncConflict(local, remote),
        local,
        remote,
        cloudTs,
      });
      setCloudSyncing(false);
      setCloudRemoteNotice(false);
    },
    [],
  );

  const refreshOfflinePendingState = useCallback((orgId: string) => {
    const info = getOfflinePendingSync(orgId);
    setOfflinePendingSync(info != null);
    setOfflinePendingChangeCount(info?.changeCount ?? 0);
  }, []);

  useEffect(() => {
    setStorageOrgId(org.id);
    const initial = loadAppData(org.id);
    setData(initial);
    latestDataRef.current = initial;
    setReady(true);
    cloudLoadedRef.current = false;
    lastCloudWatermarkRef.current = 0;
    setCloudRemoteNotice(false);
    setSyncConflict(null);
    if (org.id) refreshOfflinePendingState(org.id);
    else {
      setOfflinePendingSync(false);
      setOfflinePendingChangeCount(0);
    }
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryAttemptRef.current = 0;
  }, [org.id, refreshOfflinePendingState]);

  useEffect(() => {
    if (!isOnline) {
      setCloudSyncError(null);
    }
  }, [isOnline]);

  useEffect(() => {
    if (!org.id) {
      setStorageOrgId(null);
    }
  }, [org.id]);

  const executeCloudPush = useCallback(
    async (
      payload: AppData,
      orgId: string,
    ): Promise<{ err: string | null; conflict: boolean }> => {
      const cloudTs = await fetchCloudSyncWatermark(orgId);
      const localTs = localDataWatermark(payload, orgId);

      if (cloudTs > localTs) {
        const pulled = await pullRemoteIfNewer(
          orgId,
          payload,
          lastCloudWatermarkRef.current,
        );
        lastCloudWatermarkRef.current = Math.max(
          lastCloudWatermarkRef.current,
          pulled.cloudTs,
        );
        if (pulled.refreshed) {
          if (hasSyncConflict(payload, pulled.data)) {
            raiseSyncConflict(payload, pulled.data, pulled.cloudTs);
            return { err: null, conflict: true };
          }
          setData(pulled.data);
          latestDataRef.current = pulled.data;
          saveAppData(pulled.data, orgId);
          setCloudRemoteNotice(true);
          setCloudSyncError(null);
          clearOfflinePendingSync(orgId);
          refreshOfflinePendingState(orgId);
        }
        return { err: pulled.error, conflict: false };
      }

      if (!skipConflictCheckRef.current) {
        const cloud = await pullBusinessData(orgId, payload.business);
        if (cloud && !isEmptyBusinessData(cloud) && hasSyncConflict(payload, cloud)) {
          raiseSyncConflict(payload, cloud, cloudTs);
          return { err: null, conflict: true };
        }
      }

      const err = await withCloudSyncRetry(
        () =>
          pushBusinessData(orgId, payload, {
            preserveBuyPrices: !canSeeFinancials,
          }),
        (error) => error != null,
      );

      if (!err) {
        lastCloudWatermarkRef.current = await fetchCloudSyncWatermark(orgId);
        setCloudRemoteNotice(false);
        clearOfflinePendingSync(orgId);
        refreshOfflinePendingState(orgId);
      }

      skipConflictCheckRef.current = false;
      return { err, conflict: false };
    },
    [canSeeFinancials, refreshOfflinePendingState, raiseSyncConflict],
  );

  const scheduleRetryPush = useCallback(() => {
    if (!org.id || retryTimerRef.current) return;
    const attempt = retryAttemptRef.current;
    if (attempt >= CLOUD_SYNC_MAX_RETRIES) return;

    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      retryAttemptRef.current += 1;
      const payload = latestDataRef.current;
      if (!payload || !org.id || !isBrowserOnline()) return;

      setCloudSyncing(true);
      void executeCloudPush(payload, org.id).then(({ err, conflict }) => {
        if (conflict) return;
        setCloudSyncing(false);
        setCloudSyncError(err);
        if (!err) {
          retryAttemptRef.current = 0;
          return;
        }
        touchOfflinePending(org.id!);
        refreshOfflinePendingState(org.id!);
        scheduleRetryPush();
      });
    }, cloudSyncRetryDelayMs(attempt));
  }, [org.id, executeCloudPush, refreshOfflinePendingState]);

  const runCloudPush = useCallback(
    (payload: AppData) => {
      if (!org.id || syncConflict) return;
      setCloudSyncing(true);
      setCloudSyncError(null);
      retryAttemptRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      void executeCloudPush(payload, org.id).then(({ err, conflict }) => {
        if (conflict) return;
        setCloudSyncing(false);
        setCloudSyncError(err);
        if (!err) {
          retryAttemptRef.current = 0;
          return;
        }
        touchOfflinePending(org.id!);
        refreshOfflinePendingState(org.id!);
        scheduleRetryPush();
      });
    },
    [org.id, syncConflict, executeCloudPush, refreshOfflinePendingState, scheduleRetryPush],
  );

  const scheduleCloudPush = useCallback(
    (next: AppData) => {
      if (!isSupabaseConfigured() || !user || !org.id || !org.isAuthenticated) {
        return;
      }
      if (syncConflict) return;

      latestDataRef.current = next;
      if (!isBrowserOnline()) return;

      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushTimerRef.current = null;
        const payload = latestDataRef.current;
        if (!payload || !org.id) return;
        runCloudPush(payload);
      }, CLOUD_SYNC_DEBOUNCE_MS);
    },
    [org.id, org.isAuthenticated, user, runCloudPush, syncConflict],
  );

  const retryCloudSync = useCallback(() => {
    const payload = latestDataRef.current;
    if (!payload || !org.id || !isBrowserOnline()) return;
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    runCloudPush(payload);
  }, [org.id, runCloudPush]);

  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!ready || !user || !org.id || !org.isAuthenticated) {
      cloudLoadedRef.current = false;
      return;
    }

    if (!isOnline) {
      setCloudSyncing(false);
      setCloudSyncError(null);
      return;
    }

    if (cloudLoadedRef.current) return;

    let cancelled = false;
    const local = loadAppData(org.id);

    setCloudSyncing(true);
    setCloudSyncError(null);

    void syncBusinessData(org.id, local).then(async ({ data: synced, error }) => {
      if (cancelled) return;
      cloudLoadedRef.current = true;
      setData(synced);
      latestDataRef.current = synced;
      saveAppData(synced, org.id);
      lastCloudWatermarkRef.current = await fetchCloudSyncWatermark(org.id!);
      if (!error) {
        clearOfflinePendingSync(org.id!);
        refreshOfflinePendingState(org.id!);
      }
      setCloudSyncing(false);
      setCloudSyncError(error);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, user, org.id, org.isAuthenticated, isOnline, refreshOfflinePendingState]);

  useEffect(() => {
    if (!ready || !user || !org.id || !org.isAuthenticated || !isOnline) return;

    const payload = latestDataRef.current;
    if (payload && hasOfflinePendingSync(org.id)) {
      scheduleCloudPush(payload);
    }
  }, [isOnline, ready, user, org.id, org.isAuthenticated, scheduleCloudPush]);

  useEffect(() => {
    if (!ready || !user || !org.id || !org.isAuthenticated) return;

    const pullIfIdle = () => {
      if (!isBrowserOnline()) return;
      if (syncConflict) return;
      if (document.visibilityState === "hidden") return;
      if (pushTimerRef.current) return;
      const payload = latestDataRef.current;
      if (!payload || !org.id) return;

      const localTs = localDataWatermark(payload, org.id);
      if (localTs > lastCloudWatermarkRef.current) return;

      void pullRemoteIfNewer(org.id, payload, lastCloudWatermarkRef.current).then(
        (result) => {
          lastCloudWatermarkRef.current = Math.max(
            lastCloudWatermarkRef.current,
            result.cloudTs,
          );
          if (!result.refreshed) return;
          if (hasSyncConflict(payload, result.data)) {
            raiseSyncConflict(payload, result.data, result.cloudTs);
            return;
          }
          setData(result.data);
          latestDataRef.current = result.data;
          saveAppData(result.data, org.id);
          setCloudRemoteNotice(true);
          setCloudSyncError(null);
        },
      );
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") pullIfIdle();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", pullIfIdle);
    const interval = window.setInterval(pullIfIdle, CLOUD_POLL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", pullIfIdle);
      window.clearInterval(interval);
    };
  }, [ready, user, org.id, org.isAuthenticated, syncConflict, raiseSyncConflict]);

  const dismissCloudRemoteNotice = useCallback(() => {
    setCloudRemoteNotice(false);
  }, []);

  const resolveSyncConflict = useCallback(
    (resolution: SyncConflictResolution) => {
      if (!syncConflict || !org.id) return;

      const pending = syncConflict;
      const orgId = org.id;
      setSyncConflict(null);
      setCloudSyncing(true);
      setCloudSyncError(null);

      void (async () => {
        let next: AppData;
        if (resolution === "keep_local") {
          next = pending.local;
          skipConflictCheckRef.current = true;
        } else if (resolution === "use_remote") {
          next = pending.remote;
        } else {
          next = mergeAppData(pending.local, pending.remote);
        }

        setData(next);
        latestDataRef.current = next;
        saveAppData(next, orgId);

        if (resolution === "use_remote") {
          lastCloudWatermarkRef.current = pending.cloudTs;
          clearOfflinePendingSync(orgId);
          refreshOfflinePendingState(orgId);
          setCloudSyncing(false);
          return;
        }

        const err = await withCloudSyncRetry(
          () =>
            pushBusinessData(orgId, next, {
              preserveBuyPrices: !canSeeFinancials,
            }),
          (error) => error != null,
        );
        skipConflictCheckRef.current = false;

        if (!err) {
          lastCloudWatermarkRef.current = await fetchCloudSyncWatermark(orgId);
          clearOfflinePendingSync(orgId);
          refreshOfflinePendingState(orgId);
        } else {
          touchOfflinePending(orgId);
          refreshOfflinePendingState(orgId);
          setCloudSyncError(err);
        }
        setCloudSyncing(false);
      })();
    },
    [syncConflict, org.id, canSeeFinancials, refreshOfflinePendingState],
  );

  const persist = useCallback(
    (next: AppData): boolean => {
      if (syncConflict) return false;
      if (isReadOnly || !can("write")) return false;
      if (!isOnline && !can("offline")) return false;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);
      if (!isOnline && org.id) {
        bumpOfflinePendingChange(org.id);
        refreshOfflinePendingState(org.id);
      }
      scheduleCloudPush(next);
      return true;
    },
    [syncConflict, isReadOnly, can, isOnline, org.id, scheduleCloudPush, refreshOfflinePendingState],
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
      cloudRemoteNotice,
      offlinePendingSync,
      offlinePendingChangeCount,
      syncConflict: syncConflict?.summary ?? null,
      retryCloudSync,
      resolveSyncConflict,
      dismissCloudRemoteNotice,
      addProduct: (input) => {
        if (!data || !canAddProduct(data)) return false;
        const shopSector = parseSectorId(org.sector);
        const normalized = org.isAuthenticated
          ? normalizeProductForShop(input, shopSector)
          : input;
        return persist(addProduct(data, normalized));
      },
      updateProduct: (id, input) => {
        if (!data) return false;
        const shopSector = parseSectorId(org.sector);
        let normalized = org.isAuthenticated
          ? normalizeProductForShop(input, shopSector)
          : input;
        if (!canSeeFinancials) {
          const existing = data.products.find((p) => p.id === id);
          if (existing) normalized = { ...normalized, buyPrice: existing.buyPrice };
        }
        return persist(updateProduct(data, id, normalized));
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
        if (!data) return false;
        return persist(addCustomer(data, input));
      },
      updateCustomer: (id, input) => {
        if (!data) return false;
        return persist(updateCustomer(data, id, input));
      },
      deleteCustomer: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteCustomer(data, id));
      },
      setCustomerProductPrice: (customerId, productId, price) => {
        if (!data || !can("write")) return false;
        const before = data.customerProductPrices.find(
          (p) => p.customerId === customerId && p.productId === productId,
        )?.price;
        const next = setCustomerProductPrice(data, customerId, productId, price);
        const after = next.customerProductPrices.find(
          (p) => p.customerId === customerId && p.productId === productId,
        )?.price;
        if (before === after && next.customerProductPrices.length === data.customerProductPrices.length) {
          return false;
        }
        return persist(next);
      },
      removeCustomerProductPrice: (customerId, productId) => {
        if (!data || !can("write")) return false;
        const before = data.customerProductPrices.length;
        const next = removeCustomerProductPrice(data, customerId, productId);
        if (next.customerProductPrices.length === before) return false;
        return persist(next);
      },
      addSupplier: (input) => {
        if (!data || !canUseSuppliersModule(orgRole)) return false;
        return persist(addSupplier(data, input));
      },
      updateSupplier: (id, input) => {
        if (!data || !canUseSuppliersModule(orgRole)) return false;
        return persist(updateSupplier(data, id, input));
      },
      deleteSupplier: (id) => {
        if (!data || isReadOnly || !canUseSuppliersModule(orgRole)) return;
        persist(deleteSupplier(data, id));
      },
      createPurchase: (input) => {
        if (!data || !can("write") || !canUseSuppliersModule(orgRole)) return false;
        const before = data.purchases.length;
        const next = createPurchase(data, input);
        if (next.purchases.length === before) return false;
        return persist(next);
      },
      recordSupplierPayment: (supplierId, amount, method, note) => {
        if (!data || !can("write") || !canUseSuppliersModule(orgRole)) return false;
        const before = data.supplierPayments.length;
        const next = recordSupplierPayment(
          data,
          supplierId,
          amount,
          method,
          note,
        );
        if (next.supplierPayments.length === before) return false;
        return persist(next);
      },
      recordCustomerPayment: (customerId, amount, method, note) => {
        if (!data || !can("write")) return false;
        const before = data.customerPayments.length;
        const next = recordCustomerPayment(
          data,
          customerId,
          amount,
          method,
          note,
        );
        if (next.customerPayments.length === before) return false;
        return persist(next);
      },
      addBankAccount: (input) => {
        if (!data || !can("write") || !canUseBankingModule(orgRole)) return false;
        const before = data.bankAccounts.length;
        const next = addBankAccount(data, input);
        if (next.bankAccounts.length === before) return false;
        return persist(next);
      },
      deleteBankAccount: (id) => {
        if (!data || isReadOnly || !canUseBankingModule(orgRole)) return;
        persist(deleteBankAccount(data, id));
      },
      addBankTransaction: (input) => {
        if (!data || !can("write") || !canUseBankingModule(orgRole)) return false;
        const before = data.bankTransactions.length;
        const next = addBankTransaction(data, input);
        if (next.bankTransactions.length === before) return false;
        return persist(next);
      },
      deleteBankTransaction: (id) => {
        if (!data || isReadOnly || !canUseBankingModule(orgRole)) return;
        persist(deleteBankTransaction(data, id));
      },
      addBankTransfer: (input) => {
        if (!data || !can("write") || !canUseBankingModule(orgRole)) return false;
        const before = data.bankTransfers.length;
        const next = addBankTransfer(data, input);
        if (next.bankTransfers.length === before) return false;
        return persist(next);
      },
      addCheque: (input) => {
        if (!data || !can("write") || !canUseBankingModule(orgRole)) return false;
        const before = data.cheques.length;
        const next = addCheque(data, input);
        if (next.cheques.length === before) return false;
        return persist(next);
      },
      updateChequeStatus: (chequeId, status, bankAccountId) => {
        if (!data || isReadOnly || !canUseBankingModule(orgRole)) return;
        persist(updateChequeStatus(data, chequeId, status, bankAccountId));
      },
      createSale: (lines, paymentMethod, options) => {
        if (!data || !can("write")) return false;
        const before = data.sales.length;
        const next = createSale(data, lines, paymentMethod, options);
        if (next.sales.length === before) return false;
        if (!persist(next)) return false;
        return next.sales[0].id;
      },
      updateBusiness: (business) => {
        if (syncConflict) return;
        if (isReadOnly || !can("write") || (!isOnline && !can("offline"))) return;
        setData((current) => {
          const base = current ?? loadAppData(org.id);
          const next = mergeBusiness(base, business);
          latestDataRef.current = next;
          saveAppData(next, org.id);
          if (!isOnline && org.id) {
            bumpOfflinePendingChange(org.id);
            refreshOfflinePendingState(org.id);
          }
          scheduleCloudPush(next);
          return next;
        });
      },
      addACJob: (input) => {
        if (!data) return false;
        const before = data.acJobs.length;
        const next = addACJob(data, input);
        if (next.acJobs.length === before) return false;
        return persist(next);
      },
      updateACJob: (id, input) => {
        if (!data) return false;
        return persist(updateACJob(data, id, input));
      },
      deleteACJob: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteACJob(data, id));
      },
      recordACService: (jobId, input) => {
        if (!data) return false;
        return persist(recordACService(data, jobId, input));
      },
      addJobItem: (input) => {
        if (!data) return false;
        const before = data.jobItems.length;
        const next = addJobItem(data, input);
        if (next.jobItems.length === before) return false;
        return persist(next);
      },
      deleteJobItem: (id) => {
        if (!data) return false;
        return persist(deleteJobItem(data, id));
      },
      addTechnician: (input) => {
        if (!data || !can("write")) return false;
        const next = addTechnician(data, input);
        if (next.technicians.length === data.technicians.length) return false;
        return persist(next);
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
        if (!data || !can("write")) return false;
        const next = addContractor(data, input);
        if (next.contractors.length === data.contractors.length) return false;
        return persist(next);
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
        if (!data || !can("write")) return false;
        const before = data.contractorPayments.length;
        const next = recordContractorPayment(data, contractorId, amount, method, note);
        if (next.contractorPayments.length === before) return false;
        return persist(next);
      },
      addVehicle: (input) => {
        if (!data || !can("write")) return false;
        const before = data.vehicles.length;
        const next = addVehicle(data, input);
        if (next.vehicles.length === before) return false;
        return persist(next);
      },
      updateVehicle: (id, input) => {
        if (!data) return false;
        return persist(updateVehicle(data, id, input));
      },
      sellVehicle: (input) => {
        if (!data || !can("write")) return false;
        const v = data.vehicles.find((x) => x.id === input.vehicleId);
        if (!v || v.status === "sold") return false;
        return persist(sellVehicle(data, input));
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
    cloudRemoteNotice,
    offlinePendingSync,
    offlinePendingChangeCount,
    syncConflict,
    retryCloudSync,
    resolveSyncConflict,
    dismissCloudRemoteNotice,
    isReadOnly,
    isOnline,
    refreshOfflinePendingState,
    can,
    canAddProduct,
    persist,
    scheduleCloudPush,
    org.sector,
    org.id,
    org.isAuthenticated,
    orgRole,
    canSeeFinancials,
  ]);
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const raw = useAppStoreState();
  const { canSeeFinancials } = useSubscription();
  const value = useMemo(
    () => ({
      ...raw,
      data:
        raw.data && !canSeeFinancials ? stripFinancialData(raw.data) : raw.data,
    }),
    [raw, canSeeFinancials],
  );
  return (
    <AppStoreContext.Provider value={value}>
      <ServiceWorkerRegister />
      <OfflineLeaveGuard />
      <SyncConflictLayer summary={raw.syncConflict} resolving={raw.cloudSyncing} />
      {children}
    </AppStoreContext.Provider>
  );
}

function SyncConflictLayer({
  summary,
  resolving,
}: {
  summary: SyncConflictSummary | null;
  resolving: boolean;
}) {
  const { resolveSyncConflict } = useAppStore();
  return (
    <SyncConflictDialog
      summary={summary}
      resolving={resolving}
      onResolve={resolveSyncConflict}
    />
  );
}

function OfflineLeaveGuard() {
  useOfflineLeaveGuard();
  return null;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error("useAppStore must be used within AppStoreProvider");
  }
  return ctx;
}
