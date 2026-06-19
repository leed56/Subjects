import type { ACJobStatus } from "@/lib/ac-jobs";

export type ACJobType = "installation" | "service" | "repair";

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
    labelEn: "Service / cleaning",
    labelSi: "සේවාව / පිරිසිදු කිරීම",
  },
  {
    value: "repair",
    labelEn: "Repair / breakdown",
    labelSi: "අළුත්වැඩියා / දෝෂ",
  },
];

export function jobTypeLabel(type: ACJobType, locale: "si" | "en" = "en"): string {
  const row = AC_JOB_TYPES.find((t) => t.value === type);
  if (!row) return type;
  return locale === "si" ? row.labelSi : row.labelEn;
}

export function defaultStatusForJobType(type: ACJobType): ACJobStatus {
  if (type === "installation") return "quote";
  return "scheduled";
}
