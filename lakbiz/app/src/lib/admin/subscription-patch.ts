import type { BillingCycle } from "@/lib/subscription/types";

const MAX_EXTEND_DAYS = 90;

export function parseTrialEndsAtInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const end = new Date(`${trimmed}T23:59:59.999Z`);
    return Number.isFinite(end.getTime()) ? end.toISOString() : null;
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function extendTrialFromDays(
  currentTrialEndsAt: string | null | undefined,
  days: number,
): string | null {
  if (!Number.isInteger(days) || days < 1 || days > MAX_EXTEND_DAYS) {
    return null;
  }

  const base = Math.max(
    Date.now(),
    currentTrialEndsAt ? Date.parse(currentTrialEndsAt) : Date.now(),
  );
  if (!Number.isFinite(base)) return null;

  return new Date(base + days * 86_400_000).toISOString();
}

export function shouldReactivateTrial(
  status: string | null | undefined,
  trialEndsAt: string | null,
): boolean {
  if (!trialEndsAt) return false;
  if (Date.parse(trialEndsAt) <= Date.now()) return false;
  return status === "read_only" || status === "past_due";
}

export function parseBillingCycle(value: unknown): BillingCycle | null {
  if (value === "monthly" || value === "annual") return value;
  return null;
}

/** Next period end for manual LakBiz billing (monthly or annual). */
export function periodEndFromCycle(cycle: BillingCycle, fromMs = Date.now()): string {
  const d = new Date(fromMs);
  if (cycle === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

export { MAX_EXTEND_DAYS };
