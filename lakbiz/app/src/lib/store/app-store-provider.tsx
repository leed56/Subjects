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
import {
  canManageAcJobs,
  canOperateAcJobs,
  canUpdateAcJob,
  sanitizeAcJobInputForRole,
  canUseBankingModule,
  canUseSuppliersModule,
} from "@/lib/org-role/permissions";
import { stripFinancialData } from "@/lib/org-role/strip-financials";
import { getPlan } from "@/lib/subscription/plans";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { saveOrgShopSettings } from "@/lib/supabase/org-settings";
import {
  pushBusinessData,
  syncCustomersSnapshot,
  syncProductSnapshot,
  syncSaleSnapshot,
  syncSuppliersSnapshot,
  syncPurchaseSnapshot,
  syncSupplierPaymentSnapshot,
  syncCustomerPaymentSnapshot,
  syncACJobSnapshot,
  syncJobItemSnapshot,
  deleteJobItemFromCloud,
  syncContractorPaymentSnapshot,
  syncBankAccountSnapshot,
  deleteBankAccountFromCloud,
  syncBankTransactionSnapshot,
  syncBankTransactionDeleteSnapshot,
  syncBankTransferSnapshot,
  syncChequeSnapshot,
  syncChequeStatusSnapshot,
  syncVehicleSnapshot,
  deleteVehicleFromCloud,
  syncVehicleSaleSnapshot,
  deleteProductFromCloud,
  deleteACJobFromCloud,
  deleteACJobSnapshot,
  syncCustomerProductPriceSnapshot,
  syncTechnicianSnapshot,
  deleteTechnicianFromCloud,
  syncContractorSnapshot,
  deleteContractorFromCloud,
  pullBusinessData,
  pullRemoteIfNewer,
  syncBusinessData,
  fetchCloudSyncWatermark,
  fetchOrgSyncGeneration,
  isEmptyBusinessData,
} from "@/lib/supabase/business-sync";
import {
  getLocalSyncGeneration,
  localDataWatermark,
  setLocalSyncGeneration,
} from "@/lib/supabase/sync-watermark";
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
  localHasUnsyncedRecordsFromData,
  mergeAppData,
  mergePullWithLocal,
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
import {
  clearAppData,
  emptyAppData,
  loadAppData,
  saveAppData,
  setStorageOrgId,
} from "./storage";
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
  saveProductToCloud: (
    input: ProductInput,
    existingId?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteProduct: (id: string) => void;
  deleteProductToCloud: (id: string) => Promise<{ ok: boolean; error?: string }>;
  stockIn: (productId: string, qty: number, note?: string) => void;
  stockOut: (productId: string, qty: number, note?: string) => void;
  stockInToCloud: (
    productId: string,
    qty: number,
    note?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  stockOutToCloud: (
    productId: string,
    qty: number,
    note?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  addCustomer: (input: CustomerInput) => boolean;
  updateCustomer: (id: string, input: CustomerInput) => boolean;
  saveCustomerToCloud: (
    input: CustomerInput,
    existingId?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteCustomer: (id: string) => void;
  deleteCustomerToCloud: (id: string) => Promise<{ ok: boolean; error?: string }>;
  setCustomerProductPrice: (
    customerId: string,
    productId: string,
    price: number,
  ) => boolean;
  removeCustomerProductPrice: (customerId: string, productId: string) => boolean;
  setCustomerProductPriceToCloud: (
    customerId: string,
    productId: string,
    price: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  removeCustomerProductPriceToCloud: (
    customerId: string,
    productId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  addSupplier: (input: SupplierInput) => boolean;
  updateSupplier: (id: string, input: SupplierInput) => boolean;
  saveSupplierToCloud: (
    input: SupplierInput,
    existingId?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteSupplier: (id: string) => void;
  deleteSupplierToCloud: (id: string) => Promise<{ ok: boolean; error?: string }>;
  createPurchase: (input: PurchaseInput) => boolean;
  createPurchaseToCloud: (
    input: PurchaseInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  recordSupplierPayment: (
    supplierId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => boolean;
  recordSupplierPaymentToCloud: (
    supplierId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  recordCustomerPayment: (
    customerId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => boolean;
  recordCustomerPaymentToCloud: (
    customerId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  addBankAccount: (input: BankAccountInput) => boolean;
  deleteBankAccount: (id: string) => void;
  addBankAccountToCloud: (
    input: BankAccountInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteBankAccountToCloud: (
    id: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  addBankTransaction: (input: BankTransactionInput) => boolean;
  deleteBankTransaction: (id: string) => void;
  addBankTransactionToCloud: (
    input: BankTransactionInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteBankTransactionToCloud: (
    id: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  addBankTransfer: (input: BankTransferInput) => boolean;
  addBankTransferToCloud: (
    input: BankTransferInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  addCheque: (input: ChequeInput) => boolean;
  addChequeToCloud: (
    input: ChequeInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateChequeStatus: (
    chequeId: string,
    status: ChequeStatus,
    bankAccountId?: string,
  ) => void;
  updateChequeStatusToCloud: (
    chequeId: string,
    status: ChequeStatus,
    bankAccountId?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  createSale: (
    lines: { productId: string; qty: number; unitPrice?: number }[],
    paymentMethod: PaymentMethod,
    options?: SaleOptions,
  ) => string | false;
  createSaleToCloud: (
    lines: { productId: string; qty: number; unitPrice?: number }[],
    paymentMethod: PaymentMethod,
    options?: SaleOptions,
  ) => Promise<{ ok: boolean; saleId?: string; error?: string }>;
  updateBusiness: (business: BusinessInfo) => void;
  updateBusinessToCloud: (
    business: Partial<BusinessInfo> & Pick<BusinessInfo, "name">,
  ) => Promise<{ ok: boolean; error?: string }>;
  addACJob: (input: ACJobInput) => boolean;
  saveACJobToCloud: (
    input: ACJobInput,
    existingId?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateACJob: (id: string, input: Partial<ACJobInput>) => boolean;
  updateACJobToCloud: (
    id: string,
    input: Partial<ACJobInput>,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteACJob: (id: string) => void;
  deleteACJobToCloud: (id: string) => Promise<{ ok: boolean; error?: string }>;
  recordACService: (jobId: string, input?: RecordACServiceInput) => boolean;
  recordACServiceToCloud: (
    jobId: string,
    input?: RecordACServiceInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  addJobItem: (input: JobItemInput) => boolean;
  deleteJobItem: (id: string) => boolean;
  addJobItemToCloud: (
    input: JobItemInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteJobItemToCloud: (
    id: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  addTechnician: (input: TechnicianInput) => boolean;
  updateTechnician: (id: string, input: Partial<TechnicianInput>) => void;
  deleteTechnician: (id: string) => void;
  saveTechnicianToCloud: (
    input: TechnicianInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateTechnicianToCloud: (
    id: string,
    input: Partial<TechnicianInput>,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteTechnicianToCloud: (
    id: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  addContractor: (input: ContractorInput) => boolean;
  updateContractor: (id: string, input: Partial<ContractorInput>) => void;
  deleteContractor: (id: string) => void;
  saveContractorToCloud: (
    input: ContractorInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateContractorToCloud: (
    id: string,
    input: Partial<ContractorInput>,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteContractorToCloud: (
    id: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  recordContractorPayment: (
    contractorId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => boolean;
  recordContractorPaymentToCloud: (
    contractorId: string,
    amount: number,
    method: PaymentMethod,
    note?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  addVehicle: (input: VehicleInput) => boolean;
  updateVehicle: (id: string, input: Partial<VehicleInput>) => boolean;
  sellVehicle: (input: VehicleSaleInput) => boolean;
  deleteVehicle: (id: string) => void;
  saveVehicleToCloud: (
    input: VehicleInput,
    existingId?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateVehicleToCloud: (
    id: string,
    input: Partial<VehicleInput>,
  ) => Promise<{ ok: boolean; error?: string }>;
  sellVehicleToCloud: (
    input: VehicleSaleInput,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteVehicleToCloud: (
    id: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  resetAll: () => void;
  resetAllToCloud: () => Promise<{ ok: boolean; error?: string }>;
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
  const lastCloudGenerationRef = useRef(0);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const skipConflictCheckRef = useRef(false);
  const scheduleRetryPushRef = useRef<() => void>(() => {});
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
    lastCloudGenerationRef.current = 0;
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
      let workingPayload = payload;
      const [cloudTs, cloudGen] = await Promise.all([
        fetchCloudSyncWatermark(orgId),
        fetchOrgSyncGeneration(orgId),
      ]);
      const localTs = localDataWatermark(workingPayload, orgId);
      const localGen = getLocalSyncGeneration(orgId);

      if (cloudGen > localGen || cloudTs > localTs) {
        const pulled = await pullRemoteIfNewer(
          orgId,
          workingPayload,
          lastCloudWatermarkRef.current,
          lastCloudGenerationRef.current,
        );
        lastCloudWatermarkRef.current = Math.max(
          lastCloudWatermarkRef.current,
          pulled.cloudTs,
        );
        lastCloudGenerationRef.current = Math.max(
          lastCloudGenerationRef.current,
          pulled.cloudGen,
        );
        if (pulled.error) {
          return { err: pulled.error, conflict: false };
        }
        if (pulled.refreshed) {
          if (hasSyncConflict(workingPayload, pulled.data)) {
            raiseSyncConflict(workingPayload, pulled.data, pulled.cloudGen);
            return { err: null, conflict: true };
          }
          const hadUnsynced = localHasUnsyncedRecordsFromData(
            workingPayload,
            pulled.data,
          );
          workingPayload = pulled.data;
          setData(workingPayload);
          latestDataRef.current = workingPayload;
          saveAppData(workingPayload, orgId);
          if (!hadUnsynced) {
            setLocalSyncGeneration(orgId, pulled.cloudGen);
            setCloudRemoteNotice(true);
            clearOfflinePendingSync(orgId);
            refreshOfflinePendingState(orgId);
          }
          setCloudSyncError(null);
        }
      }

      if (!skipConflictCheckRef.current) {
        const cloud = await pullBusinessData(orgId, workingPayload.business);
        if (cloud && !isEmptyBusinessData(cloud) && hasSyncConflict(workingPayload, cloud)) {
          raiseSyncConflict(workingPayload, cloud, cloudGen);
          return { err: null, conflict: true };
        }
      }

      const push = await withCloudSyncRetry(
        async () => {
          const seenGeneration = await fetchOrgSyncGeneration(orgId);
          return pushBusinessData(orgId, workingPayload, {
            preserveBuyPrices: !canSeeFinancials,
            seenGeneration,
          });
        },
        (result) => result.error != null && !result.stale,
      );

      if (push.stale) {
        const remote = await pullBusinessData(orgId, workingPayload.business);
        if (remote && hasSyncConflict(workingPayload, remote)) {
          raiseSyncConflict(workingPayload, remote, push.generation);
          return { err: null, conflict: true };
        }
        if (remote) {
          const hadUnsynced = localHasUnsyncedRecordsFromData(workingPayload, remote);
          const resolved = mergePullWithLocal(workingPayload, remote);
          setData(resolved);
          latestDataRef.current = resolved;
          saveAppData(resolved, orgId);
          setLocalSyncGeneration(orgId, push.generation);
          lastCloudGenerationRef.current = push.generation;
          lastCloudWatermarkRef.current = await fetchCloudSyncWatermark(orgId);
          setCloudRemoteNotice(true);
          setCloudSyncError(null);
          if (hadUnsynced) {
            touchOfflinePending(orgId);
            refreshOfflinePendingState(orgId);
          } else {
            clearOfflinePendingSync(orgId);
            refreshOfflinePendingState(orgId);
          }
        }
        skipConflictCheckRef.current = false;
        return { err: null, conflict: false };
      }

      if (!push.error) {
        setLocalSyncGeneration(orgId, push.generation);
        lastCloudGenerationRef.current = push.generation;
        lastCloudWatermarkRef.current = await fetchCloudSyncWatermark(orgId);
        setCloudRemoteNotice(false);
        clearOfflinePendingSync(orgId);
        refreshOfflinePendingState(orgId);
      }

      skipConflictCheckRef.current = false;
      return { err: push.error, conflict: false };
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
        scheduleRetryPushRef.current();
      });
    }, cloudSyncRetryDelayMs(attempt));
  }, [org.id, executeCloudPush, refreshOfflinePendingState]);

  scheduleRetryPushRef.current = scheduleRetryPush;

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

    void syncBusinessData(org.id, local, getLocalSyncGeneration(org.id)).then(
      async ({ data: synced, error, generation, conflictRemote }) => {
        if (cancelled) return;
        cloudLoadedRef.current = true;
        setData(synced);
        latestDataRef.current = synced;
        saveAppData(synced, org.id);
        lastCloudWatermarkRef.current = await fetchCloudSyncWatermark(org.id!);
        lastCloudGenerationRef.current = generation;
        setLocalSyncGeneration(org.id!, generation);
        if (conflictRemote) {
          raiseSyncConflict(local, conflictRemote, generation);
        }
        if (!error) {
          clearOfflinePendingSync(org.id!);
          refreshOfflinePendingState(org.id!);
        }
        setCloudSyncing(false);
        setCloudSyncError(error);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [ready, user, org.id, org.isAuthenticated, isOnline, refreshOfflinePendingState, raiseSyncConflict]);

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
      if (cloudSyncing) return;
      if (document.visibilityState === "hidden") return;
      if (pushTimerRef.current) return;
      const payload = latestDataRef.current;
      if (!payload || !org.id) return;
      if (hasOfflinePendingSync(org.id)) return;

      const localTs = localDataWatermark(payload, org.id);
      const localGen = getLocalSyncGeneration(org.id);
      if (
        localTs > lastCloudWatermarkRef.current ||
        localGen > lastCloudGenerationRef.current
      ) {
        return;
      }

      void pullRemoteIfNewer(
        org.id,
        payload,
        lastCloudWatermarkRef.current,
        lastCloudGenerationRef.current,
      ).then((result) => {
        lastCloudWatermarkRef.current = Math.max(
          lastCloudWatermarkRef.current,
          result.cloudTs,
        );
        lastCloudGenerationRef.current = Math.max(
          lastCloudGenerationRef.current,
          result.cloudGen,
        );
        if (!result.refreshed) return;
        if (hasSyncConflict(payload, result.data)) {
          raiseSyncConflict(payload, result.data, result.cloudGen);
          return;
        }
        const hadUnsynced = localHasUnsyncedRecordsFromData(payload, result.data);
        setData(result.data);
        latestDataRef.current = result.data;
        saveAppData(result.data, org.id);
        if (!hadUnsynced) {
          setLocalSyncGeneration(org.id!, result.cloudGen);
          setCloudRemoteNotice(true);
          setCloudSyncError(null);
          return;
        }
        touchOfflinePending(org.id!);
        refreshOfflinePendingState(org.id!);
        scheduleCloudPush(result.data);
      });
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
  }, [
    ready,
    user,
    org.id,
    org.isAuthenticated,
    syncConflict,
    cloudSyncing,
    raiseSyncConflict,
    scheduleCloudPush,
    refreshOfflinePendingState,
  ]);

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
          lastCloudGenerationRef.current = pending.cloudTs;
          setLocalSyncGeneration(orgId, pending.cloudTs);
          clearOfflinePendingSync(orgId);
          refreshOfflinePendingState(orgId);
          setCloudSyncing(false);
          return;
        }

        const push = await withCloudSyncRetry(
          async () => {
            const seenGeneration = await fetchOrgSyncGeneration(orgId);
            return pushBusinessData(orgId, next, {
              preserveBuyPrices: !canSeeFinancials,
              seenGeneration,
            });
          },
          (result) => result.error != null && !result.stale,
        );
        skipConflictCheckRef.current = false;

        if (push.stale) {
          setCloudSyncError(
            "Another device saved while resolving — pull latest data and try again.",
          );
          setCloudSyncing(false);
          return;
        }

        if (!push.error) {
          setLocalSyncGeneration(orgId, push.generation);
          lastCloudGenerationRef.current = push.generation;
          lastCloudWatermarkRef.current = await fetchCloudSyncWatermark(orgId);
          clearOfflinePendingSync(orgId);
          refreshOfflinePendingState(orgId);
        } else {
          touchOfflinePending(orgId);
          refreshOfflinePendingState(orgId);
          setCloudSyncError(push.error);
        }
        setCloudSyncing(false);
      })();
    },
    [syncConflict, org.id, canSeeFinancials, refreshOfflinePendingState],
  );

  const saveCustomerToCloud = useCallback(
    async (
      input: CustomerInput,
      existingId?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const next = existingId
        ? updateCustomer(data, existingId, input)
        : addCustomer(data, input);

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncCustomersSnapshot(org.id, next.customers);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteCustomerToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data || isReadOnly) return { ok: false, error: "Read-only mode" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };

      const next = deleteCustomer(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncCustomersSnapshot(org.id, next.customers);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      isReadOnly,
      syncConflict,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const canAddProduct = useCallback(
    (current: AppData) => {
      const plan = getPlan(subscription.planId);
      if (plan.maxProducts == null) return true;
      return current.products.length < plan.maxProducts;
    },
    [subscription.planId],
  );

  const saveProductToCloud = useCallback(
    async (
      input: ProductInput,
      existingId?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const shopSector = parseSectorId(org.sector);
      let normalized = org.isAuthenticated
        ? normalizeProductForShop(input, shopSector)
        : input;
      if (existingId && !canSeeFinancials) {
        const existing = data.products.find((p) => p.id === existingId);
        if (existing) normalized = { ...normalized, buyPrice: existing.buyPrice };
      }

      let next: AppData;
      let productId: string;
      let newStockLogIds: string[] = [];

      if (existingId) {
        next = updateProduct(data, existingId, normalized);
        productId = existingId;
      } else {
        if (!canAddProduct(data)) {
          return { ok: false, error: "Product limit reached" };
        }
        const prevLogIds = new Set(data.stockLogs.map((log) => log.id));
        next = addProduct(data, normalized);
        productId = next.products[0].id;
        newStockLogIds = next.stockLogs
          .filter((log) => !prevLogIds.has(log.id))
          .map((log) => log.id);
      }

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncProductSnapshot(org.id, next, [productId], {
        preserveBuyPrices: !canSeeFinancials,
        stockLogIds: newStockLogIds,
      });
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      org.sector,
      user,
      canSeeFinancials,
      canAddProduct,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const createSaleToCloud = useCallback(
    async (
      lines: { productId: string; qty: number; unitPrice?: number }[],
      paymentMethod: PaymentMethod,
      options?: SaleOptions,
    ): Promise<{ ok: boolean; saleId?: string; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevJobIds = new Set(data.acJobs.map((job) => job.id));
      const prevSalesLen = data.sales.length;
      const next = createSale(data, lines, paymentMethod, options ?? {});
      if (next.sales.length === prevSalesLen) {
        return { ok: false, error: "Could not create sale" };
      }

      const saleId = next.sales[0].id;
      const newAcJobIds = next.acJobs
        .filter((job) => !prevJobIds.has(job.id))
        .map((job) => job.id);

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true, saleId };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncSaleSnapshot(org.id, next, saleId, {
        preserveBuyPrices: !canSeeFinancials,
        newAcJobIds,
      });
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true, saleId };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      canSeeFinancials,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const saveSupplierToCloud = useCallback(
    async (
      input: SupplierInput,
      existingId?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canUseSuppliersModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const next = existingId
        ? updateSupplier(data, existingId, input)
        : addSupplier(data, input);

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncSuppliersSnapshot(org.id, next.suppliers);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteSupplierToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data || isReadOnly || !canUseSuppliersModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };

      const next = deleteSupplier(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncSuppliersSnapshot(org.id, next.suppliers);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      isReadOnly,
      orgRole,
      syncConflict,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const createPurchaseToCloud = useCallback(
    async (input: PurchaseInput): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canUseSuppliersModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevChequeIds = new Set(data.cheques.map((cheque) => cheque.id));
      const prevPurchasesLen = data.purchases.length;
      const next = createPurchase(data, input);
      if (next.purchases.length === prevPurchasesLen) {
        return { ok: false, error: "Could not record purchase" };
      }

      const purchaseId = next.purchases[0].id;
      const newChequeIds = next.cheques
        .filter((cheque) => !prevChequeIds.has(cheque.id))
        .map((cheque) => cheque.id);

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncPurchaseSnapshot(org.id, next, purchaseId, {
        newChequeIds,
      });
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const recordSupplierPaymentToCloud = useCallback(
    async (
      supplierId: string,
      amount: number,
      method: PaymentMethod,
      note?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canUseSuppliersModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevPaymentsLen = data.supplierPayments.length;
      const next = recordSupplierPayment(data, supplierId, amount, method, note);
      if (next.supplierPayments.length === prevPaymentsLen) {
        return { ok: false, error: "Could not record payment" };
      }

      const paymentId = next.supplierPayments[0].id;

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncSupplierPaymentSnapshot(org.id, next, paymentId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const pushJobSnapshot = useCallback(
    async (
      next: AppData,
      jobId: string,
      prevHistoryIds: Set<string>,
    ): Promise<string | null> => {
      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return "Cloud not connected";
      }
      const newHistoryIds = next.jobStatusHistory
        .filter((entry) => !prevHistoryIds.has(entry.id))
        .map((entry) => entry.id);
      return syncACJobSnapshot(org.id, next, jobId, { newHistoryIds });
    },
    [org.id, org.isAuthenticated, user],
  );

  const recordCustomerPaymentToCloud = useCallback(
    async (
      customerId: string,
      amount: number,
      method: PaymentMethod,
      note?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevPaymentsLen = data.customerPayments.length;
      const next = recordCustomerPayment(data, customerId, amount, method, note);
      if (next.customerPayments.length === prevPaymentsLen) {
        return { ok: false, error: "Could not record payment" };
      }

      const paymentId = next.customerPayments[0].id;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncCustomerPaymentSnapshot(org.id, next, paymentId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const saveACJobToCloud = useCallback(
    async (
      input: ACJobInput,
      existingId?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canOperateAcJobs(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const safe = sanitizeAcJobInputForRole(input, orgRole) as ACJobInput;
      const prevHistoryIds = new Set(data.jobStatusHistory.map((entry) => entry.id));
      const prevJobsLen = data.acJobs.length;
      const next = existingId
        ? updateACJob(data, existingId, safe)
        : addACJob(data, safe);
      const jobId = existingId ?? next.acJobs[0]?.id;
      if (!jobId || (!existingId && next.acJobs.length === prevJobsLen)) {
        return { ok: false, error: "Could not save job" };
      }

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      const err = await pushJobSnapshot(next, jobId, prevHistoryIds);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id!);
        refreshOfflinePendingState(org.id!);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      pushJobSnapshot,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const updateACJobToCloud = useCallback(
    async (
      id: string,
      input: Partial<ACJobInput>,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      const safe = sanitizeAcJobInputForRole(input, orgRole);
      if (!canUpdateAcJob(orgRole, safe)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevHistoryIds = new Set(data.jobStatusHistory.map((entry) => entry.id));
      const next = updateACJob(data, id, safe);

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      const err = await pushJobSnapshot(next, id, prevHistoryIds);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id!);
        refreshOfflinePendingState(org.id!);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      orgRole,
      isOnline,
      can,
      org.id,
      pushJobSnapshot,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const recordACServiceToCloud = useCallback(
    async (
      jobId: string,
      input?: RecordACServiceInput,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevHistoryIds = new Set(data.jobStatusHistory.map((entry) => entry.id));
      const next = recordACService(data, jobId, input);
      if (!next.acJobs.some((job) => job.id === jobId)) {
        return { ok: false, error: "Could not record service" };
      }

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      const err = await pushJobSnapshot(next, jobId, prevHistoryIds);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id!);
        refreshOfflinePendingState(org.id!);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      pushJobSnapshot,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const addJobItemToCloud = useCallback(
    async (input: JobItemInput): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canOperateAcJobs(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLen = data.jobItems.length;
      const next = addJobItem(data, input);
      if (next.jobItems.length === prevLen) {
        return { ok: false, error: "Could not add item" };
      }

      const itemId = next.jobItems[0].id;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncJobItemSnapshot(org.id, next, itemId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteJobItemToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canOperateAcJobs(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      if (!data.jobItems.some((item) => item.id === id)) {
        return { ok: false, error: "Item not found" };
      }

      const next = deleteJobItem(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await deleteJobItemFromCloud(org.id, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const recordContractorPaymentToCloud = useCallback(
    async (
      contractorId: string,
      amount: number,
      method: PaymentMethod,
      note?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevPaymentsLen = data.contractorPayments.length;
      const next = recordContractorPayment(data, contractorId, amount, method, note);
      if (next.contractorPayments.length === prevPaymentsLen) {
        return { ok: false, error: "Could not record payment" };
      }

      const paymentId = next.contractorPayments[0].id;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncContractorPaymentSnapshot(org.id, next, paymentId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const addBankAccountToCloud = useCallback(
    async (
      input: BankAccountInput,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canUseBankingModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLen = data.bankAccounts.length;
      const next = addBankAccount(data, input);
      if (next.bankAccounts.length === prevLen) {
        return { ok: false, error: "Could not save account" };
      }

      const accountId = next.bankAccounts[0].id;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncBankAccountSnapshot(org.id, next, accountId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteBankAccountToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !canUseBankingModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      if (!data.bankAccounts.some((account) => account.id === id)) {
        return { ok: false, error: "Account not found" };
      }

      const next = deleteBankAccount(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await deleteBankAccountFromCloud(org.id, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      orgRole,
      isOnline,
      can,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const addBankTransactionToCloud = useCallback(
    async (
      input: BankTransactionInput,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canUseBankingModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLen = data.bankTransactions.length;
      const next = addBankTransaction(data, input);
      if (next.bankTransactions.length === prevLen) {
        return { ok: false, error: "Could not save transaction" };
      }

      const txnId = next.bankTransactions[0].id;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncBankTransactionSnapshot(org.id, next, txnId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteBankTransactionToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !canUseBankingModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const txn = data.bankTransactions.find((row) => row.id === id);
      if (!txn) return { ok: false, error: "Transaction not found" };

      const accountId = txn.accountId;
      const next = deleteBankTransaction(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncBankTransactionDeleteSnapshot(
        org.id,
        next,
        id,
        accountId,
      );
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      orgRole,
      isOnline,
      can,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const addBankTransferToCloud = useCallback(
    async (
      input: BankTransferInput,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canUseBankingModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLen = data.bankTransfers.length;
      const next = addBankTransfer(data, input);
      if (next.bankTransfers.length === prevLen) {
        return { ok: false, error: "Could not save transfer" };
      }

      const transferId = next.bankTransfers[0].id;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncBankTransferSnapshot(org.id, next, transferId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const addChequeToCloud = useCallback(
    async (input: ChequeInput): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canUseBankingModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLen = data.cheques.length;
      const next = addCheque(data, input);
      if (next.cheques.length === prevLen) {
        return { ok: false, error: "Could not save cheque" };
      }

      const chequeId = next.cheques[0].id;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncChequeSnapshot(org.id, next, chequeId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const updateChequeStatusToCloud = useCallback(
    async (
      chequeId: string,
      status: ChequeStatus,
      bankAccountId?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write") || !canUseBankingModule(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prev = data.cheques.find((cheque) => cheque.id === chequeId);
      if (!prev || prev.status === status) {
        return { ok: false, error: "Could not update cheque" };
      }

      const next = updateChequeStatus(data, chequeId, status, bankAccountId);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncChequeStatusSnapshot(org.id, next, chequeId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      orgRole,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const saveVehicleToCloud = useCallback(
    async (
      input: VehicleInput,
      existingId?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLen = data.vehicles.length;
      const next = existingId
        ? updateVehicle(data, existingId, input)
        : addVehicle(data, input);
      const vehicleId = existingId ?? next.vehicles[0]?.id;

      if (existingId) {
        const before = data.vehicles.find((vehicle) => vehicle.id === existingId);
        const after = next.vehicles.find((vehicle) => vehicle.id === existingId);
        if (!before || !after || JSON.stringify(before) === JSON.stringify(after)) {
          return { ok: false, error: "Could not save vehicle" };
        }
      } else if (!vehicleId || next.vehicles.length === prevLen) {
        return { ok: false, error: "Duplicate chassis number" };
      }

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncVehicleSnapshot(org.id, next, vehicleId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const updateVehicleToCloud = useCallback(
    async (
      id: string,
      input: Partial<VehicleInput>,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const before = data.vehicles.find((vehicle) => vehicle.id === id);
      const next = updateVehicle(data, id, input);
      const after = next.vehicles.find((vehicle) => vehicle.id === id);
      if (!before || !after || JSON.stringify(before) === JSON.stringify(after)) {
        return { ok: false, error: "Could not update vehicle" };
      }

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncVehicleSnapshot(org.id, next, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const sellVehicleToCloud = useCallback(
    async (
      input: VehicleSaleInput,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const vehicle = data.vehicles.find((row) => row.id === input.vehicleId);
      if (!vehicle || vehicle.status === "sold") {
        return { ok: false, error: "Could not sell vehicle" };
      }

      const next = sellVehicle(data, input);
      const sold = next.vehicles.find((row) => row.id === input.vehicleId);
      if (!sold || sold.status !== "sold") {
        return { ok: false, error: "Could not sell vehicle" };
      }

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncVehicleSaleSnapshot(org.id, next, input.vehicleId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteVehicleToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const vehicle = data.vehicles.find((row) => row.id === id);
      if (!vehicle || vehicle.status === "sold") {
        return { ok: false, error: "Could not delete vehicle" };
      }

      const next = deleteVehicle(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await deleteVehicleFromCloud(org.id, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const setCustomerProductPriceToCloud = useCallback(
    async (
      customerId: string,
      productId: string,
      price: number,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const existing = data.customerProductPrices.find(
        (row) => row.customerId === customerId && row.productId === productId,
      );
      const before = existing ? JSON.stringify(existing) : null;
      const next = setCustomerProductPrice(data, customerId, productId, price);
      const afterRow = next.customerProductPrices.find(
        (row) => row.customerId === customerId && row.productId === productId,
      );
      const after = afterRow ? JSON.stringify(afterRow) : null;
      if (before === after) {
        return { ok: false, error: "Could not save price" };
      }

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncCustomerProductPriceSnapshot(
        org.id,
        next,
        customerId,
        productId,
        existing && !afterRow ? existing.id : undefined,
      );
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const removeCustomerProductPriceToCloud = useCallback(
    async (
      customerId: string,
      productId: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const existing = data.customerProductPrices.find(
        (row) => row.customerId === customerId && row.productId === productId,
      );
      if (!existing) return { ok: true };

      const next = removeCustomerProductPrice(data, customerId, productId);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncCustomerProductPriceSnapshot(
        org.id,
        next,
        customerId,
        productId,
        existing.id,
      );
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const saveTechnicianToCloud = useCallback(
    async (
      input: TechnicianInput,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLen = data.technicians.length;
      const next = addTechnician(data, input);
      if (next.technicians.length === prevLen) {
        return { ok: false, error: "Could not save technician" };
      }

      const technicianId = next.technicians[0].id;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncTechnicianSnapshot(org.id, next, technicianId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const updateTechnicianToCloud = useCallback(
    async (
      id: string,
      input: Partial<TechnicianInput>,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const before = data.technicians.find((row) => row.id === id);
      const next = updateTechnician(data, id, input);
      const after = next.technicians.find((row) => row.id === id);
      if (!before || !after || JSON.stringify(before) === JSON.stringify(after)) {
        return { ok: false, error: "Could not update technician" };
      }

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncTechnicianSnapshot(org.id, next, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteTechnicianToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      if (!data.technicians.some((row) => row.id === id)) {
        return { ok: false, error: "Technician not found" };
      }

      const next = deleteTechnician(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await deleteTechnicianFromCloud(org.id, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const saveContractorToCloud = useCallback(
    async (
      input: ContractorInput,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLen = data.contractors.length;
      const next = addContractor(data, input);
      if (next.contractors.length === prevLen) {
        return { ok: false, error: "Could not save contractor" };
      }

      const contractorId = next.contractors[0].id;
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncContractorSnapshot(org.id, next, contractorId);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const updateContractorToCloud = useCallback(
    async (
      id: string,
      input: Partial<ContractorInput>,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const before = data.contractors.find((row) => row.id === id);
      const next = updateContractor(data, id, input);
      const after = next.contractors.find((row) => row.id === id);
      if (!before || !after || JSON.stringify(before) === JSON.stringify(after)) {
        return { ok: false, error: "Could not update contractor" };
      }

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncContractorSnapshot(org.id, next, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteContractorToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      if (!data.contractors.some((row) => row.id === id)) {
        return { ok: false, error: "Contractor not found" };
      }

      const next = deleteContractor(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await deleteContractorFromCloud(org.id, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const updateBusinessToCloud = useCallback(
    async (
      business: Partial<BusinessInfo> & Pick<BusinessInfo, "name">,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const next = mergeBusiness(data, business);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await saveOrgShopSettings(org.id, next.business);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      refreshOfflinePendingState,
    ],
  );

  const stockInToCloud = useCallback(
    async (
      productId: string,
      qty: number,
      note?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLogIds = new Set(data.stockLogs.map((log) => log.id));
      const next = adjustStock(data, productId, qty, "in", note);
      if (next === data) return { ok: false, error: "Could not adjust stock" };

      const newStockLogIds = next.stockLogs
        .filter((log) => !prevLogIds.has(log.id))
        .map((log) => log.id);

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncProductSnapshot(org.id, next, [productId], {
        preserveBuyPrices: !canSeeFinancials,
        stockLogIds: newStockLogIds,
      });
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      canSeeFinancials,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const stockOutToCloud = useCallback(
    async (
      productId: string,
      qty: number,
      note?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      const prevLogIds = new Set(data.stockLogs.map((log) => log.id));
      const next = adjustStock(data, productId, qty, "out", note);
      if (next === data) return { ok: false, error: "Could not adjust stock" };

      const newStockLogIds = next.stockLogs
        .filter((log) => !prevLogIds.has(log.id))
        .map((log) => log.id);

      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await syncProductSnapshot(org.id, next, [productId], {
        preserveBuyPrices: !canSeeFinancials,
        stockLogIds: newStockLogIds,
      });
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      canSeeFinancials,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteProductToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      if (!data.products.some((product) => product.id === id)) {
        return { ok: false, error: "Product not found" };
      }

      const next = deleteProduct(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await deleteProductFromCloud(org.id, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const deleteACJobToCloud = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (!data) return { ok: false, error: "Not ready" };
      if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
      if (isReadOnly || !canManageAcJobs(orgRole)) {
        return { ok: false, error: "Read-only mode" };
      }
      if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

      if (!data.acJobs.some((job) => job.id === id)) {
        return { ok: false, error: "Job not found" };
      }

      const next = deleteACJob(data, id);
      setData(next);
      latestDataRef.current = next;
      saveAppData(next, org.id);

      if (!isOnline) {
        if (org.id) {
          bumpOfflinePendingChange(org.id);
          refreshOfflinePendingState(org.id);
        }
        return { ok: true };
      }

      if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
        return { ok: false, error: "Cloud not connected" };
      }

      const err = await deleteACJobSnapshot(org.id, next, id);
      if (err) {
        setCloudSyncError(err);
        touchOfflinePending(org.id);
        refreshOfflinePendingState(org.id);
        scheduleCloudPush(next);
        return { ok: false, error: err };
      }

      setCloudSyncError(null);
      scheduleCloudPush(next);
      return { ok: true };
    },
    [
      data,
      syncConflict,
      isReadOnly,
      orgRole,
      isOnline,
      can,
      org.id,
      org.isAuthenticated,
      user,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
  );

  const resetAllToCloud = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!data) return { ok: false, error: "Not ready" };
    if (syncConflict) return { ok: false, error: "Sync conflict — resolve it first." };
    if (isReadOnly || !can("write")) return { ok: false, error: "Read-only mode" };
    if (!isOnline && !can("offline")) return { ok: false, error: "Offline" };

    const business = data.business;
    const fresh = { ...emptyAppData(), business };
    clearAppData(org.id);
    setData(fresh);
    latestDataRef.current = fresh;
    saveAppData(fresh, org.id);

    if (!isOnline) {
      if (org.id) {
        bumpOfflinePendingChange(org.id);
        refreshOfflinePendingState(org.id);
      }
      return { ok: true };
    }

    if (!org.id || !org.isAuthenticated || !user || !isSupabaseConfigured()) {
      return { ok: false, error: "Cloud not connected" };
    }

    const seenGeneration = await fetchOrgSyncGeneration(org.id);
    const push = await pushBusinessData(org.id, fresh, {
      preserveBuyPrices: !canSeeFinancials,
      seenGeneration,
    });
    if (push.stale) {
      return { ok: false, error: "Sync conflict — refresh and try again." };
    }
    if (push.error) {
      setCloudSyncError(push.error);
      touchOfflinePending(org.id);
      refreshOfflinePendingState(org.id);
      return { ok: false, error: push.error };
    }

    setLocalSyncGeneration(org.id, push.generation);
    lastCloudGenerationRef.current = push.generation;
    lastCloudWatermarkRef.current = await fetchCloudSyncWatermark(org.id);
    setCloudSyncError(null);
    clearOfflinePendingSync(org.id);
    refreshOfflinePendingState(org.id);

    const shopErr = await saveOrgShopSettings(org.id, business);
    if (shopErr) {
      setCloudSyncError(shopErr);
      touchOfflinePending(org.id);
      refreshOfflinePendingState(org.id);
      return { ok: false, error: shopErr };
    }

    return { ok: true };
  }, [
    data,
    syncConflict,
    isReadOnly,
    can,
    isOnline,
    org.id,
    org.isAuthenticated,
    user,
    canSeeFinancials,
    refreshOfflinePendingState,
  ]);

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
    [
      syncConflict,
      isReadOnly,
      can,
      isOnline,
      org.id,
      scheduleCloudPush,
      refreshOfflinePendingState,
    ],
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
      saveProductToCloud,
      deleteProduct: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteProduct(data, id));
      },
      deleteProductToCloud,
      stockIn: (productId, qty, note) => {
        if (!data || isReadOnly || qty <= 0) return;
        persist(adjustStock(data, productId, qty, "in", note));
      },
      stockOut: (productId, qty, note) => {
        if (!data || isReadOnly || qty <= 0) return;
        persist(adjustStock(data, productId, qty, "out", note));
      },
      stockInToCloud,
      stockOutToCloud,
      addCustomer: (input) => {
        if (!data) return false;
        return persist(addCustomer(data, input));
      },
      updateCustomer: (id, input) => {
        if (!data) return false;
        return persist(updateCustomer(data, id, input));
      },
      saveCustomerToCloud,
      deleteCustomer: (id) => {
        if (!data || isReadOnly) return;
        persist(deleteCustomer(data, id));
      },
      deleteCustomerToCloud,
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
      setCustomerProductPriceToCloud,
      removeCustomerProductPriceToCloud,
      addSupplier: (input) => {
        if (!data || !canUseSuppliersModule(orgRole)) return false;
        return persist(addSupplier(data, input));
      },
      updateSupplier: (id, input) => {
        if (!data || !canUseSuppliersModule(orgRole)) return false;
        return persist(updateSupplier(data, id, input));
      },
      saveSupplierToCloud,
      deleteSupplier: (id) => {
        if (!data || isReadOnly || !canUseSuppliersModule(orgRole)) return;
        persist(deleteSupplier(data, id));
      },
      deleteSupplierToCloud,
      createPurchase: (input) => {
        if (!data || !can("write") || !canUseSuppliersModule(orgRole)) return false;
        const before = data.purchases.length;
        const next = createPurchase(data, input);
        if (next.purchases.length === before) return false;
        return persist(next);
      },
      createPurchaseToCloud,
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
      recordSupplierPaymentToCloud,
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
      recordCustomerPaymentToCloud,
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
      addBankAccountToCloud,
      deleteBankAccountToCloud,
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
      addBankTransactionToCloud,
      deleteBankTransactionToCloud,
      addBankTransfer: (input) => {
        if (!data || !can("write") || !canUseBankingModule(orgRole)) return false;
        const before = data.bankTransfers.length;
        const next = addBankTransfer(data, input);
        if (next.bankTransfers.length === before) return false;
        return persist(next);
      },
      addBankTransferToCloud,
      addCheque: (input) => {
        if (!data || !can("write") || !canUseBankingModule(orgRole)) return false;
        const before = data.cheques.length;
        const next = addCheque(data, input);
        if (next.cheques.length === before) return false;
        return persist(next);
      },
      addChequeToCloud,
      updateChequeStatus: (chequeId, status, bankAccountId) => {
        if (!data || isReadOnly || !canUseBankingModule(orgRole)) return;
        persist(updateChequeStatus(data, chequeId, status, bankAccountId));
      },
      updateChequeStatusToCloud,
      createSale: (lines, paymentMethod, options) => {
        if (!data || !can("write")) return false;
        const before = data.sales.length;
        const next = createSale(data, lines, paymentMethod, options);
        if (next.sales.length === before) return false;
        if (!persist(next)) return false;
        return next.sales[0].id;
      },
      createSaleToCloud,
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
      updateBusinessToCloud,
      addACJob: (input) => {
        if (!data || !canOperateAcJobs(orgRole)) return false;
        const safe = sanitizeAcJobInputForRole(input, orgRole) as ACJobInput;
        const before = data.acJobs.length;
        const next = addACJob(data, safe);
        if (next.acJobs.length === before) return false;
        return persist(next);
      },
      saveACJobToCloud,
      updateACJob: (id, input) => {
        const safe = sanitizeAcJobInputForRole(input, orgRole);
        if (!data || !canUpdateAcJob(orgRole, safe)) return false;
        return persist(updateACJob(data, id, safe));
      },
      updateACJobToCloud,
      deleteACJob: (id) => {
        if (!data || isReadOnly || !canManageAcJobs(orgRole)) return;
        persist(deleteACJob(data, id));
      },
      deleteACJobToCloud,
      recordACService: (jobId, input) => {
        if (!data) return false;
        return persist(recordACService(data, jobId, input));
      },
      recordACServiceToCloud,
      addJobItem: (input) => {
        if (!data || !canOperateAcJobs(orgRole)) return false;
        const before = data.jobItems.length;
        const next = addJobItem(data, input);
        if (next.jobItems.length === before) return false;
        return persist(next);
      },
      deleteJobItem: (id) => {
        if (!data || !canOperateAcJobs(orgRole)) return false;
        return persist(deleteJobItem(data, id));
      },
      addJobItemToCloud,
      deleteJobItemToCloud,
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
      saveTechnicianToCloud,
      updateTechnicianToCloud,
      deleteTechnicianToCloud,
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
      saveContractorToCloud,
      updateContractorToCloud,
      deleteContractorToCloud,
      recordContractorPayment: (contractorId, amount, method, note) => {
        if (!data || !can("write")) return false;
        const before = data.contractorPayments.length;
        const next = recordContractorPayment(data, contractorId, amount, method, note);
        if (next.contractorPayments.length === before) return false;
        return persist(next);
      },
      recordContractorPaymentToCloud,
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
      saveVehicleToCloud,
      updateVehicleToCloud,
      sellVehicleToCloud,
      deleteVehicleToCloud,
      resetAll: () => {
        clearAppData(org.id);
        const fresh = loadAppData(org.id);
        setData(fresh);
        latestDataRef.current = fresh;
      },
      resetAllToCloud,
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
    saveCustomerToCloud,
    deleteCustomerToCloud,
    saveProductToCloud,
    deleteProductToCloud,
    stockInToCloud,
    stockOutToCloud,
    updateBusinessToCloud,
    deleteACJobToCloud,
    createSaleToCloud,
    saveSupplierToCloud,
    deleteSupplierToCloud,
    createPurchaseToCloud,
    recordSupplierPaymentToCloud,
    recordCustomerPaymentToCloud,
    saveACJobToCloud,
    updateACJobToCloud,
    recordACServiceToCloud,
    addJobItemToCloud,
    deleteJobItemToCloud,
    recordContractorPaymentToCloud,
    addBankAccountToCloud,
    deleteBankAccountToCloud,
    addBankTransactionToCloud,
    deleteBankTransactionToCloud,
    addBankTransferToCloud,
    addChequeToCloud,
    updateChequeStatusToCloud,
    saveVehicleToCloud,
    updateVehicleToCloud,
    sellVehicleToCloud,
    deleteVehicleToCloud,
    setCustomerProductPriceToCloud,
    removeCustomerProductPriceToCloud,
    saveTechnicianToCloud,
    updateTechnicianToCloud,
    deleteTechnicianToCloud,
    saveContractorToCloud,
    updateContractorToCloud,
    deleteContractorToCloud,
    resetAllToCloud,
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
