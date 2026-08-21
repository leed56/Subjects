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
 *              rental, outsourced repair, misc), EXCLUDING any
 *              "outsourced_repair"-category expense on a job that is
 *              already contractor-assigned with a subcontractCost set.
 *
 *              CORRECTION (Phase 20 accounting audit, found by re-reading
 *              this file's own claim against the actual code rather than
 *              trusting it): this section previously said the Expenses
 *              total "deliberately excludes the subcontractor concept...
 *              so it isn't counted twice" — true for the *category*
 *              named "subcontractor" (deliberately never added to
 *              ExpenseCategory, see expenses-client.ts), but false in
 *              practice, because "outsourced_repair" is the same real
 *              cost under a different name and was never excluded from
 *              this sum. A shop could set ac_jobs.subcontractCost for a
 *              contractor-assigned job AND separately log an
 *              "Outsourced repair" Expense linked to that same job —
 *              nothing in the UI or this function stopped it — and the
 *              cost would be counted twice: once here, once in
 *              subcontractCost above. Fixed by excluding
 *              "outsourced_repair" from this sum specifically when the
 *              job already carries a subcontractCost, the one case where
 *              the two are provably the same underlying payment.
 *
 *              job-parts-materials phase: "parts_purchase"-category
 *              Expenses are ALWAYS excluded here, unconditionally — that
 *              category is only ever created programmatically alongside
 *              an "External Purchase, Expense only" job_items line (see
 *              actions.ts / docs/JOB_PARTS_ARCHITECTURE.md §2.2), whose
 *              own lineTotal already counts as Material cost above. The
 *              linked Expense record exists purely so the purchase shows
 *              up in shop-wide expense totals and VAT input-tax figures
 *              — it is never a second, independent cost to this job.
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

/** The only two Expense fields this function needs — kept minimal
 * (rather than importing the full Expense type from the cloud-only
 * expenses-client.ts) so this file stays dependency-light. */
export type JobLinkedExpense = { category: string; amount: number };

export function computeJobProfitability(
  job: ACJob,
  jobItems: JobItem[],
  /** Job-linked Expenses (Phase 7) — the caller fetches these (Expenses
   * is cloud-only, not part of the local-first store this function
   * otherwise depends on) and passes this job's own linked rows in.
   * Itemized rather than pre-summed specifically so this function can
   * apply the outsourced_repair/subcontractCost double-count guard
   * below — summing before calling would defeat it. */
  linkedExpenses: JobLinkedExpense[],
): JobProfitability {
  let materialCost = 0;
  let laborCost = 0;

  // Double-count guard: "outsourced_repair" is the same real payment as
  // ac_jobs.subcontractCost under a different label once a job is
  // contractor-assigned with a cost already recorded there — see the
  // file-header correction above. Only skip it in that specific case;
  // an outsourced_repair expense on a non-contractor job is a genuine,
  // distinct cost and still counts normally.
  const skipOutsourcedRepair =
    job.assigneeType === "contractor" && (job.subcontractCost ?? 0) > 0;
  let otherCost = linkedExpenses.reduce((sum, e) => {
    if (skipOutsourcedRepair && e.category === "outsourced_repair") return sum;
    // Always excluded — see the file-header note above. This category
    // exists solely to mirror an already-counted job_items line into
    // shop-wide expense/VAT reporting, never to add a second cost here.
    if (e.category === "parts_purchase") return sum;
    return sum + e.amount;
  }, 0);

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

/**
 * HVAC platform Phase 14 (dashboard) — the one explicit, defensible
 * "low margin" rule, per the spec's "do not label a job low margin
 * without an explicit defensible rule." A flat percentage threshold,
 * not a guess or a trend: 15% gross margin is a conservative floor for
 * HVAC field service (materials + labor typically run 60-85% of a
 * quoted price in this trade), disclosed here as the single place this
 * number is defined so every screen that flags a job means the same
 * thing by it.
 *
 * Jobs with no assessable margin (revenue is 0, `grossMarginPct` is
 * null) are never flagged — "cannot be assessed" is not the same claim
 * as "low margin," and conflating them would be exactly the kind of
 * fabricated signal the spec forbids.
 */
export const LOW_MARGIN_THRESHOLD_PCT = 15;

export function isLowMarginJob(profit: JobProfitability): boolean {
  return profit.grossMarginPct !== null && profit.grossMarginPct < LOW_MARGIN_THRESHOLD_PCT;
}
