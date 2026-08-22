"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { useLocale } from "@/lib/i18n/locale-provider";
import { inventoryModeLabel } from "@/lib/inventory-tracking";
import {
  fetchTrackedReceivingCoverage,
  type ReceivingQueueItem,
} from "@/lib/supabase/receiving-queue-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]";
const primary =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700";
const secondary =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

function schemaMissing(error: string | null): boolean {
  if (!error) return false;
  const value = error.toLowerCase();
  return (
    value.includes("does not exist") ||
    value.includes("schema cache") ||
    value.includes("could not find the table")
  );
}

export default function TrackedReceivingQueuePage() {
  const { data, ready } = useAppStore();
  const { org } = useSubscription();
  const { locale } = useLocale();
  const si = locale === "si";
  const [coverage, setCoverage] = useState<ReceivingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!org.id || !org.isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchTrackedReceivingCoverage(org.id).then((result) => {
      if (cancelled) return;
      setCoverage(result.data);
      setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated]);

  const rows = useMemo(() => {
    if (!data) return [];
    return coverage
      .map((row) => {
        const product = data.products.find((item) => item.id === row.productId);
        if (!product) return null;
        // returnHoldQty is already included in identityCoverage. That is
        // deliberate: a return hold is physically identified on-hand stock,
        // but it is NOT sellable inventory and is classified separately below.
        const pending = Math.max(0, product.stockQty - row.identityCoverage);
        return {
          ...row,
          product,
          pending,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.pending - a.pending || b.returnHoldQty - a.returnHoldQty || a.product.name.localeCompare(b.product.name));
  }, [coverage, data]);

  const pending = rows.filter((row) => row.pending > 0);
  const holds = rows.filter((row) => row.returnHoldQty > 0);
  const readyForPos = rows.filter((row) => row.pending <= 0 && row.returnHoldQty <= 0);
  const pendingUnits = pending.reduce((sum, row) => sum + row.pending, 0);
  const holdUnits = holds.reduce((sum, row) => sum + row.returnHoldQty, 0);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={si ? "Receiving queue පූරණය වෙමින්…" : "Loading receiving queue…"} />
        </ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated) {
    return (
      <AppShell>
        <ProMain>
          <EmptyState
            title={si ? "Cloud shop account එකක් අවශ්‍යයි" : "A cloud shop account is required"}
            description={si ? "Tracked receiving queue cloud inventory identities මත පදනම් වේ." : "The tracked receiving queue is built from protected cloud inventory identities."}
          />
        </ProMain>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={si ? "Receiving queue" : "Receiving queue"}
          description={
            si
              ? "GRN, PO receive හෝ Stock In පසු batch / variant / IMEI identity තවම නොදමා ඇති stock සහ customer-return inspection holds මෙහි පෙන්වයි."
              : "See received stock that still needs batch, variant or IMEI identity, plus customer-return stock intentionally held out of POS pending inspection."
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/stock/advanced" className={secondary}>{si ? "Inventory control" : "Inventory control"}</Link>
              <Link href="/stock/advanced/receive" className={primary}>{si ? "Identity assign කරන්න" : "Assign identity"}</Link>
            </div>
          }
        />

        {loading ? (
          <ProLoadingState label={si ? "Tracked stock පරීක්ෂා කරමින්…" : "Checking tracked stock…"} />
        ) : schemaMissing(error) ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">
              {si ? "Advanced inventory migrations තවම live database එකට apply කර නැත." : "The advanced-inventory migrations are not applied to the live database yet."}
            </p>
            <p className="mt-2 leading-6 text-amber-800">
              {si ? "Correct LakBiz Supabase project එකට migrations apply කළ පසු queue එක ස්වයංක්‍රීයව සක්‍රීය වේ." : "Once the migrations are applied to the correct LakBiz Supabase project, this queue activates automatically."}
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">{error}</div>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{si ? "Identity action" : "Identity action"}</p>
                <p className="mt-2 text-3xl font-semibold">{pending.length}</p>
                <p className="mt-1 text-sm text-slate-300">{si ? "products need identity" : "products need identity"}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">{si ? "Unassigned stock" : "Unassigned stock"}</p>
                <p className="mt-2 text-3xl font-semibold text-amber-950">{pendingUnits}</p>
                <p className="mt-1 text-sm text-amber-800">{si ? "identity අවශ්‍ය units" : "units awaiting identity"}</p>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-700">{si ? "Return holds" : "Return holds"}</p>
                <p className="mt-2 text-3xl font-semibold text-orange-950">{holdUnits}</p>
                <p className="mt-1 text-sm text-orange-800">{si ? "POS එකෙන් block කර ඇත" : "kept out of POS"}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">{si ? "POS ready" : "POS ready"}</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-950">{readyForPos.length}</p>
                <p className="mt-1 text-sm text-emerald-800">{si ? "fully identified products" : "fully identified products"}</p>
              </div>
            </section>

            {pending.length === 0 && holds.length === 0 ? (
              <section className={card}>
                <EmptyState
                  title={si ? "Receiving queue එක clear" : "Receiving queue is clear"}
                  description={
                    rows.length === 0
                      ? si ? "Advanced tracking භාවිතා කරන products තවම නැත." : "No products are using advanced inventory tracking yet."
                      : si ? "සියලුම on-hand tracked stock සඳහා exact identity සටහන් වී ඇති අතර return inspection holds නැත." : "Every on-hand tracked item has its required identity and there are no customer-return inspection holds."
                  }
                  action={<Link href="/stock" className={secondary}>{si ? "Stock බලන්න" : "View Stock"}</Link>}
                />
              </section>
            ) : null}

            {pending.length > 0 && (
              <section className={card}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">{si ? "Needs identity" : "Needs identity"}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{si ? "Receive කිරීම අවසන් කරන්න" : "Finish receiving accurately"}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {si ? "මෙම quantities aggregate Stock එකේ ඇත, නමුත් POS එකට අවශ්‍ය exact batch / size-colour / IMEI identity තවම සම්පූර්ණ නැත." : "These quantities already exist in aggregate Stock, but the exact batch, size/colour or IMEI identity required by POS is still incomplete."}
                    </p>
                  </div>
                  <StatusBadge tone="warning">{pending.length} {si ? "products" : "products"}</StatusBadge>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {pending.map((row) => (
                    <article key={row.product.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{row.product.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {inventoryModeLabel(row.mode, locale)}{row.product.sku ? ` · ${row.product.sku}` : ""}
                          </p>
                        </div>
                        <StatusBadge tone="warning">{row.pending} {si ? "pending" : "pending"}</StatusBadge>
                      </div>

                      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-lg bg-white p-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{si ? "Stock" : "Stock"}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{row.product.stockQty}</p>
                        </div>
                        <div className="rounded-lg bg-white p-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{si ? "Identified" : "Identified"}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{row.identityCoverage}</p>
                        </div>
                        <div className="rounded-lg bg-orange-50 p-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-orange-700">{si ? "Hold" : "Hold"}</p>
                          <p className="mt-1 text-sm font-semibold text-orange-950">{row.returnHoldQty}</p>
                        </div>
                        <div className="rounded-lg bg-amber-100 p-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">{si ? "Remaining" : "Remaining"}</p>
                          <p className="mt-1 text-sm font-semibold text-amber-950">{row.pending}</p>
                        </div>
                      </div>

                      <Link
                        href={`/stock/advanced/receive?product=${encodeURIComponent(row.product.id)}`}
                        className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                      >
                        {row.mode === "lot" || row.mode === "variant_lot"
                          ? si ? "Batch / expiry assign කරන්න" : "Assign batch / expiry"
                          : row.mode === "serial" || row.mode === "variant_serial"
                            ? si ? "IMEI / serial assign කරන්න" : "Assign IMEI / serial"
                            : si ? "Variant stock assign කරන්න" : "Assign variant stock"}
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {holds.length > 0 && (
              <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-700">{si ? "Customer-return inspection" : "Customer-return inspection"}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{si ? "මෙම stock POS එකට ලබා නොදේ" : "This stock is intentionally unavailable to POS"}</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                      {si ? "Physical quantity නැවත shop එකේ ඇත, නමුත් resale approval ලබා දී නැත. Pharmacy returns ද මෙම hold එකේම තබයි. Receiving identity ලෙස නැවත assign නොකරන්න." : "The physical quantity is back in the shop, but it has not passed resale inspection. Pharmacy returns also stay here. Do not treat these holds as missing receiving identity or reassign them through the receiving form."}
                    </p>
                  </div>
                  <StatusBadge tone="warning">{holdUnits} {si ? "held" : "held"}</StatusBadge>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {holds.map((row) => (
                    <div key={row.product.id} className="rounded-xl border border-orange-100 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{row.product.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{inventoryModeLabel(row.mode, locale)}</p>
                        </div>
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">{row.returnHoldQty}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs font-semibold leading-5 text-orange-900">
                  {si ? "Release / quarantine / damage disposition workflow එක වෙනම controlled phase එකක් ලෙස build කරනු ඇත; hold quantity අද POS sale එකකට යා නොහැක." : "Release / quarantine / damage disposition will be handled by a separate controlled workflow; held quantity cannot enter a POS sale today."}
                </p>
              </section>
            )}

            {readyForPos.length > 0 && (
              <section className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">{si ? "Ready for POS" : "Ready for POS"}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{si ? "Identity coverage සම්පූර්ණ" : "Identity coverage complete"}</h2>
                  </div>
                  <StatusBadge tone="positive">{readyForPos.length}</StatusBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {readyForPos.slice(0, 12).map((row) => (
                    <span key={row.product.id} className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                      {row.product.name} · {row.product.stockQty}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}
