"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store/use-app-store";
import type { AppData } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { canAccessShopRoute } from "@/lib/org-role/permissions";
import {
  fetchSectorOperationalSnapshot,
  type SectorOperationalSnapshot,
} from "@/lib/supabase/sector-dashboard-client";
import type { SectorId } from "@/lib/types";

type Tone = "default" | "positive" | "warning" | "danger";
type Metric = { label: string; value: string; hint: string; tone: Tone };
type Action = { key: string; title: string; detail: string; href: string; tone: "warning" | "danger" };
type SectorModel = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: Metric[];
  actions: Action[];
  primaryHref: string;
  primaryLabel: string;
};

const EMPTY_SNAPSHOT: SectorOperationalSnapshot = {
  lots: [],
  units: [],
  variants: [],
  schemaReady: true,
  error: null,
};

function daysBetween(date: string, base: Date): number {
  const target = new Date(`${date}T00:00:00`);
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.ceil((target.getTime() - start.getTime()) / 86_400_000);
}

function productMovementMap(data: AppData): Map<string, number> {
  const map = new Map<string, number>();
  for (const log of data.stockLogs) {
    const ts = new Date(log.date).getTime();
    const existing = map.get(log.productId) ?? 0;
    if (Number.isFinite(ts) && ts > existing) map.set(log.productId, ts);
  }
  return map;
}

function soldQtySince(data: AppData, sinceMs: number): Map<string, number> {
  const result = new Map<string, number>();
  for (const sale of data.sales) {
    if (new Date(sale.date).getTime() < sinceMs) continue;
    for (const line of sale.lines) {
      result.set(line.productId, (result.get(line.productId) ?? 0) + line.qty);
    }
  }
  return result;
}

function retailVelocityModel(data: AppData, sector: SectorId, now: Date): SectorModel {
  const active = data.products.filter((p) => p.active && p.sectorId === sector);
  const sold30 = soldQtySince(data, now.getTime() - 30 * 86_400_000);
  const noSales30 = active.filter((p) => p.stockQty > 0 && (sold30.get(p.id) ?? 0) === 0);
  const lowStock = active.filter((p) => p.stockQty <= (p.reorderLevel ?? 5));
  const top = [...active]
    .map((p) => ({ product: p, qty: sold30.get(p.id) ?? 0 }))
    .sort((a, b) => b.qty - a.qty)[0];
  const labels: Partial<Record<SectorId, { eyebrow: string; title: string; description: string }>> = {
    grocery: {
      eyebrow: "Stock intelligence",
      title: "Shelf movement & replenishment",
      description: "Focus on fast movers, dormant shelf stock and reorder pressure without exposing internal cost.",
    },
    electricals: {
      eyebrow: "Electrical retail intelligence",
      title: "Demand & replenishment pulse",
      description: "Highlights movement and stock pressure across fittings, cables, switches and electrical lines.",
    },
    spare_parts: {
      eyebrow: "Parts intelligence",
      title: "Movement & dormant-stock control",
      description: "Surfaces reorder pressure and parts that are occupying shelf space without recent movement.",
    },
    textile: {
      eyebrow: "Textile trading intelligence",
      title: "Fabric movement & replenishment",
      description: "Tracks catalogue movement now; roll balances, dye lots, reservations and remnants activate with the physical-roll phases.",
    },
  };
  const copy = labels[sector] ?? labels.grocery!;
  const movement = productMovementMap(data);
  const dormant90 =
    sector === "spare_parts"
      ? active.filter((p) => {
          if (p.stockQty <= 0) return false;
          const last = movement.get(p.id) ?? 0;
          return last === 0 || now.getTime() - last >= 90 * 86_400_000;
        }).length
      : noSales30.length;

  const actions: Action[] = [];
  if (lowStock.length > 0) {
    actions.push({
      key: "low-stock",
      title: `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} at reorder level`,
      detail: "Review replenishment before availability becomes a sales problem.",
      href: "/stock",
      tone: "warning",
    });
  }
  if (dormant90 > 0) {
    actions.push({
      key: "dormant",
      title: sector === "spare_parts" ? `${dormant90} dormant part${dormant90 === 1 ? "" : "s"}` : `${dormant90} stocked item${dormant90 === 1 ? "" : "s"} with no sale in 30 days`,
      detail: sector === "spare_parts" ? "No stock movement for roughly 90 days; review shelf allocation and purchasing." : "Consider merchandising, pricing review or avoiding another reorder until movement improves.",
      href: "/stock",
      tone: "warning",
    });
  }

  return {
    ...copy,
    metrics: [
      { label: "Active SKUs", value: String(active.length), hint: "Sellable catalogue", tone: "default" },
      { label: "Reorder pressure", value: String(lowStock.length), hint: "At / below reorder level", tone: lowStock.length ? "warning" : "positive" },
      { label: sector === "spare_parts" ? "Dormant 90d" : "No sales 30d", value: String(dormant90), hint: "Stock needing review", tone: dormant90 ? "warning" : "positive" },
      { label: "Top mover 30d", value: top && top.qty > 0 ? String(top.qty) : "—", hint: top && top.qty > 0 ? top.product.name : "No movement yet", tone: top && top.qty > 0 ? "positive" : "default" },
    ],
    actions,
    primaryHref: "/stock",
    primaryLabel: "Open Stock",
  };
}

function buildSectorModel(
  data: AppData,
  sector: SectorId,
  snapshot: SectorOperationalSnapshot,
  now: Date,
): SectorModel {
  if (sector === "grocery" || sector === "electricals" || sector === "spare_parts" || sector === "textile") {
    return retailVelocityModel(data, sector, now);
  }

  if (sector === "pharmacy") {
    const stockedLots = snapshot.lots.filter((lot) => lot.qtyOnHand > 0);
    const expired = stockedLots.filter((lot) => lot.status === "expired" || (lot.expiryDate ? daysBetween(lot.expiryDate, now) < 0 : false));
    const expiring30 = stockedLots.filter((lot) => lot.status === "available" && lot.expiryDate && daysBetween(lot.expiryDate, now) >= 0 && daysBetween(lot.expiryDate, now) <= 30);
    const blocked = stockedLots.filter((lot) => lot.status === "quarantine" || lot.status === "recalled" || lot.status === "returned");
    const availableQty = stockedLots.filter((lot) => lot.status === "available").reduce((sum, lot) => sum + lot.qtyOnHand, 0);
    const actions: Action[] = [];
    if (expired.length || blocked.length) {
      actions.push({
        key: "unsafe-batches",
        title: `${expired.length + blocked.length} batch${expired.length + blocked.length === 1 ? "" : "es"} blocked from normal sale`,
        detail: "Expired, recalled, quarantined or returned medicine needs controlled disposition.",
        href: "/stock/advanced",
        tone: "danger",
      });
    }
    if (expiring30.length) {
      actions.push({
        key: "expiry-30",
        title: `${expiring30.length} batch${expiring30.length === 1 ? "" : "es"} expire within 30 days`,
        detail: "Prioritize FEFO dispensing and avoid unnecessary replenishment of the same line.",
        href: "/stock/advanced",
        tone: "warning",
      });
    }
    return {
      eyebrow: "Stock intelligence",
      title: "Expiry & batch safety",
      description: "FEFO-focused operational control. Cost remains owner-only; this panel uses batch identity and sellable quantity only.",
      metrics: [
        { label: "Available batch qty", value: snapshot.schemaReady ? String(availableQty) : "—", hint: "Sellable batch stock", tone: "default" },
        { label: "Expiry ≤30d", value: snapshot.schemaReady ? String(expiring30.length) : "—", hint: "FEFO attention", tone: expiring30.length ? "warning" : "positive" },
        { label: "Blocked batches", value: snapshot.schemaReady ? String(expired.length + blocked.length) : "—", hint: "Expired / recall / hold", tone: expired.length + blocked.length ? "danger" : "positive" },
        { label: "Low-stock SKUs", value: String(data.products.filter((p) => p.active && p.sectorId === sector && p.stockQty <= (p.reorderLevel ?? 5)).length), hint: "Aggregate reorder signal", tone: "default" },
      ],
      actions,
      primaryHref: "/stock/advanced",
      primaryLabel: "Batch Control",
    };
  }

  if (sector === "mobile_shop" || sector === "electronics") {
    const available = snapshot.units.filter((u) => u.status === "available");
    const serviceRisk = snapshot.units.filter((u) => u.status === "service" || u.status === "damaged" || u.status === "returned");
    const warrantySoon = snapshot.units.filter((u) => u.status === "sold" && u.warrantyExpiry && daysBetween(u.warrantyExpiry, now) >= 0 && daysBetween(u.warrantyExpiry, now) <= 30);
    const missingIdentity = available.filter((u) => sector === "mobile_shop" ? !u.imei : !u.serialNo && !u.imei).length;
    const actions: Action[] = [];
    if (missingIdentity > 0) {
      actions.push({
        key: "identity-gap",
        title: `${missingIdentity} available unit${missingIdentity === 1 ? "" : "s"} missing expected identity`,
        detail: sector === "mobile_shop" ? "Register IMEI before checkout so the sale keeps exact device traceability." : "Register serial / IMEI identity before sale for exact warranty traceability.",
        href: "/stock/advanced",
        tone: "danger",
      });
    }
    if (serviceRisk.length > 0) {
      actions.push({
        key: "service-risk",
        title: `${serviceRisk.length} unit${serviceRisk.length === 1 ? "" : "s"} in return / service / damaged state`,
        detail: "Keep these units outside normal available stock until their disposition is resolved.",
        href: "/stock/advanced/returns",
        tone: "warning",
      });
    }
    return {
      eyebrow: sector === "mobile_shop" ? "Mobile retail intelligence" : "Electronics intelligence",
      title: sector === "mobile_shop" ? "IMEI, warranty & device state" : "Serial, warranty & device state",
      description: "Identity-first control for individual devices. Internal device cost is intentionally excluded from this operational panel.",
      metrics: [
        { label: "Available units", value: snapshot.schemaReady ? String(available.length) : "—", hint: "Exact serialized stock", tone: "default" },
        { label: sector === "mobile_shop" ? "IMEI gaps" : "Identity gaps", value: snapshot.schemaReady ? String(missingIdentity) : "—", hint: "Available units", tone: missingIdentity ? "danger" : "positive" },
        { label: "Warranty ≤30d", value: snapshot.schemaReady ? String(warrantySoon.length) : "—", hint: "Sold units nearing expiry", tone: warrantySoon.length ? "warning" : "default" },
        { label: "Service / return", value: snapshot.schemaReady ? String(serviceRisk.length) : "—", hint: "Non-sellable units", tone: serviceRisk.length ? "warning" : "positive" },
      ],
      actions,
      primaryHref: "/stock/advanced",
      primaryLabel: sector === "mobile_shop" ? "Device Control" : "Serial Control",
    };
  }

  if (sector === "footwear") {
    const variants = snapshot.variants.filter((v) => v.active);
    const zero = variants.filter((v) => v.stockQty <= 0);
    const low = variants.filter((v) => v.stockQty > 0 && v.reorderLevel != null && v.stockQty <= v.reorderLevel);
    const grouped = new Map<string, typeof variants>();
    for (const variant of variants) {
      const list = grouped.get(variant.productId) ?? [];
      list.push(variant);
      grouped.set(variant.productId, list);
    }
    const gapProducts = Array.from(grouped.values()).filter((rows) => rows.some((v) => v.stockQty > 0) && rows.some((v) => v.stockQty <= 0)).length;
    const actions: Action[] = [];
    if (gapProducts > 0) {
      actions.push({
        key: "size-gaps",
        title: `${gapProducts} style${gapProducts === 1 ? "" : "s"} have size / colour gaps`,
        detail: "The style is partially stocked but at least one active variant is unavailable.",
        href: "/stock/advanced",
        tone: "warning",
      });
    }
    if (low.length > 0) {
      actions.push({
        key: "variant-low",
        title: `${low.length} variant${low.length === 1 ? "" : "s"} near reorder level`,
        detail: "Replenish the exact size / colour instead of over-ordering the whole style.",
        href: "/stock/advanced",
        tone: "warning",
      });
    }
    return {
      eyebrow: "Footwear intelligence",
      title: "Size & colour availability",
      description: "Variant-level availability shows where a style looks stocked overall but is missing the exact size or colour a customer needs.",
      metrics: [
        { label: "Active variants", value: snapshot.schemaReady ? String(variants.length) : "—", hint: "Size / colour combinations", tone: "default" },
        { label: "Out of stock", value: snapshot.schemaReady ? String(zero.length) : "—", hint: "Active variants", tone: zero.length ? "warning" : "positive" },
        { label: "Style gaps", value: snapshot.schemaReady ? String(gapProducts) : "—", hint: "Partially stocked styles", tone: gapProducts ? "warning" : "positive" },
        { label: "Low variants", value: snapshot.schemaReady ? String(low.length) : "—", hint: "Exact reorders", tone: low.length ? "warning" : "positive" },
      ],
      actions,
      primaryHref: "/stock/advanced",
      primaryLabel: "Variant Control",
    };
  }

  if (sector === "ac_hvac") {
    const today = now.toISOString().slice(0, 10);
    const due30 = new Date(now);
    due30.setDate(due30.getDate() + 30);
    const due30Key = due30.toISOString().slice(0, 10);
    const activeJobs = data.acJobs.filter((job) => job.status !== "cancelled" && job.status !== "completed");
    const scheduledToday = activeJobs.filter((job) => job.scheduledDate === today).length;
    const unassigned = activeJobs.filter((job) => !job.assigneeId && !job.assignedTechnician).length;
    const overdue = data.acJobs.filter((job) => job.serviceDueDate && job.serviceDueDate < today && job.status !== "cancelled").length;
    const dueSoon = data.acJobs.filter((job) => job.serviceDueDate && job.serviceDueDate >= today && job.serviceDueDate <= due30Key && job.status !== "cancelled").length;
    const actions: Action[] = [];
    if (unassigned > 0) actions.push({ key: "unassigned", title: `${unassigned} active job${unassigned === 1 ? "" : "s"} unassigned`, detail: "Assign technicians or contractors before work is delayed.", href: "/jobs", tone: "danger" });
    if (overdue > 0) actions.push({ key: "service-overdue", title: `${overdue} service${overdue === 1 ? "" : "s"} overdue`, detail: "Recover missed preventive-maintenance visits and customer follow-up.", href: "/jobs", tone: "danger" });
    return {
      eyebrow: "HVAC operations intelligence",
      title: "Jobs, crews & service retention",
      description: "A service-business pulse built around assignment discipline, today's field load and recurring-maintenance retention.",
      metrics: [
        { label: "Active jobs", value: String(activeJobs.length), hint: "Open operational work", tone: "default" },
        { label: "Scheduled today", value: String(scheduledToday), hint: "Field workload", tone: "default" },
        { label: "Unassigned", value: String(unassigned), hint: "Needs ownership", tone: unassigned ? "danger" : "positive" },
        { label: "Service due ≤30d", value: String(overdue + dueSoon), hint: overdue ? `${overdue} overdue` : "Retention pipeline", tone: overdue ? "danger" : dueSoon ? "warning" : "positive" },
      ],
      actions,
      primaryHref: "/jobs",
      primaryLabel: "Open Jobs",
    };
  }

  if (sector === "car_sales") {
    const vehicles = data.vehicles;
    const forSale = vehicles.filter((v) => v.status === "for_sale");
    const reconditioning = vehicles.filter((v) => v.status === "reconditioning");
    const aged60 = forSale.filter((v) => now.getTime() - new Date(v.dateAdded).getTime() >= 60 * 86_400_000);
    const aged90 = forSale.filter((v) => now.getTime() - new Date(v.dateAdded).getTime() >= 90 * 86_400_000);
    const actions: Action[] = [];
    if (aged90.length > 0) actions.push({ key: "aged-90", title: `${aged90.length} vehicle${aged90.length === 1 ? "" : "s"} listed 90+ days`, detail: "Review merchandising, condition, pricing strategy and follow-up before stock becomes stale.", href: "/vehicles", tone: "danger" });
    else if (aged60.length > 0) actions.push({ key: "aged-60", title: `${aged60.length} vehicle${aged60.length === 1 ? "" : "s"} listed 60+ days`, detail: "Aging inventory needs active follow-up before carrying time grows further.", href: "/vehicles", tone: "warning" });
    return {
      eyebrow: "Vehicle retail intelligence",
      title: "Stock age & reconditioning",
      description: "Operational vehicle aging without exposing purchase cost, minimum price or internal margin to non-owner roles.",
      metrics: [
        { label: "For sale", value: String(forSale.length), hint: "Current vehicle stock", tone: "default" },
        { label: "Reconditioning", value: String(reconditioning.length), hint: "Not ready for sale", tone: reconditioning.length ? "warning" : "positive" },
        { label: "Aged 60+d", value: String(aged60.length), hint: "Listing age", tone: aged60.length ? "warning" : "positive" },
        { label: "Aged 90+d", value: String(aged90.length), hint: "Priority aging", tone: aged90.length ? "danger" : "positive" },
      ],
      actions,
      primaryHref: "/vehicles",
      primaryLabel: "Vehicle Stock",
    };
  }

  return retailVelocityModel(data, "grocery", now);
}

function toneClasses(tone: Tone): string {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-950";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  return "border-slate-200 bg-white text-slate-950";
}

export function SectorCommandCenter() {
  const { data, ready } = useAppStore();
  const { org, orgRole } = useSubscription();
  const [snapshot, setSnapshot] = useState<SectorOperationalSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!org.isAuthenticated || !org.id) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    if (!(["pharmacy", "mobile_shop", "electronics", "footwear"] as SectorId[]).includes(org.sector)) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchSectorOperationalSnapshot(org.id, org.sector).then((result) => {
      if (cancelled) return;
      setSnapshot(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, org.sector]);

  const model = useMemo(() => {
    if (!data) return null;
    return buildSectorModel(data, org.sector, snapshot, new Date());
  }, [data, org.sector, snapshot]);

  if (!ready || !data || !model) return null;
  if (org.sector === "ac_hvac" && !canAccessShopRoute(orgRole, "/jobs")) return null;
  if (org.sector === "car_sales" && !canAccessShopRoute(orgRole, "/vehicles")) return null;

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
      <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">{model.eyebrow}</p>
            {!snapshot.schemaReady && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                Advanced DB pending
              </span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{model.title}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">{model.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href={model.primaryHref} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-teal-400">
              {model.primaryLabel}
            </Link>
            {loading && <span className="text-xs font-medium text-slate-400">Refreshing operational telemetry…</span>}
            {!loading && snapshot.error && <span className="text-xs font-medium text-rose-300">Advanced telemetry unavailable</span>}
          </div>
        </div>

        <div className="bg-slate-50 p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {model.metrics.map((metric) => (
              <div key={metric.label} className={`rounded-xl border p-3.5 ${toneClasses(metric.tone)}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-60">{metric.label}</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums">{metric.value}</p>
                <p className="mt-1 text-[11px] font-medium opacity-65">{metric.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {model.actions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                No sector-specific operational exception needs immediate action.
              </div>
            ) : (
              model.actions.slice(0, 3).map((action) => (
                <Link
                  key={action.key}
                  href={action.href}
                  className={`flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 transition hover:border-teal-300 hover:shadow-sm ${action.tone === "danger" ? "border-rose-200" : "border-amber-200"}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{action.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{action.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-teal-700">Review →</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
