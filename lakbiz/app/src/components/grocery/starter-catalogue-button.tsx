"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import {
  GROCERY_STARTER_CATALOGUE,
  groceryStarterProductsMissing,
} from "@/lib/grocery-starter-catalogue";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ProductInput } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

type GroceryStarterCatalogueButtonProps = {
  className?: string;
  compact?: boolean;
};

/**
 * Explicit, owner-only first-run action. The seed stays a normal product
 * import: it uses the same durable product write path as the Stock form, so
 * prices, barcode searching, stock, checkout and dashboard data all read one
 * source of truth afterwards.
 */
export function GroceryStarterCatalogueButton({
  className = "",
  compact = false,
}: GroceryStarterCatalogueButtonProps) {
  const { data, saveProductToCloud } = useAppStore();
  const { org, orgRole } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [queue, setQueue] = useState<ProductInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inFlightSku = useRef<string | null>(null);

  const missing = useMemo(
    () => groceryStarterProductsMissing(data?.products.map((product) => product.sku) ?? []),
    [data?.products],
  );
  const isOwner = orgRole === "owner";

  useEffect(() => {
    if (!saving || queue.length === 0) return;
    const next = queue[0];
    // saveProductToCloud updates the provider between products. Keep a small
    // per-SKU lock so that rerender never starts a second write for the same
    // catalogue item while that update is propagating.
    const itemKey = next.sku ?? next.name;
    if (inFlightSku.current === itemKey) return;
    inFlightSku.current = itemKey;

    void saveProductToCloud(next).then((result) => {
      inFlightSku.current = null;
      // Demo/local workspaces persist their catalogue first and report that
      // cloud is unavailable afterwards. That local record is valid and will
      // sync once a workspace is connected, so it should not abort the import.
      if (!result.ok && result.error !== "Cloud not connected") {
        setError(result.error ?? "LakBiz could not save the catalogue.");
        setQueue([]);
        setSaving(false);
        toast({
          tone: "error",
          title: "Starter catalogue paused",
          description: result.error ?? "Please resolve the save issue and try again.",
        });
        return;
      }
      setCompleted((count) => count + 1);
      setQueue((currentQueue) => currentQueue.slice(1));
    });
  }, [data?.products, queue, saveProductToCloud, saving, toast]);

  useEffect(() => {
    if (!saving || queue.length !== 0) return;
    setSaving(false);
    if (completed > 0) {
      toast({
        tone: "success",
        title: "Grocery starter catalogue is ready",
        description: `${completed} editable products are now available in Stock and POS / Billing.`,
      });
    }
  }, [completed, queue.length, saving, toast]);

  if (org.sector !== "grocery") return null;

  if (!isOwner) {
    return (
      <p className={`text-xs font-semibold text-slate-500 ${className}`}>
        Your workspace owner can load the starter grocery catalogue.
      </p>
    );
  }

  const addCatalogue = () => {
    if (missing.length === 0) {
      toast({ tone: "info", title: "Starter catalogue already loaded", description: "Manage prices, stock, barcodes and product images in Stock." });
      return;
    }
    setError(null);
    setCompleted(0);
    setQueue(missing);
    setSaving(true);
    setConfirming(false);
  };

  const label = saving
    ? `Adding ${Math.min(completed + 1, completed + queue.length)} of ${completed + queue.length}`
    : missing.length === 0
      ? "Starter catalogue ready"
      : compact
        ? `Add ${missing.length} starter products`
        : "Add starter grocery catalogue";

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <button
          type="button"
          disabled={saving || !canWrite}
          title={disabledHint ?? undefined}
          onClick={() => setConfirming(true)}
          data-testid="grocery-starter-catalogue-button"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(13,148,136,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {saving ? "Preparing products…" : "✦ "}{label}
        </button>
        {saving && <span className="text-xs font-bold text-teal-700">{completed} of {completed + queue.length} saved</span>}
        {error && <span role="alert" className="text-xs font-semibold text-rose-700">{error}</span>}
      </div>
      <ConfirmDialog
        open={confirming}
        title="Add the Sri Lankan grocery starter catalogue?"
        description={`This adds ${missing.length || GROCERY_STARTER_CATALOGUE.length} editable products with LKR selling prices, stock, SKUs and barcodes. Nothing is added until you choose Add catalogue, and you can edit or remove any product in Stock afterwards.`}
        confirmLabel="Add catalogue"
        onConfirm={addCatalogue}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
