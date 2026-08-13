/**
 * HVAC platform Phase 8 — the one authoritative job-profitability
 * calculation. Every prior phase (4/5 material sources + historical
 * cost, 6 labor, 7 other costs) built the inputs this function combines;
 * before this phase, the combination logic itself lived only inside
 * `/job-costing`'s page component. Anything that needs a job's cost/
 * profit/margin — the Job Sheet drawer, Reports (Phase 24), a future
 * dashboard — should import this instead of re-deriving the sum, so the
 * formula only ever exists in one place.
 *
 * Formula (matches the spec exactly):
 *   Total Job Cost = Material + Labor + Other
 *   Gross Profit    = Revenue − Total Job Cost
 *   Gross Margin %  = Gross Profit / Revenue × 100   (null when Revenue is 0)
 *
 * Bucket mapping, since the underlying data has more than three shapes:
 *   Material = Σ job_items where itemType === "part"        (Phase 4/5 —
 *              includes stock/purchased/customer-supplied parts; each
 *              line's unitPrice is already a real cost, historical for
 *              stock-sourced ones)
 *   Labor    = Σ job_items where itemType === "labour"       (Phase 6 —
 *              internal technician cost, never the customer charge)
 *            + job.subcontractCost when the job is contractor-assigned
 *              (paying an external party to do the work is still labor,
 *              just not in-house)
 *   Other    = Σ job_items where itemType === "service"       (not raw
 *              material or a technician/contractor's own labor — e.g. a
 *              diagnostic/inspection fee cost)
 *            + job-linked Expenses total (Phase 7 — parking, equipment
 *              rental, outsourced repair, misc; deliberately excludes
 *              the "subcontractor" concept, which is already the
 *              subcontractCost term above, so it isn't counted twice)
 *
 * Revenue = job.quotedAmount as-is. Audited before writing this (per the
 * spec's "do not accidentally include VAT in profit" instruction):
 * ACJob/ACJobInput has no VAT field anywhere — AC jobs are a flat
 * negotiated price with no VAT breakout in this codebase today, unlike
 * Sale (output_vat) or Purchase (input_vat). There is currently no VAT
 * component to accidentally include here; if AC jobs ever gain VAT
 * tracking, this function's `revenue` line is the one place that would
 * need to change to net it out.
 */
import type { ACJob, JobItem } from "./store/types";

export type JobProfitability = {
  materialCost: number;
  laborCost: number;
  otherCost: number;
  totalCost: number;
  revenue: number;
  grossProfit: number;
  /** null when revenue is 0 — never divide by zero, never show a
   * misleading 0%/Infinity%. */
  grossMarginPct: number | null;
};

export function computeJobProfitability(
  job: ACJob,
  jobItems: JobItem[],
  /** Job-linked Expenses total (Phase 7) — the caller fetches this
   * (Expenses is cloud-only, not part of the local-first store this
   * function otherwise depends on) and passes the sum in. */
  linkedExpenseTotal: number,
): JobProfitability {
  let materialCost = 0;
  let laborCost = 0;
  let otherCost = linkedExpenseTotal;

  for (const item of jobItems) {
    if (item.itemType === "part") materialCost += item.lineTotal;
    else if (item.itemType === "labour") laborCost += item.lineTotal;
    else otherCost += item.lineTotal; // "service"
  }

  if (job.assigneeType === "contractor") {
    laborCost += job.subcontractCost ?? 0;
  }

  const totalCost = materialCost + laborCost + otherCost;
  const revenue = job.quotedAmount;
  const grossProfit = revenue - totalCost;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : null;

  return { materialCost, laborCost, otherCost, totalCost, revenue, grossProfit, grossMarginPct };
}
