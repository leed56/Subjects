"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { InventoryTrackingMode } from "@/lib/inventory-tracking";
import { fetchInventoryProfile } from "@/lib/supabase/advanced-inventory-client";
import {
  advancedInventorySchemaUnavailable,
  fetchSaleInventoryTrace,
  type SaleInventoryTraceRow,
} from "@/lib/supabase/inventory-trace-client";
import {
  fetchSaleReturns,
  processSaleReturn,
  saleReturnSchemaUnavailable,
  type SaleReturnLineRecord,
} from "@/lib/supabase/sale-return-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

const card =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.035)] sm:p-5";
const input =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

type LineDraft = {
  qty: string;
  restock: boolean;
  allocations: Record<string, string>;
};

function identityText(row: SaleInventoryTraceRow): string {
  return [
    row.variantLabel,
    row.batchNo ? `Batch ${row.batchNo}` : null,
    row.expiryDate ? `Exp ${row.expiryDate}` : null,
    row.imei ? `IMEI ${row.imei}` : null,
    row.secondaryImei ? `IMEI 2 ${row.secondaryImei}` : null,
    row.serialNo ? `Serial ${row.serialNo}` : null,
    !row.imei && !row.serialNo && row.barcode ? `Barcode ${row.barcode}` : null,
    row.warrantyExpiry ? `Warranty ${row.warrantyExpiry}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function BillReturnPage() {
  const params = useParams();
  const saleId = params.id as string;
  const { data, ready } = useAppStore();
  const { org, orgRole } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const { locale } = useLocale();
  const si = locale === "si";

  const sale = data?.sales.find((item) => item.id === saleId) ?? null;
  const [returnLines, setReturnLines] = useState<SaleReturnLineRecord[]>([]);
  const [traceRows, setTraceRows] = useState<SaleInventoryTraceRow[]>([]);
  const [modes, setModes] = useState<Map<string, InventoryTrackingMode>>(new Map());
  const [loadingContext, setLoadingContext] = useState(false);
  const [schemaUpgradeNeeded, setSchemaUpgradeNeeded] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState("");

  useEffect(() => {
    if (!sale || !org.isAuthenticated || !org.id) return;
    let cancelled = false;
    setLoadingContext(true);
    setContextError(null);
    setSchemaUpgradeNeeded(false);

    const productIds = [...new Set(sale.lines.map((line) => line.productId).filter(Boolean))];
    void Promise.all([
      fetchSaleReturns(org.id, sale.id),
      fetchSaleInventoryTrace(org.id, sale.id),
      Promise.all(productIds.map(async (productId) => [productId, await fetchInventoryProfile(productId)] as const)),
    ]).then(([returnsResult, traceResult, profileResults]) => {
      if (cancelled) return;

      if (saleReturnSchemaUnavailable(returnsResult.error)) {
        setSchemaUpgradeNeeded(true);
        setLoadingContext(false);
        return;
      }
      if (returnsResult.error) {
        setContextError(returnsResult.error);
        setLoadingContext(false);
        return;
      }
      if (traceResult.error && !advancedInventorySchemaUnavailable(traceResult.error)) {
        setContextError(traceResult.error);
        setLoadingContext(false);
        return;
      }

      const modeMap = new Map<string, InventoryTrackingMode>();
      for (const [productId, result] of profileResults) {
        if (result.error && !advancedInventorySchemaUnavailable(result.error)) {
          setContextError(result.error);
          setLoadingContext(false);
          return;
        }
        modeMap.set(productId, result.data?.trackingMode ?? "simple");
      }

      setReturnLines(returnsResult.lines);
      setTraceRows(traceResult.data);
      setModes(modeMap);
      setLoadingContext(false);
    });

    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, sale]);

  const returnedByLine = useMemo(() => {
    const map = new Map<number, number>();
    for (const line of returnLines) {
      map.set(line.saleLineOrder, (map.get(line.saleLineOrder) ?? 0) + line.qty);
    }
    return map;
  }, [returnLines]);

  const returnedByAllocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of returnLines) {
      if (!line.originalAllocationId) continue;
      map.set(
        line.originalAllocationId,
        (map.get(line.originalAllocationId) ?? 0) + line.qty,
      );
    }
    return map;
  }, [returnLines]);

  const traceByProduct = useMemo(() => {
    const map = new Map<string, SaleInventoryTraceRow[]>();
    for (const row of traceRows) {
      const list = map.get(row.productId) ?? [];
      list.push(row);
      map.set(row.productId, list);
    }
    return map;
  }, [traceRows]);

  const saleGross = useMemo(
    () => sale?.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0) ?? 0,
    [sale],
  );
  const saleFactor = sale && saleGross > 0 ? sale.total / saleGross : 0;
  const selectedValue = sale
    ? sale.lines.reduce((sum, line, lineOrder) => {
        const qty = Number(drafts[lineOrder]?.qty ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) return sum;
        return sum + line.unitPrice * qty * saleFactor;
      }, 0)
    : 0;

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain><ProLoadingState label={si ? "පූරණය වෙමින්…" : "Loading return workspace…"} /></ProMain>
      </AppShell>
    );
  }

  if (!sale) {
    return (
      <AppShell>
        <ProMain>
          <EmptyState
            title={si ? "බිල්පත සොයාගත නොහැක" : "Bill not found"}
            action={<Link href="/bills" className={primary}>{si ? "බිල්පත්" : "All bills"}</Link>}
          />
        </ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated || (orgRole !== "owner" && orgRole !== "manager")) {
    return (
      <AppShell>
        <ProMain>
          <PageHeader title={si ? "Customer return" : "Customer return"} />
          <EmptyState
            title={si ? "Owner හෝ Manager අනුමැතිය අවශ්‍යයි" : "Owner or manager approval required"}
            description={si ? "Customer return එක stock history වෙනස් කරන නිසා cashier account එකකින් මෙය කළ නොහැක." : "Customer returns change inventory history, so this workflow is intentionally restricted to an owner or manager."}
            action={<Link href={`/bills/${sale.id}`} className={secondary}>{si ? "බිල්පතට ආපසු" : "Back to bill"}</Link>}
          />
        </ProMain>
      </AppShell>
    );
  }

  const setDraft = (lineOrder: number, patch: Partial<LineDraft>) => {
    setDrafts((current) => ({
      ...current,
      [lineOrder]: {
        qty: current[lineOrder]?.qty ?? "",
        restock: current[lineOrder]?.restock ?? false,
        allocations: current[lineOrder]?.allocations ?? {},
        ...patch,
      },
    }));
    setSubmitError(null);
    // Once the operator changes the payload, a later submit should get a new
    // idempotency key. A network-error retry without edits keeps the same key.
    setRequestId("");
  };

  const setAllocationQty = (lineOrder: number, allocationId: string, value: string) => {
    const existing = drafts[lineOrder] ?? { qty: "", restock: false, allocations: {} };
    setDraft(lineOrder, {
      allocations: { ...existing.allocations, [allocationId]: value },
    });
  };

  const validateAndBuild = () => {
    const requests: Array<{
      lineOrder: number;
      qty: number;
      restock: boolean;
      allocations: Array<{ allocationId: string; qty: number }>;
    }> = [];
    const allocationTotals = new Map<string, number>();

    for (let lineOrder = 0; lineOrder < sale.lines.length; lineOrder += 1) {
      const line = sale.lines[lineOrder];
      const draft = drafts[lineOrder];
      const qty = Number(draft?.qty ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const alreadyReturned = returnedByLine.get(lineOrder) ?? 0;
      const remaining = Math.max(0, line.qty - alreadyReturned);
      if (qty > remaining) {
        return { error: `${line.productName}: return quantity exceeds ${remaining}.`, requests: [] };
      }

      const mode = modes.get(line.productId) ?? "simple";
      const restock = draft?.restock ?? false;
      if (mode === "simple" && !restock) {
        return {
          error: `${line.productName}: simple stock can only be accepted here after inspection and approval for resale.`,
          requests: [],
        };
      }
      if (org.sector === "pharmacy" && restock) {
        return {
          error: `${line.productName}: pharmacy customer returns are held out of sellable stock in this phase.`,
          requests: [],
        };
      }

      const productTrace = traceByProduct.get(line.productId) ?? [];
      const availableTrace = productTrace.filter(
        (row) => row.qty - (returnedByAllocation.get(row.allocationId) ?? 0) > 0,
      );
      const allocations = Object.entries(draft?.allocations ?? {})
        .map(([allocationId, raw]) => ({ allocationId, qty: Number(raw) }))
        .filter((item) => Number.isFinite(item.qty) && item.qty > 0);

      if (mode !== "simple" && availableTrace.length > 0) {
        const allocationQty = allocations.reduce((sum, item) => sum + item.qty, 0);
        if (Math.abs(allocationQty - qty) > 0.0001) {
          return {
            error: `${line.productName}: selected batch / variant / IMEI quantity must equal the returned quantity.`,
            requests: [],
          };
        }
      } else if (mode !== "simple" && restock && availableTrace.length === 0) {
        return {
          error: `${line.productName}: this legacy sale has no exact identity allocation, so it can only be kept on return hold.`,
          requests: [],
        };
      }

      for (const allocation of allocations) {
        const row = productTrace.find((item) => item.allocationId === allocation.allocationId);
        const available = row
          ? Math.max(0, row.qty - (returnedByAllocation.get(row.allocationId) ?? 0))
          : 0;
        const requestedAcrossLines = (allocationTotals.get(allocation.allocationId) ?? 0) + allocation.qty;
        if (!row || requestedAcrossLines > available + 0.0001) {
          return {
            error: `${line.productName}: one selected inventory identity is no longer returnable for that quantity.`,
            requests: [],
          };
        }
        allocationTotals.set(allocation.allocationId, requestedAcrossLines);
      }

      requests.push({ lineOrder, qty, restock, allocations });
    }

    if (!requests.length) {
      return { error: si ? "ආපසු භාරගන්න item එකක් තෝරන්න." : "Select at least one item to return.", requests: [] };
    }
    if (!reason.trim()) {
      return { error: si ? "Return reason එක අවශ්‍යයි." : "A return reason is required.", requests: [] };
    }
    return { error: null, requests };
  };

  const handleSubmit = async () => {
    if (saving || !org.id || !canWrite) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSubmitError(si ? "Customer return එක online සිට කළ යුතුයි." : "Customer returns require an online connection.");
      return;
    }
    const built = validateAndBuild();
    if (built.error) {
      setSubmitError(built.error);
      return;
    }

    const id = requestId || crypto.randomUUID();
    if (!requestId) setRequestId(id);
    setSaving(true);
    setSubmitError(null);
    const result = await processSaleReturn(org.id, sale.id, id, reason, built.requests);
    setSaving(false);
    if (!result.ok) {
      if (saleReturnSchemaUnavailable(result.error)) setSchemaUpgradeNeeded(true);
      else setSubmitError(result.error ?? (si ? "Return එක සුරැකීමට නොහැකි විය." : "Could not record the return."));
      return;
    }

    // Full navigation is intentional: process_sale_return increments the cloud
    // sync generation. Reloading lets AppStore pull the authoritative product
    // quantity before any older local snapshot can be pushed back over it.
    window.location.assign(`/bills/${sale.id}?return=${encodeURIComponent(result.returnNo ?? id)}`);
  };

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={si ? "Customer return intake" : "Customer return intake"}
          description={`${sale.billNo ?? sale.id.slice(0, 8)} · ${sale.customerName || (si ? "Walk-in customer" : "Walk-in customer")} · ${formatLkr(sale.total)}`}
          actions={<Link href={`/bills/${sale.id}`} className={secondary}>{si ? "← බිල්පත" : "← Back to bill"}</Link>}
        />

        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          <p className="font-semibold">{si ? "මෙය physical return intake පියවරයි — refund එක නොවේ." : "This is physical return intake — not the refund itself."}</p>
          <p className="mt-1 text-amber-800">
            {si
              ? "මෙම පියවර original bill, customer credit, cash/bank, cheque හෝ VAT වෙනස් නොකරයි. ඒවා financial settlement / credit-note පියවරේදී පමණක් වෙනස් වේ."
              : "This step does not alter the original bill, customer credit, cash/bank, cheque or VAT. Financial settlement / credit-note handling remains a separate controlled step."}
          </p>
        </div>

        {schemaUpgradeNeeded ? (
          <div className="rounded-xl border border-amber-200 bg-white p-5">
            <h2 className="font-semibold text-slate-950">{si ? "Returns database upgrade අවශ්‍යයි" : "Returns database upgrade required"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {si ? "Return migration live LakBiz database එකට apply කරන තුරු මෙම workflow එක submit කළ නොහැක." : "The controlled-return migration must be applied to the live LakBiz database before this workflow can submit returns."}
            </p>
          </div>
        ) : loadingContext ? (
          <ProLoadingState label={si ? "Return history සහ stock identity පූරණය වෙමින්…" : "Loading return history and stock identity…"} />
        ) : contextError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{contextError}</div>
        ) : (
          <div className="space-y-5">
            <section className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{si ? "Items" : "Items"}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{si ? "ආපසු භාරගන්න quantity සහ exact stock identity තෝරන්න" : "Choose returned quantity and exact stock identity"}</h2>
                </div>
                <StatusBadge tone="warning">{si ? "Settlement pending" : "Settlement pending"}</StatusBadge>
              </div>

              <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {sale.lines.map((line, lineOrder) => {
                  const alreadyReturned = returnedByLine.get(lineOrder) ?? 0;
                  const remaining = Math.max(0, line.qty - alreadyReturned);
                  const mode = modes.get(line.productId) ?? "simple";
                  const productTrace = (traceByProduct.get(line.productId) ?? []).filter(
                    (row) => row.qty - (returnedByAllocation.get(row.allocationId) ?? 0) > 0,
                  );
                  const draft = drafts[lineOrder] ?? { qty: "", restock: false, allocations: {} };
                  const pharmacyHold = org.sector === "pharmacy";

                  return (
                    <div key={`${line.productId}-${lineOrder}`} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{line.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatLkr(line.unitPrice)} · {line.qty} {si ? "විකුණා ඇත" : "sold"} · {remaining} {si ? "returnable" : "returnable"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={mode === "simple" ? "neutral" : "info"}>{mode.replaceAll("_", " + ")}</StatusBadge>
                          {alreadyReturned > 0 && <StatusBadge tone="warning">{alreadyReturned} {si ? "returned" : "returned"}</StatusBadge>}
                        </div>
                      </div>

                      {remaining <= 0 ? (
                        <p className="mt-3 text-xs font-semibold text-emerald-700">{si ? "මෙම line එක සම්පූර්ණයෙන් return කර ඇත." : "This line has already been fully returned."}</p>
                      ) : (
                        <>
                          <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-end">
                            <label className="text-xs font-semibold text-slate-600">
                              {si ? "Return quantity" : "Return quantity"}
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                max={remaining}
                                value={draft.qty}
                                onChange={(event) => setDraft(lineOrder, { qty: event.target.value })}
                                className={`${input} mt-1.5 w-full`}
                              />
                            </label>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                              {pharmacyHold ? (
                                <p className="text-xs font-semibold leading-5 text-amber-800">
                                  {si ? "Pharmacy safety: customer-returned medicine sellable batch එකට auto-restock නොකර inspection hold එකට යයි." : "Pharmacy safety: customer-returned medicine is kept on inspection hold and is never auto-restocked into a sellable batch."}
                                </p>
                              ) : (
                                <label className="flex cursor-pointer items-start gap-2 text-xs font-semibold text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={draft.restock}
                                    onChange={(event) => setDraft(lineOrder, { restock: event.target.checked })}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600"
                                  />
                                  <span>
                                    {si ? "Inspection pass — sellable stock වෙත ආපසු දමන්න" : "Inspection passed — return this quantity to sellable stock"}
                                    {mode === "simple" && <span className="mt-0.5 block font-medium text-amber-700">{si ? "Simple stock සඳහා මෙම approval එක අනිවාර්යයි." : "Required for simple-stock returns in this phase."}</span>}
                                  </span>
                                </label>
                              )}
                            </div>
                          </div>

                          {mode !== "simple" && productTrace.length > 0 && Number(draft.qty || 0) > 0 && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold text-slate-700">{si ? "Original sale එකේ exact identity" : "Exact identity from the original sale"}</p>
                              <div className="mt-2 space-y-2">
                                {productTrace.map((row) => {
                                  const returned = returnedByAllocation.get(row.allocationId) ?? 0;
                                  const available = Math.max(0, row.qty - returned);
                                  return (
                                    <div key={row.allocationId} className="grid gap-2 rounded-lg bg-white px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center">
                                      <div>
                                        <p className="text-xs font-semibold text-slate-800">{identityText(row) || (si ? "Tracked allocation" : "Tracked allocation")}</p>
                                        <p className="mt-0.5 text-[11px] text-slate-500">{available} {si ? "තව returnable" : "still returnable"}</p>
                                      </div>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        max={available}
                                        aria-label={`${line.productName} identity return quantity`}
                                        value={draft.allocations[row.allocationId] ?? ""}
                                        onChange={(event) => setAllocationQty(lineOrder, row.allocationId, event.target.value)}
                                        className={`${input} w-full`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {mode !== "simple" && productTrace.length === 0 && Number(draft.qty || 0) > 0 && (
                            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                              {si ? "මෙය advanced inventory identity rollout එකට පෙර sale එකක් විය හැක. Exact identity නොමැති නිසා sellable stock වෙත restore නොකර hold එකක් ලෙස පමණක් භාරගත හැක." : "This may be a legacy sale from before exact identity allocation. Without the original identity it can be accepted only as a return hold, not restored directly to sellable stock."}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={card}>
              <label className="text-sm font-semibold text-slate-800">
                {si ? "Return reason" : "Return reason"}
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setSubmitError(null);
                    setRequestId("");
                  }}
                  placeholder={si ? "උදා: wrong size / customer changed mind / sealed item returned" : "Example: wrong size, customer changed mind, sealed item returned"}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70"
                />
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-950 p-3 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{si ? "Estimated return value" : "Estimated return value"}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">{formatLkr(selectedValue)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">{si ? "Money / credit" : "Money / credit"}</p>
                  <p className="mt-1 text-sm font-semibold text-amber-950">{si ? "Not changed yet" : "Not changed yet"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">VAT</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{si ? "Not reversed yet" : "Not reversed yet"}</p>
                </div>
              </div>

              {submitError && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-800">{submitError}</div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-xs leading-5 text-slate-500">
                  {si ? "Submit කළ පසු original bill edit/delete නොවේ. RTN document එකක් append කර stock audit trail එක තබයි." : "Submitting never edits or deletes the original bill. LakBiz appends an RTN document and preserves the stock audit trail."}
                </p>
                <button
                  type="button"
                  className={primary}
                  disabled={!canWrite || saving || loadingContext}
                  title={!canWrite ? disabledHint ?? undefined : undefined}
                  onClick={() => void handleSubmit()}
                >
                  {saving ? (si ? "Return එක සුරකිමින්…" : "Recording return…") : (si ? "Record physical return" : "Record physical return")}
                </button>
              </div>
            </section>
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}
