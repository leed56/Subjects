"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type { AppData } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { canAccessShopRoute } from "@/lib/org-role/permissions";
import {
  fetchSectorOperationalSnapshot,
  summarizeTextileRolls,
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

/**
 * Single source of truth for textile "needs attention" items. Both this
 * command centre and the dashboard's own Needs Attention card call this
 * exact function against the same snapshot shape, so a quarantined roll (or
 * any other textile exception) can never be reported by one surface while
 * the other claims operations are clear — see docs, dashboard Phase 1 fix.
 */
/** Local 3-way locale pick — see the identical helper's docstring in
 * dashboard/page.tsx; kept duplicated rather than shared to avoid a new
 * cross-file import for a two-line function. */
function tt(locale: "si" | "en" | "ta", si: string, en: string, ta: string): string {
  if (locale === "si") return si;
  if (locale === "ta") return ta;
  return en;
}

export function buildTextileAttentionActions(
  snapshot: SectorOperationalSnapshot,
  locale: "si" | "en" | "ta",
): Action[] {
  const held = snapshot.textileRolls.filter((roll) => roll.status === "quarantined").length;
  const workflow = snapshot.textileWorkflow;
  const actions: Action[] = [];
  if (held) {
    actions.push({
      key: "roll-holds",
      title: tt(locale, `Roll ${held}ක් රඳවා ඇත`, `${held} roll${held === 1 ? "" : "s"} quarantined`, `${held} Rolls தனிமைப்படுத்தப்பட்டுள்ளன`),
      detail: tt(
        locale,
        "විකිණීමට පෙර තත්ත්ව හෝ ලැබීමේ ගැටලු විසඳන්න.",
        "Resolve quality or receiving issues before these rolls return to sellable stock.",
        "இந்த Rolls விற்பனைக்குத் திரும்புவதற்கு முன் தரம் அல்லது பெறுதல் சிக்கல்களைத் தீர்க்கவும்.",
      ),
      href: "/stock/rolls",
      tone: "danger",
    });
  }
  if (workflow.overdueReceivables) {
    actions.push({
      key: "overdue-credit",
      title: tt(
        locale,
        `පැහැර හැරුණු ලැබිය යුතු ${workflow.overdueReceivables}ක්`,
        `${workflow.overdueReceivables} overdue receivable${workflow.overdueReceivables === 1 ? "" : "s"}`,
        `${workflow.overdueReceivables} தாமதமான பெறத்தக்கவை`,
      ),
      detail: tt(
        locale,
        `${formatLkr(workflow.overdueAmount)} එකතු කිරීම අවශ්‍යයි.`,
        `${formatLkr(workflow.overdueAmount)} needs collection follow-up.`,
        `${formatLkr(workflow.overdueAmount)} வசூலிப்பு பின்தொடர்தல் தேவை.`,
      ),
      href: "/textile/trade-control",
      tone: "danger",
    });
  }
  if (workflow.pendingCuts) {
    actions.push({
      key: "pending-cuts",
      title: tt(
        locale,
        `කැපීම් ${workflow.pendingCuts}ක් රැඳී ඇත`,
        `${workflow.pendingCuts} cut${workflow.pendingCuts === 1 ? "" : "s"} waiting`,
        `${workflow.pendingCuts} வெட்டுகள் காத்திருக்கின்றன`,
      ),
      detail: tt(
        locale,
        "යැවීමට පෙර මිනුම් කැපීම් සම්පූර්ණ කරන්න.",
        "Complete measured cuts before warehouse dispatch.",
        "கிடங்கு அனுப்புமுன் அளவிடப்பட்ட வெட்டுகளை முடிக்கவும்.",
      ),
      href: "/stock/cutting",
      tone: "warning",
    });
  }
  if (workflow.pendingDispatches) {
    actions.push({
      key: "pending-dispatches",
      title: tt(
        locale,
        `යැවීම් ${workflow.pendingDispatches}ක් ක්‍රියාවලියේ ඇත`,
        `${workflow.pendingDispatches} dispatch${workflow.pendingDispatches === 1 ? "" : "es"} in progress`,
        `${workflow.pendingDispatches} அனுப்புகைகள் நடைபெறுகின்றன`,
      ),
      detail: tt(
        locale,
        "රැගෙන යාම, ඇසුරුම් හෝ බෙදාහැරීම තහවුරු කිරීම දිගටම කරගෙන යන්න.",
        "Continue pick, pack or delivery confirmation.",
        "எடுத்தல், பொதிதல் அல்லது டெலிவரி உறுதிப்படுத்தலைத் தொடரவும்.",
      ),
      href: "/stock/dispatch",
      tone: "warning",
    });
  }
  return actions;
}

const EMPTY_SNAPSHOT: SectorOperationalSnapshot = {
  lots: [],
  units: [],
  variants: [],
  textileRolls: [],
  textileWorkflow: {
    pendingCuts: 0,
    pendingDispatches: 0,
    activeReservations: 0,
    remnants: 0,
    customerTerms: 0,
    overdueReceivables: 0,
    overdueAmount: 0,
    recentActivity: [],
  },
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
  canSeeFinancials: boolean,
  locale: "si" | "en" | "ta",
): SectorModel {
  if (sector === "grocery" || sector === "electricals" || sector === "spare_parts") {
    return retailVelocityModel(data, sector, now);
  }

  if (sector === "textile") {
    const { activeRolls, metres, yards, reserved } = summarizeTextileRolls(snapshot);
    const workflow = snapshot.textileWorkflow;
    // Shared with the dashboard's "Needs Attention" card — see
    // buildTextileAttentionActions docstring. Do not re-derive this list
    // separately; that duplication is exactly what caused the command
    // centre and the dashboard to disagree about a quarantined roll.
    const actions = buildTextileAttentionActions(snapshot, locale);
    return {
      eyebrow: tt(locale, "රෙදි Roll බුද්ධි දත්ත", "Textile roll intelligence", "துணி Roll நுண்ணறிவு"),
      title: tt(locale, "භෞතික Rolls සහ මනින ලද ශේෂය", "Physical rolls & measured balance", "பருநிலை Rolls & அளவிடப்பட்ட இருப்பு"),
      description: tt(
        locale,
        "මුල් ඒකකය අනුව Roll මට්ටමේ දෘශ්‍යතාව. මීටර් සහ යාර වෙන වෙනම තබා ඇති නිසා පුවරුව කිසි විටෙකත් නොගැලපෙන ප්‍රමාණ මිශ්‍ර නොකරයි.",
        "Roll-level visibility by original unit. Metres and yards remain separate so the dashboard never mixes unlike quantities.",
        "அசல் அலகின்படி Roll-நிலை பார்வை. மீட்டர்களும் யார்டுகளும் தனித்தனியாக இருப்பதால் dashboard ஒருபோதும் பொருந்தாத அளவுகளைக் கலக்காது.",
      ),
      metrics: [
        { label: tt(locale, "සක්‍රීය Rolls", "Active rolls", "செயலில் உள்ள Rolls"), value: snapshot.schemaReady ? String(activeRolls) : "—", hint: tt(locale, "විකිණීමට ඇති Rolls", "Available rolls", "கிடைக்கும் Rolls"), tone: "default" },
        { label: tt(locale, "මීටර් ශේෂය", "Metre balance", "மீட்டர் இருப்பு"), value: snapshot.schemaReady ? metres.toFixed(3) : "—", hint: tt(locale, "ඉතිරි මීටර්", "Remaining metres", "மீதமுள்ள மீட்டர்கள்"), tone: "default" },
        { label: tt(locale, "යාර්ඩ් ශේෂය", "Yard balance", "யார்டு இருப்பு"), value: snapshot.schemaReady ? yards.toFixed(3) : "—", hint: tt(locale, "ඉතිරි යාර්ඩ්", "Remaining yards", "மீதமுள்ள யார்டுகள்"), tone: "default" },
        {
          label: tt(locale, "ඉතිරි කැබලි", "Remnants", "மீதிகள்"),
          value: snapshot.schemaReady ? String(workflow.remnants) : "—",
          hint: tt(
            locale,
            `සක්‍රීය වෙන් කිරීම් ${workflow.activeReservations}`,
            `${workflow.activeReservations} active reservations`,
            `${workflow.activeReservations} செயலில் உள்ள முன்பதிவுகள்`,
          ),
          tone: workflow.remnants || reserved ? "warning" : "positive",
        },
      ],
      actions,
      primaryHref: "/stock/rolls",
      primaryLabel: tt(locale, "රෙදි Rolls", "Fabric Rolls", "துணி Rolls"),
    };
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
    const incoming = vehicles.filter((v) => v.status === "incoming");
    const reconditioning = vehicles.filter((v) => v.status === "reconditioning");
    const unsold = vehicles.filter((v) => v.status !== "sold");
    const soldThisMonth = vehicles.filter((v) => v.status === "sold" && v.soldDate?.startsWith(now.toISOString().slice(0, 7)));
    const capitalTiedUp = unsold.reduce((sum, vehicle) => sum + vehicle.purchasePrice + vehicle.reconditionCost, 0);
    const preparationCost = unsold.reduce((sum, vehicle) => sum + vehicle.reconditionCost, 0);
    const realizedMargin = soldThisMonth.reduce(
      (sum, vehicle) => sum + (vehicle.soldPrice ?? 0) - vehicle.purchasePrice - vehicle.reconditionCost,
      0,
    );
    const aged60 = forSale.filter((v) => now.getTime() - new Date(v.dateAdded).getTime() >= 60 * 86_400_000);
    const aged90 = forSale.filter((v) => now.getTime() - new Date(v.dateAdded).getTime() >= 90 * 86_400_000);
    const actions: Action[] = [];
    if (aged90.length > 0) actions.push({ key: "aged-90", title: `${aged90.length} vehicle${aged90.length === 1 ? "" : "s"} listed 90+ days`, detail: "Review merchandising, condition, pricing strategy and follow-up before stock becomes stale.", href: "/vehicles", tone: "danger" });
    else if (aged60.length > 0) actions.push({ key: "aged-60", title: `${aged60.length} vehicle${aged60.length === 1 ? "" : "s"} listed 60+ days`, detail: "Aging inventory needs active follow-up before carrying time grows further.", href: "/vehicles", tone: "warning" });
    return {
      eyebrow: "Vehicle retail intelligence",
      title: "Stock age & reconditioning",
      description: "Operational vehicle aging without exposing purchase cost, minimum price or internal margin to non-owner roles.",
      metrics: canSeeFinancials
        ? [
            { label: "For sale", value: String(forSale.length), hint: `${incoming.length} incoming · ${reconditioning.length} preparing`, tone: "default" },
            { label: "Capital tied up", value: formatLkr(capitalTiedUp), hint: "Unsold purchase + preparation", tone: "default" },
            { label: "Preparation cost", value: formatLkr(preparationCost), hint: "Unsold vehicles", tone: preparationCost ? "warning" : "positive" },
            { label: "Margin this month", value: formatLkr(realizedMargin), hint: `${soldThisMonth.length} vehicle${soldThisMonth.length === 1 ? "" : "s"} sold`, tone: realizedMargin > 0 ? "positive" : realizedMargin < 0 ? "danger" : "default" },
          ]
        : [
            { label: "For sale", value: String(forSale.length), hint: "Current vehicle stock", tone: "default" },
            { label: "Incoming", value: String(incoming.length), hint: "Expected stock", tone: incoming.length ? "default" : "positive" },
            { label: "Reconditioning", value: String(reconditioning.length), hint: "Not ready for sale", tone: reconditioning.length ? "warning" : "positive" },
            { label: "Aged 60+d", value: String(aged60.length), hint: aged90.length ? `${aged90.length} at 90+ days` : "Listing age", tone: aged90.length ? "danger" : aged60.length ? "warning" : "positive" },
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
  const { org, orgRole, canSeeFinancials } = useSubscription();
  const { locale } = useLocale();
  const [snapshot, setSnapshot] = useState<SectorOperationalSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);

  useEffect(() => {
    if (!org.isAuthenticated || !org.id) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    if (!(["pharmacy", "mobile_shop", "electronics", "footwear", "textile"] as SectorId[]).includes(org.sector)) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchSectorOperationalSnapshot(org.id, org.sector, canSeeFinancials).then((result) => {
      if (cancelled) return;
      setSnapshot(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [canSeeFinancials, org.id, org.isAuthenticated, org.sector]);

  const model = useMemo(() => {
    if (!data) return null;
    return buildSectorModel(data, org.sector, snapshot, new Date(), canSeeFinancials, locale);
  }, [canSeeFinancials, data, org.sector, snapshot, locale]);

  if (!ready || !data || !model) return null;
  if (org.sector === "ac_hvac" && !canAccessShopRoute(orgRole, "/jobs")) return null;
  if (org.sector === "car_sales" && !canAccessShopRoute(orgRole, "/vehicles")) return null;

  const textile = org.sector === "textile" ? snapshot.textileWorkflow : null;
  const textileQuickActions = orgRole === "cashier"
    ? [{ href: "/sales", label: tt(locale, "නව අලෙවිය", "New sale", "புதிய விற்பனை") }, { href: "/customers", label: tt(locale, "පාරිභෝගිකයා එක් කරන්න", "Add customer", "வாடிக்கையாளரைச் சேர்") }]
    : orgRole === "data_entry"
      ? [
          { href: "/stock/rolls", label: tt(locale, "Roll ලබාගන්න", "Receive roll", "Roll-ஐப் பெறவும்") },
          { href: "/stock/cutting", label: tt(locale, "කැපීම් බලන්න", "Open cutting desk", "வெட்டு பணிமேசையைத் திற") },
          { href: "/stock/dispatch", label: tt(locale, "යැවීම් බලන්න", "Open dispatches", "அனுப்புகைகளைத் திற") },
        ]
      : [
          { href: "/stock/rolls", label: tt(locale, "Roll ලබාගන්න", "Receive roll", "Roll-ஐப் பெறவும்") },
          { href: "/sales", label: tt(locale, "නව අලෙවිය", "New sale", "புதிய விற்பனை") },
          { href: "/customers", label: tt(locale, "පාරිභෝගිකයා එක් කරන්න", "Add customer", "வாடிக்கையாளரைச் சேர்") },
          ...(canSeeFinancials ? [{ href: "/textile/trade-control", label: tt(locale, "මුදල් එකතු කිරීම", "Record collection", "வசூலிப்பைப் பதிவு செய்") }] : []),
        ];
  const textileMilestones = textile
    ? [
        { done: data.products.some((product) => product.active && product.sectorId === "textile"), label: tt(locale, "රෙදි වර්ග එක් කරන්න", "Add fabric styles", "துணி வகைகளைச் சேர்"), href: "/stock" },
        { done: snapshot.textileRolls.length > 0, label: tt(locale, "පළමු Roll එක ලබාගන්න", "Receive the first roll", "முதல் Roll-ஐப் பெறவும்"), href: "/stock/rolls" },
        ...(canSeeFinancials ? [{ done: textile.customerTerms > 0, label: tt(locale, "පාරිභෝගික ණය කොන්දේසි සකසන්න", "Set customer credit terms", "வாடிக்கையாளர் கடன் விதிமுறைகளை அமைக்கவும்"), href: "/textile/trade-control" }] : []),
        { done: data.sales.length > 0, label: tt(locale, "පළමු රෙදි අලෙවිය සාදන්න", "Complete the first fabric sale", "முதல் துணி விற்பனையை முடிக்கவும்"), href: "/sales" },
      ]
    : [];
  const incompleteMilestones = textileMilestones.filter((item) => !item.done);
  const completedMilestones = textileMilestones.length - incompleteMilestones.length;
  const isTextileSetup = Boolean(
    textile &&
      !loading &&
      snapshot.schemaReady &&
      data.products.every((product) => product.sectorId !== "textile") &&
      snapshot.textileRolls.length === 0 &&
      data.sales.length === 0,
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySales = org.sector === "textile" ? data.sales.filter((sale) => sale.date.startsWith(todayKey)) : [];
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const todayCredit = todaySales.reduce((sum, sale) => sum + sale.creditAmount, 0);

  if (isTextileSetup) {
    const nextMilestone = incompleteMilestones[0];
    const progress = textileMilestones.length > 0 ? (completedMilestones / textileMilestones.length) * 100 : 0;

    return (
      <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.8fr_1.2fr] lg:p-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">
              {tt(locale, "රෙදි ව්‍යාපාර සැකසුම", "Textile workspace setup", "துணி பணியிட அமைப்பு")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {tt(locale, "ඔබේ පළමු රෙදි අලෙවියට සූදානම් වන්න", "Get ready for your first fabric sale", "உங்கள் முதல் துணி விற்பனைக்குத் தயாராகுங்கள்")}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
              {tt(
                locale,
                "රෙදි වර්ග, Roll ශේෂ සහ පාරිභෝගික කොන්දේසි එක් වරක් සකසන්න. සැබෑ දත්ත ලැබුණු විට දෛනික ප්‍රමිතික ස්වයංක්‍රීයව පෙන්වයි.",
                "Set up fabric styles, roll balances and customer terms once. Daily operating metrics appear automatically when real activity begins.",
                "துணி வகைகள், Roll இருப்புகள் மற்றும் வாடிக்கையாளர் விதிமுறைகளை ஒருமுறை அமைக்கவும். உண்மையான செயல்பாடு தொடங்கியவுடன் தினசரி இயக்க அளவீடுகள் தானாகவே தோன்றும்.",
              )}
            </p>
            {nextMilestone ? (
              <Link
                href={nextMilestone.href}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                {nextMilestone.label}
                <span className="ml-2" aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">
                {tt(locale, "සැකසුම් ප්‍රගතිය", "Setup progress", "அமைப்பு முன்னேற்றம்")}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {completedMilestones} / {textileMilestones.length}
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
              <div className="h-full rounded-full bg-teal-500 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            <ol className="mt-4 space-y-2">
              {textileMilestones.map((item, index) => (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    className="group flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-teal-300 hover:bg-teal-50/40"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-slate-700 group-hover:text-slate-950">{item.label}</span>
                    <span className="text-sm font-bold text-teal-700" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
      {textile && (
        <div className="border-b border-slate-800 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{org.name || "LakBiz"}</p>
              <p className="text-xs text-slate-400">
                {loading
                  ? tt(locale, "දත්ත යාවත්කාලීන වෙමින්…", "Refreshing live data…", "நேரடித் தரவு புதுப்பிக்கப்படுகிறது…")
                  : snapshot.error
                    ? tt(locale, "සජීවී දත්ත ලබාගත නොහැක", "Live data unavailable", "நேரடித் தரவு கிடைக்கவில்லை")
                    : tt(locale, "සජීවී දත්ත යාවත්කාලීනයි", "Live data up to date", "நேரடித் தரவு புதுப்பித்த நிலையில் உள்ளது")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label={tt(locale, "ඉක්මන් ක්‍රියා", "Quick actions", "விரைவு செயல்கள்")}>
              {textileQuickActions.map((action, index) => (
                <Link key={action.href} href={action.href} className={index === 0 ? "inline-flex min-h-10 items-center rounded-xl bg-teal-500 px-3 text-sm font-semibold text-slate-950 hover:bg-teal-400" : "inline-flex min-h-10 items-center rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-900"}>{action.label}</Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="p-4 text-white sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">{model.eyebrow}</p>
            {!snapshot.schemaReady && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                Advanced DB pending
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight">{model.title}</h2>
          <p className="mt-1.5 max-w-lg text-xs leading-5 text-slate-300">{model.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
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
      {textile && (() => {
        // Group the (up to 5) fetched roll movements by type instead of
        // repeating near-identical "Receipt / Physical roll received" rows —
        // counts are derived only from rows actually returned by the query,
        // never inflated to a total the snapshot doesn't provide.
        const activityGroups = new Map<string, { count: number; latest: string }>();
        for (const item of textile.recentActivity) {
          const existing = activityGroups.get(item.movementType);
          if (existing) existing.count += 1;
          else activityGroups.set(item.movementType, { count: 1, latest: item.createdAt });
        }
        const hasToday = todayTotal > 0 || todaySales.length > 0;
        const columnCount = hasToday ? 3 : 2;
        return (
          <div className={`grid gap-px bg-slate-200 ${columnCount === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
            {hasToday && (
              <div className="bg-white p-4 sm:p-5">
                <p className="text-xs font-semibold text-slate-500">{tt(locale, "අද", "Today", "இன்று")}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-slate-500">{tt(locale, "අලෙවි", "Sales", "விற்பனை")}</p><p className="mt-1 font-mono text-lg font-semibold text-slate-950">{formatLkr(todayTotal)}</p></div>
                  <div><p className="text-xs text-slate-500">{tt(locale, "බිල්", "Invoices", "இன்வாய்ஸ்கள்")}</p><p className="mt-1 font-mono text-lg font-semibold text-slate-950">{todaySales.length}</p></div>
                  <div><p className="text-xs text-slate-500">{tt(locale, "ණයට", "On credit", "கடனில்")}</p><p className="mt-1 font-mono text-lg font-semibold text-amber-700">{formatLkr(todayCredit)}</p></div>
                  <div><p className="text-xs text-slate-500">{tt(locale, "ලැබුණු මුදල", "Collected now", "இப்போது வசூலிக்கப்பட்டது")}</p><p className="mt-1 font-mono text-lg font-semibold text-emerald-700">{formatLkr(Math.max(0, todayTotal - todayCredit))}</p></div>
                </div>
              </div>
            )}
            <div className="bg-white p-4 sm:p-5">
              <p className="text-xs font-semibold text-slate-500">{tt(locale, "මෑත Roll ක්‍රියාකාරකම්", "Recent roll activity", "சமீபத்திய Roll செயல்பாடு")}</p>
              {activityGroups.size ? (
                <>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {Array.from(activityGroups.entries()).map(([type, group]) => (
                      <li key={type} className="flex items-center justify-between gap-3 py-2">
                        <p className="text-sm font-medium capitalize text-slate-800">
                          {group.count} × {type.replaceAll("_", " ")}
                        </p>
                        <p className="shrink-0 text-xs text-slate-400">
                          {new Date(group.latest).toLocaleString(locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setActivityExpanded((v) => !v)}
                    className="mt-2 text-xs font-semibold text-teal-700 hover:underline"
                    aria-expanded={activityExpanded}
                  >
                    {activityExpanded
                      ? tt(locale, "අඩු විස්තර", "Hide details", "விவரங்களை மறை")
                      : tt(locale, "නවතම විස්තර පෙන්වන්න", "Show latest details", "சமீபத்திய விவரங்களைக் காட்டு")}
                  </button>
                  {activityExpanded && (
                    <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                      {textile.recentActivity.map((item) => (
                        <li key={item.id} className="text-xs text-slate-500">
                          <span className="font-medium capitalize text-slate-700">{item.movementType.replaceAll("_", " ")}</span>
                          {" · "}
                          {item.reason || `${item.balanceAfter.toFixed(3)} remaining`}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{tt(locale, "Roll ක්‍රියාකාරකම් තවම නැත.", "No roll activity yet.", "இதுவரை Roll செயல்பாடு இல்லை.")}</p>
              )}
            </div>
            <div className="bg-white p-4 sm:p-5">
              <p className="text-xs font-semibold text-slate-500">{incompleteMilestones.length ? tt(locale, "ඊළඟ සැකසුම්", "Next setup steps", "அடுத்த அமைப்பு படிகள்") : tt(locale, "සැකසුම සම්පූර්ණයි", "Setup complete", "அமைப்பு முடிந்தது")}</p>
              {incompleteMilestones.length ? <ul className="mt-2 space-y-2">{incompleteMilestones.map((item) => <li key={item.href + item.label}><Link href={item.href} className="flex min-h-10 items-center justify-between rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50/40"><span>{item.label}</span><span aria-hidden="true">→</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-emerald-700">{tt(locale, "ප්‍රධාන සැකසුම් පියවර හතරම සම්පූර්ණයි.", "All four operational setup milestones are complete.", "அனைத்து நான்கு செயல்பாட்டு அமைப்பு படிகளும் முடிந்துவிட்டன.")}</p>}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
