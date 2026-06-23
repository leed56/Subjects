const MS_PER_DAY = 86_400_000;
export const TRIAL_EXPIRING_SOON_DAYS = 7;

export function daysUntilIso(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - now) / MS_PER_DAY);
}

export function isTrialExpiringSoon(
  status: string,
  trialEndsAt: string | null | undefined,
  withinDays = TRIAL_EXPIRING_SOON_DAYS,
): boolean {
  if (status !== "trialing") return false;
  const days = daysUntilIso(trialEndsAt);
  return days != null && days >= 0 && days <= withinDays;
}

export function countTrialsExpiringSoon<
  T extends { status: string; trialEndsAt: string | null },
>(shops: T[], withinDays = TRIAL_EXPIRING_SOON_DAYS): number {
  return shops.filter((shop) => isTrialExpiringSoon(shop.status, shop.trialEndsAt, withinDays))
    .length;
}
