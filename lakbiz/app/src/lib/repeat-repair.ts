/**
 * HVAC platform Phase 11 — repeat-repair intelligence.
 *
 * Deterministic only, per the spec's absolute rule: "no AI, no fabricated
 * 'likely failure' claims... only show such messages when exactly
 * supported by stored data." This is a plain count over real job records
 * within a fixed window — nothing predictive, nothing inferred.
 *
 * Threshold and window are explicit, disclosed choices, not silently
 * picked: **2 or more repair/service jobs within the last 90 days** on
 * the same asset. Two visits inside one quarter is a real, defensible
 * "this keeps coming back" signal for an HVAC unit; one visit is just a
 * single repair, not a pattern. Only `jobType === "repair"` or
 * `"service"` count — `"installation"`/`"inspection"`/`"warranty"`/
 * `"other"` aren't repeat *repairs*. `"other"` is not counted either:
 * it's not specifically a repair by construction, and stretching it in
 * would make the count less exact than the spec's "exactly supported by
 * stored data" instruction asks for.
 */

export type RepeatRepairJob = {
  jobType: string;
  jobDate: string;
  status: string;
};

export type RepeatRepairSignal = {
  count: number;
  windowDays: number;
  /** True once `count` reaches the disclosed threshold (2) — the caller
   * decides whether/how to surface it; this function only counts. */
  triggered: boolean;
};

const REPEAT_REPAIR_WINDOW_DAYS = 90;
const REPEAT_REPAIR_THRESHOLD = 2;
const REPAIR_JOB_TYPES = new Set(["repair", "service"]);

/** `now` is a parameter, not read internally, so this stays a pure
 * function safe to call during render — matches the
 * Date.now()-outside-render convention already established elsewhere in
 * this codebase (e.g. dashboard/page.tsx's trend helpers). */
export function computeRepeatRepairSignal(
  jobs: RepeatRepairJob[],
  now: Date,
  windowDays: number = REPEAT_REPAIR_WINDOW_DAYS,
): RepeatRepairSignal {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const count = jobs.filter(
    (j) => REPAIR_JOB_TYPES.has(j.jobType) && new Date(j.jobDate).getTime() >= cutoff,
  ).length;
  return { count, windowDays, triggered: count >= REPEAT_REPAIR_THRESHOLD };
}
