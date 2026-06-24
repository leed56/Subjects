"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import type {
  SyncConflictResolution,
  SyncConflictSummary,
} from "@/lib/offline/sync-conflict";

type SyncConflictDialogProps = {
  summary: SyncConflictSummary | null;
  resolving: boolean;
  onResolve: (resolution: SyncConflictResolution) => void;
};

export function SyncConflictDialog({
  summary,
  resolving,
  onResolve,
}: SyncConflictDialogProps) {
  const { t } = useLocale();

  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center">
      <div
        className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-conflict-title"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
          {t("sync.conflict_eyebrow")}
        </p>
        <h2
          id="sync-conflict-title"
          className="mt-1 text-xl font-black text-slate-900"
        >
          {t("sync.conflict_title")}
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-600">
          {t("sync.conflict_body")}
        </p>

        <ul className="mt-4 space-y-2 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          {summary.localOnlySales > 0 && (
            <li>
              {t("sync.conflict_local_sales").replace(
                "{count}",
                String(summary.localOnlySales),
              )}
            </li>
          )}
          {summary.remoteOnlySales > 0 && (
            <li>
              {t("sync.conflict_remote_sales").replace(
                "{count}",
                String(summary.remoteOnlySales),
              )}
            </li>
          )}
          {summary.localOnlyPurchases > 0 && (
            <li>
              {t("sync.conflict_local_purchases").replace(
                "{count}",
                String(summary.localOnlyPurchases),
              )}
            </li>
          )}
          {summary.remoteOnlyPurchases > 0 && (
            <li>
              {t("sync.conflict_remote_purchases").replace(
                "{count}",
                String(summary.remoteOnlyPurchases),
              )}
            </li>
          )}
          {summary.changedProducts > 0 && (
            <li>
              {t("sync.conflict_changed_products").replace(
                "{count}",
                String(summary.changedProducts),
              )}
            </li>
          )}
          {summary.localOnlyCustomers > 0 && (
            <li>
              {t("sync.conflict_local_customers").replace(
                "{count}",
                String(summary.localOnlyCustomers),
              )}
            </li>
          )}
          {summary.remoteOnlyCustomers > 0 && (
            <li>
              {t("sync.conflict_remote_customers").replace(
                "{count}",
                String(summary.remoteOnlyCustomers),
              )}
            </li>
          )}
          {summary.localOnlyAcJobs > 0 && (
            <li>
              {t("sync.conflict_local_ac_jobs").replace(
                "{count}",
                String(summary.localOnlyAcJobs),
              )}
            </li>
          )}
          {summary.remoteOnlyAcJobs > 0 && (
            <li>
              {t("sync.conflict_remote_ac_jobs").replace(
                "{count}",
                String(summary.remoteOnlyAcJobs),
              )}
            </li>
          )}
        </ul>

        <p className="mt-3 text-xs font-medium text-slate-500">
          {t("sync.conflict_merge_hint")}
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={resolving}
            onClick={() => onResolve("keep_local")}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {t("sync.conflict_keep_local")}
          </button>
          <button
            type="button"
            disabled={resolving}
            onClick={() => onResolve("merge")}
            className="rounded-2xl bg-teal-700 px-3 py-3 text-sm font-black text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {t("sync.conflict_merge")}
          </button>
          <button
            type="button"
            disabled={resolving}
            onClick={() => onResolve("use_remote")}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {t("sync.conflict_use_remote")}
          </button>
        </div>
      </div>
    </div>
  );
}
