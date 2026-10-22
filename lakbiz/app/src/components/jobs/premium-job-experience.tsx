"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/overlay";
import { SearchInput } from "@/components/ui/primitives";
import { PlusIcon, CloseIcon, StockIcon } from "@/components/ui/icons";
import {
  HVAC_PART_CATALOG,
  HVAC_PART_CATEGORIES,
  type HvacCatalogPart,
  type HvacPartCategory,
} from "@/lib/hvac-components";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type {
  JobItemDisposition,
  JobItemInput,
  JobItemWarrantyType,
} from "@/lib/store/types";
import { createExpense } from "@/lib/supabase/expenses-client";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { useToast } from "@/components/ui/toast";

type PurchaseOutcome = "expense" | "inventory";

type PurchaseLine = {
  id: string;
  name: string;
  category: string;
  qty: number;
  receiveQty: number;
  unit: string;
  unitCost: string;
  customerPrice: string;
  isReplacement: boolean;
  oldComponentName: string;
  disposition: JobItemDisposition;
  newComponentSerial: string;
  warrantyType: JobItemWarrantyType;
  warrantyDays: number;
};

function newLine(part?: HvacCatalogPart): PurchaseLine {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    name: part?.name ?? "",
    category: part?.category ?? "AC Parts",
    qty: 1,
    receiveQty: 1,
    unit: part?.unit ?? "pcs",
    unitCost: "",
    customerPrice: "",
    isReplacement: false,
    oldComponentName: part?.name ?? "",
    disposition: "unknown",
    newComponentSerial: "",
    warrantyType: "none",
    warrantyDays: 0,
  };
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Route-level progressive enhancement for the AC Jobs workspace.
 *
 * The legacy JobSheetDrawer is intentionally left intact because it owns a
 * large amount of mature job logic. This component intercepts only the
 * existing “External Purchase” action by its localized label and reads the
 * active job id from the drawer's canonical invoice link. The save path then
 * uses the same AppStore action as the drawer, so inventory, cloud sync,
 * permissions and job-cost calculations remain authoritative.
 *
 * This lets one supplier trip contain several AC parts without weakening the
 * existing single-line From Stock / Manual / Labour workflows.
 */
export function PremiumJobExperience() {
  const { t, locale } = useLocale();
  const { data, ready, addJobItemToCloud } = useAppStore();
  const { org, canSeeFinancials } = useSubscription();
  const { canWrite } = useWriteAccess();
  const { toast } = useToast();

  const copy = (en: string, si: string) => (locale === "si" ? si : en);

  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"All" | HvacPartCategory>("All");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [purchaseRef, setPurchaseRef] = useState("");
  const [outcome, setOutcome] = useState<PurchaseOutcome>("expense");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setLines([]);
    setSearch("");
    setCategory("All");
    setSupplierId("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPurchaseRef("");
    setOutcome("expense");
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    setJobId(null);
    reset();
  };

  // Capture before React's original onClick handler so the old single-line
  // dialog never opens. Matching uses the localized button text, not an
  // English-only literal; job identity comes from the drawer's stable invoice
  // link (/jobs/:id/invoice), so no customer name/job number parsing is used.
  useEffect(() => {
    const label = t("jobs.add_part_menu.external_purchase").trim();
    const handleClick = (event: MouseEvent) => {
      if (!ready || !data || !canWrite) return;
      const element = event.target instanceof Element ? event.target : null;
      const button = element?.closest("button");
      if (!button || button.textContent?.trim() !== label) return;
      const drawer = button.closest('[role="dialog"][aria-labelledby="drawer-title"]');
      if (!drawer) return;
      const invoiceLink = drawer.querySelector<HTMLAnchorElement>('a[href^="/jobs/"][href$="/invoice"]');
      const match = invoiceLink?.getAttribute("href")?.match(/^\/jobs\/([^/]+)\/invoice$/);
      if (!match?.[1]) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      reset();
      setJobId(match[1]);
      setOpen(true);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [ready, data, canWrite, t]);

  const job = jobId && data ? data.acJobs.find((row) => row.id === jobId) : undefined;

  const catalog = useMemo(() => {
    const q = normalized(search);
    return HVAC_PART_CATALOG.filter((part) => {
      if (category !== "All" && part.category !== category) return false;
      if (!q) return true;
      return (
        normalized(part.name).includes(q) ||
        normalized(part.category).includes(q) ||
        (part.keywords ?? []).some((keyword) => normalized(keyword).includes(q))
      );
    }).slice(0, 18);
  }, [search, category]);

  const addCatalogPart = (part: HvacCatalogPart) => {
    setLines((current) => {
      const existing = current.find((line) => normalized(line.name) === normalized(part.name));
      if (existing) {
        return current.map((line) =>
          line.id === existing.id
            ? { ...line, qty: line.qty + 1, receiveQty: Math.max(line.receiveQty, line.qty + 1) }
            : line,
        );
      }
      return [...current, newLine(part)];
    });
  };

  const updateLine = <K extends keyof PurchaseLine>(id: string, key: K, value: PurchaseLine[K]) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, [key]: value } : line)));
  };

  const removeLine = (id: string) => setLines((current) => current.filter((line) => line.id !== id));

  const internalTotal = lines.reduce((sum, line) => sum + line.qty * (Number(line.unitCost) || 0), 0);
  const customerTotal = lines.reduce((sum, line) => sum + line.qty * (Number(line.customerPrice) || 0), 0);
  const grossProfit = customerTotal - internalTotal;
  const validLines = lines.filter((line) => line.name.trim() && line.qty > 0);
  const dirty = lines.length > 0 || supplierId !== "" || purchaseRef !== "";

  const handleSave = async () => {
    if (!job || !canWrite || saving || validLines.length === 0) return;
    setSaving(true);

    let savedCount = 0;
    for (let index = 0; index < validLines.length; index += 1) {
      const line = validLines[index];
      const matchingProduct = data?.products.find(
        (product) => normalized(product.name) === normalized(line.name),
      );
      const useInventory = outcome === "inventory";
      const input: JobItemInput = {
        jobId: job.id,
        itemType: "part",
        name: line.name.trim(),
        qty: Math.max(1, line.qty),
        unitPrice: canSeeFinancials ? Math.max(0, Number(line.unitCost) || 0) : 0,
        customerPrice:
          canSeeFinancials && line.customerPrice !== ""
            ? Math.max(0, Number(line.customerPrice) || 0)
            : undefined,
        unit: line.unit.trim() || "pcs",
        source: useInventory ? "stock" : "purchased",
        productId: useInventory ? matchingProduct?.id : undefined,
        receiveQty: useInventory ? Math.max(line.qty, line.receiveQty) : undefined,
        newProductName: useInventory && !matchingProduct ? line.name.trim() : undefined,
        newProductCategory: useInventory && !matchingProduct ? line.category || "AC Parts" : undefined,
        supplierId: supplierId || undefined,
        purchaseRef: purchaseRef.trim() || undefined,
        purchaseDate,
        invoiceable: true,
        isReplacement: line.isReplacement || undefined,
        oldComponentName: line.isReplacement
          ? line.oldComponentName.trim() || line.name.trim()
          : undefined,
        oldComponentDisposition: line.isReplacement ? line.disposition : undefined,
        newComponentSerial: line.isReplacement ? line.newComponentSerial.trim() || undefined : undefined,
        warrantyType: line.isReplacement ? line.warrantyType : undefined,
        warrantyDays:
          line.isReplacement && line.warrantyType !== "none" && line.warrantyDays > 0
            ? line.warrantyDays
            : undefined,
        warrantyStartDate:
          line.isReplacement && line.warrantyType !== "none" && line.warrantyDays > 0
            ? purchaseDate
            : undefined,
      };

      const result = await addJobItemToCloud(input);
      if (!result.ok) {
        // Keep only the failed + not-yet-attempted lines. Successfully saved
        // lines disappear from the builder, preventing accidental duplicates
        // if the user corrects the failure and retries.
        setLines(validLines.slice(index));
        setSaving(false);
        toast({
          tone: "error",
          title: copy("Purchase partially saved", "මිලදී ගැනීම අර්ධ වශයෙන් සුරකින ලදී"),
          description: `${savedCount} ${copy("items saved. Fix the remaining item and retry.", "අයිතම සුරකින ලදී. ඉතිරි අයිතමය නිවැරදි කර නැවත උත්සාහ කරන්න.")} ${result.error ?? ""}`,
        });
        return;
      }
      savedCount += 1;
    }

    // Direct-for-job purchases are operating expenses. Inventory receipts are
    // intentionally left to the stock movement path to preserve the existing
    // accounting semantics and avoid counting the same purchase twice.
    if (outcome === "expense" && org.id && canSeeFinancials && internalTotal > 0) {
      const vendor = supplierId ? data?.suppliers.find((supplier) => supplier.id === supplierId)?.name : undefined;
      const expenseResult = await createExpense(org.id, {
        category: "parts_purchase",
        amount: internalTotal,
        expenseDate: purchaseDate,
        paymentMethod: "cash",
        vendor,
        notes: purchaseRef.trim()
          ? `${job.jobNo} — ${purchaseRef.trim()} — ${validLines.map((line) => line.name).join(", ")}`
          : `${job.jobNo} — ${validLines.map((line) => line.name).join(", ")}`,
        jobId: job.id,
      });
      if (expenseResult.error) {
        toast({
          tone: "error",
          title: copy("Parts saved; expense link needs attention", "කොටස් සුරකින ලදී; වියදම් සම්බන්ධතාවය පරීක්ෂා කරන්න"),
          description: expenseResult.error,
        });
      }
    }

    setSaving(false);
    toast({
      tone: "success",
      title: copy("External purchase added", "බාහිර මිලදී ගැනීම එකතු කරන ලදී"),
      description: `${savedCount} ${copy("items added to", "අයිතම එකතු කරන ලදී —")} ${job.jobNo}`,
    });
    close();
  };

  if (!ready || !data) return null;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={copy("Add external purchase", "බාහිර මිලදී ගැනීම එකතු කරන්න")}
      description={
        job
          ? `${job.jobNo} · ${job.customerName} — ${copy(
              "select several parts and save them in one purchase",
              "කොටස් කිහිපයක් තෝරා එකම මිලදී ගැනීමක් ලෙස සුරකින්න",
            )}`
          : undefined
      }
      size="xl"
      unsavedChanges={dirty}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            {canSeeFinancials && (
              <>
                <span className="text-slate-500">
                  {copy("Cost", "පිරිවැය")} <strong className="ml-1 font-mono text-slate-900">{formatLkr(internalTotal)}</strong>
                </span>
                <span className="text-slate-500">
                  {copy("Customer", "පාරිභෝගික")} <strong className="ml-1 font-mono text-slate-900">{formatLkr(customerTotal)}</strong>
                </span>
                <span className={grossProfit < 0 ? "text-rose-700" : "text-emerald-700"}>
                  {copy("Gross profit", "දළ ලාභය")} <strong className="ml-1 font-mono">{formatLkr(grossProfit)}</strong>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {copy("Cancel", "අවලංගු")}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canWrite || saving || validLines.length === 0}
              className="min-h-10 rounded-xl bg-gradient-to-r from-teal-700 to-teal-600 px-5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(13,148,136,0.24)] hover:from-teal-800 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving
                ? copy("Saving purchase…", "සුරකිමින්…")
                : `${copy("Add purchase", "මිලදී ගැනීම එකතු කරන්න")} · ${validLines.length}`}
            </button>
          </div>
        </div>
      }
    >
      <div data-premium-external-purchase className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_90%_0%,rgba(20,184,166,0.09),transparent_16rem),linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.045)]">
          <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">{copy("Choose AC parts", "AC කොටස් තෝරන්න")}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {copy("Search the built-in catalog, then add as many lines as this job needs.", "පෙර සකස් කළ ලැයිස්තුවෙන් සොයා මෙම කාර්යයට අවශ්‍ය කොටස් සියල්ල එකතු කරන්න.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLines((current) => [...current, newLine()])}
                className="mt-2 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 sm:mt-0"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                {copy("Custom item", "අභිරුචි අයිතමය")}
              </button>
            </div>
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={copy("Search compressor, capacitor, OCB, capillary, paint…", "Compressor, capacitor, OCB, capillary, paint… සොයන්න")}
            />
            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(["All", ...HVAC_PART_CATEGORIES] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    category === value
                      ? "bg-[#071827] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50"
                  }`}
                >
                  {value === "All" ? copy("All parts", "සියලු කොටස්") : value}
                </button>
              ))}
            </div>
            <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((part) => (
                <button
                  key={part.name}
                  type="button"
                  onClick={() => addCatalogPart(part)}
                  className="group flex min-h-[4.6rem] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:-translate-y-px hover:border-teal-300 hover:shadow-[0_8px_20px_rgba(13,148,136,0.08)]"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{part.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">{part.category} · {part.unit}</span>
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100 transition group-hover:bg-teal-600 group-hover:text-white">
                    <PlusIcon className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-sm font-semibold text-slate-950">{copy("Purchase items", "මිලදී ගැනීමේ අයිතම")}</p>
              <p className="mt-0.5 text-xs text-slate-500">{lines.length} {copy("lines", "පේළි")}</p>
            </div>
            {lines.length > 0 && (
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-100">
                {copy("Multi-item purchase", "බහු-අයිතම මිලදී ගැනීම")}
              </span>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
                <StockIcon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">{copy("No parts selected yet", "තවම කොටස් තෝරා නැත")}</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                {copy("Pick from the catalog above. Repeated picks increase quantity automatically.", "ඉහළ ලැයිස්තුවෙන් තෝරන්න. එකම කොටස නැවත තෝරන විට ප්‍රමාණය ස්වයංක්‍රීයව වැඩි වේ.")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lines.map((line, index) => {
                const lineCost = line.qty * (Number(line.unitCost) || 0);
                const lineCustomer = line.qty * (Number(line.customerPrice) || 0);
                const lineProfit = lineCustomer - lineCost;
                const matchingProduct = data.products.find((product) => normalized(product.name) === normalized(line.name));
                return (
                  <div key={line.id} className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{line.name || copy("Custom part", "අභිරුචි කොටස")}</p>
                          {canSeeFinancials && (
                            <p className={`mt-0.5 text-[11px] font-medium ${lineProfit < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {copy("Line profit", "පේළි ලාභය")}: {formatLkr(lineProfit)}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={copy("Remove item", "අයිතමය ඉවත් කරන්න")}
                        onClick={() => removeLine(line.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <div className={`grid gap-3 ${canSeeFinancials ? "sm:grid-cols-12" : "sm:grid-cols-7"}`}>
                      <label className="sm:col-span-4">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">{copy("Item", "අයිතමය")}</span>
                        <input
                          list="premium-hvac-part-names"
                          value={line.name}
                          onChange={(event) => updateLine(line.id, "name", event.target.value)}
                          className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70"
                        />
                      </label>
                      <label className="sm:col-span-1">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">{copy("Qty", "ප්‍රමාණය")}</span>
                        <input
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={(event) => {
                            const qty = Math.max(1, Number(event.target.value) || 1);
                            updateLine(line.id, "qty", qty);
                            if (line.receiveQty < qty) updateLine(line.id, "receiveQty", qty);
                          }}
                          className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70"
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">{copy("Unit", "ඒකකය")}</span>
                        <input
                          value={line.unit}
                          onChange={(event) => updateLine(line.id, "unit", event.target.value)}
                          className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70"
                        />
                      </label>
                      {canSeeFinancials && (
                        <>
                          <label className="sm:col-span-2">
                            <span className="mb-1.5 block text-xs font-semibold text-slate-600">{copy("Internal cost", "අභ්‍යන්තර පිරිවැය")}</span>
                            <div className="flex min-h-10 items-center rounded-xl border border-slate-200 bg-white focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-100/70">
                              <span className="pl-3 text-xs text-slate-400">Rs.</span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.unitCost}
                                onChange={(event) => updateLine(line.id, "unitCost", event.target.value)}
                                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-right text-sm outline-none"
                              />
                            </div>
                          </label>
                          <label className="sm:col-span-3">
                            <span className="mb-1.5 block text-xs font-semibold text-slate-600">{copy("Customer price", "පාරිභෝගික මිල")}</span>
                            <div className="flex min-h-10 items-center rounded-xl border border-slate-200 bg-white focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-100/70">
                              <span className="pl-3 text-xs text-slate-400">Rs.</span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.customerPrice}
                                onChange={(event) => updateLine(line.id, "customerPrice", event.target.value)}
                                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-right text-sm outline-none"
                              />
                            </div>
                          </label>
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        aria-pressed={line.isReplacement}
                        onClick={() => updateLine(line.id, "isReplacement", !line.isReplacement)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          line.isReplacement
                            ? "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {line.isReplacement ? `✓ ${copy("Replacement", "ප්‍රතිස්ථාපනය")}` : copy("Mark as replacement", "ප්‍රතිස්ථාපනය ලෙස සලකුණු කරන්න")}
                      </button>
                      {outcome === "inventory" && (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-100">
                          {matchingProduct
                            ? copy("Links to existing stock item", "පවතින තොග අයිතමයට සම්බන්ධ වේ")
                            : copy("Creates a new stock item", "නව තොග අයිතමයක් සාදයි")}
                        </span>
                      )}
                    </div>

                    {outcome === "inventory" && (
                      <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                        <label className="flex items-center justify-between gap-4 text-xs font-medium text-sky-900">
                          <span>{copy("Quantity received from supplier", "සැපයුම්කරුගෙන් ලැබුණු ප්‍රමාණය")}</span>
                          <input
                            type="number"
                            min={line.qty}
                            value={line.receiveQty}
                            onChange={(event) => updateLine(line.id, "receiveQty", Math.max(line.qty, Number(event.target.value) || line.qty))}
                            className="h-9 w-24 rounded-lg border border-sky-200 bg-white px-2 text-right text-sm text-slate-900 outline-none focus:border-teal-400"
                          />
                        </label>
                        <p className="mt-1 text-[11px] leading-4 text-sky-700">
                          {copy("The job uses the Qty above; any extra received quantity stays in Stock.", "කාර්යයට ඉහළ Qty ප්‍රමාණය භාවිතා වේ; වැඩිපුර ලැබුණු ප්‍රමාණය තොගයේ ඉතිරි වේ.")}
                        </p>
                      </div>
                    )}

                    {line.isReplacement && (
                      <div className="mt-3 grid gap-3 rounded-xl border border-amber-100 bg-amber-50/45 p-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold text-slate-600">{copy("Old component", "පැරණි කොටස")}</span>
                          <input
                            list="premium-hvac-part-names"
                            value={line.oldComponentName}
                            onChange={(event) => updateLine(line.id, "oldComponentName", event.target.value)}
                            className="h-9 w-full rounded-lg border border-amber-100 bg-white px-2.5 text-xs outline-none focus:border-teal-400"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold text-slate-600">{copy("Disposition", "පැරණි කොටසට කළ දේ")}</span>
                          <select
                            value={line.disposition}
                            onChange={(event) => updateLine(line.id, "disposition", event.target.value as JobItemDisposition)}
                            className="h-9 w-full rounded-lg border border-amber-100 bg-white px-2 text-xs outline-none focus:border-teal-400"
                          >
                            <option value="unknown">{copy("Not recorded", "සටහන් කර නැත")}</option>
                            <option value="returned_to_customer">{copy("Returned to customer", "පාරිභෝගිකයාට ආපසු")}</option>
                            <option value="retained_by_company">{copy("Retained by company", "සමාගම තබා ගත්තා")}</option>
                            <option value="sent_for_warranty">{copy("Sent for warranty", "වගකීම සඳහා යැව්වා")}</option>
                            <option value="disposed">{copy("Disposed", "ඉවත් කළා")}</option>
                            <option value="repairable_core_return">{copy("Repairable core return", "අලුත්වැඩියා කළ හැකි core return")}</option>
                          </select>
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold text-slate-600">{copy("Warranty", "වගකීම")}</span>
                          <select
                            value={line.warrantyType}
                            onChange={(event) => {
                              const value = event.target.value as JobItemWarrantyType;
                              updateLine(line.id, "warrantyType", value);
                              if (value === "none") updateLine(line.id, "warrantyDays", 0);
                              else if (line.warrantyDays === 0) updateLine(line.id, "warrantyDays", 180);
                            }}
                            className="h-9 w-full rounded-lg border border-amber-100 bg-white px-2 text-xs outline-none focus:border-teal-400"
                          >
                            <option value="none">{copy("No warranty", "වගකීමක් නැත")}</option>
                            <option value="company">{copy("Company", "සමාගම")}</option>
                            <option value="supplier">{copy("Supplier", "සැපයුම්කරු")}</option>
                            <option value="manufacturer">{copy("Manufacturer", "නිෂ්පාදකයා")}</option>
                          </select>
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold text-slate-600">{copy("Warranty days", "වගකීම් දින")}</span>
                          <input
                            type="number"
                            min={0}
                            disabled={line.warrantyType === "none"}
                            value={line.warrantyDays}
                            onChange={(event) => updateLine(line.id, "warrantyDays", Math.max(0, Number(event.target.value) || 0))}
                            className="h-9 w-full rounded-lg border border-amber-100 bg-white px-2.5 text-xs outline-none focus:border-teal-400 disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </label>
                        <label className="sm:col-span-2 lg:col-span-4">
                          <span className="mb-1 block text-[11px] font-semibold text-slate-600">{copy("New component serial (optional)", "නව කොටසේ serial (අවශ්‍ය නම්)")}</span>
                          <input
                            value={line.newComponentSerial}
                            onChange={(event) => updateLine(line.id, "newComponentSerial", event.target.value)}
                            className="h-9 w-full rounded-lg border border-amber-100 bg-white px-2.5 text-xs outline-none focus:border-teal-400"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,0.035)] sm:p-5">
            <p className="text-sm font-semibold text-slate-950">{copy("Purchase details", "මිලදී ගැනීමේ විස්තර")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">{copy("Supplier", "සැපයුම්කරු")}</span>
                <select
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70"
                >
                  <option value="">{copy("No supplier / cash purchase", "සැපයුම්කරුවෙකු නැත / මුදල් මිලදී ගැනීම")}</option>
                  {data.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">{copy("Purchase date", "මිලදී ගත් දිනය")}</span>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70"
                />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">{copy("Receipt / purchase reference", "රිසිට් / මිලදී ගැනීමේ යොමුව")}</span>
              <input
                value={purchaseRef}
                onChange={(event) => setPurchaseRef(event.target.value)}
                placeholder={copy("Invoice number, receipt number, note…", "Invoice අංකය, receipt අංකය, සටහන…")}
                className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,#071827_0%,#0c2636_100%)] p-4 text-white shadow-[0_12px_34px_rgba(2,8,23,0.14)] sm:p-5">
            <p className="text-sm font-semibold">{copy("Where should the purchase go?", "මෙම මිලදී ගැනීම යා යුත්තේ කොහේද?")}</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              {copy("Choose the accounting/inventory outcome for every line in this purchase batch.", "මෙම මිලදී ගැනීමේ සියලු පේළි සඳහා ගිණුම්/තොග ප්‍රතිඵලය තෝරන්න.")}
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setOutcome("expense")}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  outcome === "expense"
                    ? "border-teal-300 bg-teal-400/15 ring-1 ring-teal-300/30"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                }`}
              >
                <span className="block text-sm font-semibold">{copy("Use directly on this job", "මෙම කාර්යයට සෘජුව භාවිතා කරන්න")}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-300">{copy("Records job material cost and a linked parts-purchase expense.", "කාර්යයේ ද්‍රව්‍ය පිරිවැය සහ සම්බන්ධ parts-purchase expense එක සටහන් කරයි.")}</span>
              </button>
              <button
                type="button"
                onClick={() => setOutcome("inventory")}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  outcome === "inventory"
                    ? "border-teal-300 bg-teal-400/15 ring-1 ring-teal-300/30"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                }`}
              >
                <span className="block text-sm font-semibold">{copy("Receive into Stock, then use on job", "තොගයට ලබාගෙන පසුව කාර්යයට භාවිතා කරන්න")}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-300">{copy("Creates/updates stock, consumes the job quantity and leaves any surplus available.", "තොගය සාදා/යාවත්කාලීන කර කාර්යයට අවශ්‍ය ප්‍රමාණය භාවිතා කර ඉතිරිය තොගයේ තබයි.")}</span>
              </button>
            </div>
          </div>
        </section>

        <datalist id="premium-hvac-part-names">
          {HVAC_PART_CATALOG.map((part) => <option key={part.name} value={part.name} />)}
        </datalist>
      </div>
    </Dialog>
  );
}
