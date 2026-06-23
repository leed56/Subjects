/** Normalize Sri Lankan mobile numbers to international digits (947XXXXXXXX). */
export function normalizeSlPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("94") && digits.length === 11) return digits;
  if (digits.startsWith("07") && digits.length === 10) return `94${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `94${digits}`;
  if (digits.length >= 9) return digits;
  return null;
}

export function formatSlPhoneDisplay(phone?: string | null): string {
  const n = normalizeSlPhone(phone);
  if (!n) return phone?.trim() || "—";
  if (n.startsWith("94") && n.length === 11) {
    return `0${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
  }
  return phone ?? "—";
}

export function isValidSlMobile(phone?: string | null): boolean {
  const n = normalizeSlPhone(phone);
  return Boolean(n && n.startsWith("94") && n.length === 11);
}
