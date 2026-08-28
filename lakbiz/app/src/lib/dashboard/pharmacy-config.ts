/**
 * Single source of truth for the pharmacy "near expiry" window.
 *
 * Before this constant existed, three widgets computed their own expiry
 * cutoff independently and disagreed with each other on the same live
 * dashboard: sector-command-center.tsx's "Expiry ≤30d" used a 30-day
 * window, while retail-intelligence.ts's buildExpiryMetrics() (which feeds
 * the "Near expiry" KPI card, the "Needs attention" panel, and the "Batch &
 * expiry control" queue — all three, in retail-command-center.tsx) used a
 * 90-day window. A batch expiring in 41 days would show as "0" in one
 * widget and "1" in the other three, on the same screen, at the same time.
 *
 * 30 days is the default here — the more urgent of the two prior values,
 * and the one already user-facing in the "Expiry ≤30d" label — but this is
 * a pharmacy-operations decision (how far out FEFO attention should start),
 * not a purely technical one. Confirm the right value with the business
 * owner; changing it is this one line.
 */
export const NEAR_EXPIRY_DAYS = 30;
