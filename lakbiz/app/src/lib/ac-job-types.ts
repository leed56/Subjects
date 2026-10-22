import type { ACJobStatus } from "@/lib/ac-jobs";

/**
 * Job types (Phase 5). "service" already covers the spec's "Maintenance"
 * concept (recurring AC servicing/cleaning) and is deliberately not
 * renamed or duplicated — service-due tracking, reminder cron, and
 * messaging templates all key off the literal string "service" in ways
 * that would need auditing to safely rename; adding a separate
 * "maintenance" type alongside it would just fragment that logic. The
 * three genuinely new types below (inspection/warranty/other) are
 * additive — existing jobs and every switch/condition on ACJobType keep
 * working unchanged.
 */
export type ACJobType = "installation" | "service" | "repair" | "inspection" | "warranty" | "other";

export const AC_JOB_TYPES: {
  value: ACJobType;
  labelEn: string;
  labelSi: string;
}[] = [
  {
    value: "installation",
    labelEn: "New installation",
    labelSi: "නව අනුස්ථාපනය",
  },
  {
    value: "service",
    labelEn: "Service / maintenance",
    labelSi: "සේවාව / නඩත්තුව",
  },
  {
    value: "repair",
    labelEn: "Repair / breakdown",
    labelSi: "අළුත්වැඩියා / දෝෂ",
  },
  {
    value: "inspection",
    labelEn: "Inspection",
    labelSi: "පරීක්ෂණය",
  },
  {
    value: "warranty",
    labelEn: "Warranty claim",
    labelSi: "වගකීම් හිමිකම",
  },
  {
    value: "other",
    labelEn: "Other",
    labelSi: "වෙනත්",
  },
];

export function jobTypeLabel(type: ACJobType, locale: "si" | "en" | "ta" = "en"): string {
  const row = AC_JOB_TYPES.find((t) => t.value === type);
  if (!row) return type;
  return locale === "si" ? row.labelSi : row.labelEn;
}

export function defaultStatusForJobType(type: ACJobType): ACJobStatus {
  if (type === "installation") return "quote";
  return "scheduled";
}
