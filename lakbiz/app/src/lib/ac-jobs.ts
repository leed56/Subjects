export type ACJobStatus =
  | "quote"
  | "deposit_received"
  | "scheduled"
  | "installed"
  | "service_due"
  | "completed"
  | "cancelled";

export const AC_JOB_STATUSES: {
  value: ACJobStatus;
  labelEn: string;
  labelSi: string;
}[] = [
  { value: "quote", labelEn: "Quote / Site visit", labelSi: "ඇස්තමේන්තුව" },
  {
    value: "deposit_received",
    labelEn: "Deposit received",
    labelSi: "මුදල් ලැබුණා",
  },
  { value: "scheduled", labelEn: "Install scheduled", labelSi: "අනුස්ථාපන දිනය" },
  { value: "installed", labelEn: "Installed", labelSi: "අනුස්ථාපනය කළා" },
  { value: "service_due", labelEn: "Service due", labelSi: "සේවාව අවශ්‍ය" },
  { value: "completed", labelEn: "Completed", labelSi: "සම්පූර්ණ" },
  { value: "cancelled", labelEn: "Cancelled", labelSi: "අවලංගු" },
];

export const AC_BTU_OPTIONS = [
  9000, 12000, 18000, 24000, 30000, 36000, 48000,
];

export const AC_BRANDS = [
  "Daikin",
  "LG",
  "Gree",
  "Midea",
  "Panasonic",
  "TCL",
  "Hisense",
  "Other",
];

export function generateJobNo(count: number): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `JOB-${d}-${String(count + 1).padStart(4, "0")}`;
}

export function jobStatusLabel(
  status: ACJobStatus,
  locale: "si" | "en" = "si",
): string {
  const row = AC_JOB_STATUSES.find((s) => s.value === status);
  if (!row) return status;
  return locale === "si" ? row.labelSi : row.labelEn;
}
