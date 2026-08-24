import { createHash } from "node:crypto";
import { stableHash } from "./core.mjs";

function uuidFromSeed(seed) {
  const hex = createHash("sha256").update(String(seed)).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function daysFromNow(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return dateOnly(d);
}

function daysAgo(days) {
  return daysFromNow(-days);
}

export function ensureTrackedDemoStock(stockQty, trackedIndex) {
  const n = Math.max(0, Number(stockQty) || 0);
  return trackedIndex < 3 ? Math.max(12, n) : n;
}

function lotRow(orgId, product, suffix, qty, status, expiryDays, note, receivedOffset = 35) {
  return {
    id: uuidFromSeed(`${orgId}:${product.id}:demo-lot:${suffix}`),
    organization_id: orgId,
    product_id: product.id,
    variant_id: null,
    batch_no: `DEMO-${stableHash(`${product.id}:${suffix}`).toUpperCase()}-${suffix.toUpperCase()}`,
    manufactured_date: daysAgo(240 + (stableHash(product.id).charCodeAt(0) % 180)),
    expiry_date: daysFromNow(expiryDays),
    received_date: daysAgo(receivedOffset),
    supplier_id: null,
    qty_received: qty,
    qty_on_hand: qty,
    status,
    notes: note,
  };
}

/**
 * Returns deterministic synthetic lot fixtures whose quantities always sum to
 * the product aggregate stock. The first tracked products intentionally model
 * the three workflows a pharmacy demo needs to show.
 */
export function buildDemoLotRows(orgId, product, trackedIndex, stockQty) {
  const total = Math.max(0, Number(stockQty) || 0);
  if (total <= 0) return [];

  if (trackedIndex === 0 && total >= 2) {
    const blocked = Math.max(1, Math.floor(total * 0.25));
    const valid = total - blocked;
    return [
      lotRow(
        orgId,
        product,
        "expired",
        blocked,
        "expired",
        -20,
        "DEMO synthetic expired batch for expiry-block testing; batch/date/quantity are not source-derived.",
        120,
      ),
      lotRow(
        orgId,
        product,
        "valid",
        valid,
        "available",
        240,
        "DEMO synthetic valid companion batch. Product master provenance remains source-derived.",
        35,
      ),
    ];
  }

  if (trackedIndex === 1 && total >= 2) {
    const near = Math.max(1, Math.floor(total * 0.4));
    const later = total - near;
    return [
      lotRow(
        orgId,
        product,
        "near",
        near,
        "available",
        45,
        "DEMO synthetic near-expiry batch intended to be selected first by FEFO.",
        28,
      ),
      lotRow(
        orgId,
        product,
        "later",
        later,
        "available",
        365,
        "DEMO synthetic later-expiry companion batch for FEFO comparison.",
        21,
      ),
    ];
  }

  if (trackedIndex === 2 && total >= 2) {
    const quarantine = Math.max(1, Math.floor(total * 0.25));
    const valid = total - quarantine;
    return [
      lotRow(
        orgId,
        product,
        "quarantine",
        quarantine,
        "quarantine",
        190,
        "DEMO synthetic quarantined batch for inspection/non-saleable workflow testing.",
        50,
      ),
      lotRow(
        orgId,
        product,
        "saleable",
        valid,
        "available",
        300,
        "DEMO synthetic saleable companion batch. Product master provenance remains source-derived.",
        30,
      ),
    ];
  }

  return [
    lotRow(
      orgId,
      product,
      "standard",
      total,
      "available",
      180 + (trackedIndex % 540),
      "DEMO synthetic batch/expiry. Product master provenance remains source-derived.",
      20 + (trackedIndex % 70),
    ),
  ];
}
