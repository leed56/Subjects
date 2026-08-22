export function formatLkr(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

/** Global premium UI phase — Part 4/9's "avatar initials, no profile
 * photography required": 1-2 uppercase letters for a compact avatar
 * badge. Prefers the first letter of up to two words in `name` (an org
 * name or a technician's name — "LakBiz Cooling" -> "LC", "Nimal" -> "N");
 * falls back to the first letter of `fallback` (typically an email) when
 * `name` is empty, so the badge shows a real initial whenever one is
 * available; "?" only appears when neither `name` nor `fallback` has
 * anything to derive from at all — an honest "unknown," not a guess. */
export function initialsFor(name: string | null | undefined, fallback?: string | null): string {
  const source = (name ?? "").trim();
  if (source) {
    const letters = source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
    if (letters) return letters;
  }
  const fb = (fallback ?? "").trim();
  return fb ? fb[0].toUpperCase() : "?";
}

const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
  "Eighty", "Ninety",
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens];
}

function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

/** Indian/Sri Lankan numbering: crore, lakh, thousand. */
function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const below = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (below) parts.push(threeDigitsToWords(below));
  return parts.join(" ");
}

/** "Rupees One Thousand Five Hundred and Cents Fifty Only" for invoices. */
export function amountInWordsLkr(amount: number): string {
  const safe = Math.max(0, Math.round(amount * 100) / 100);
  const rupees = Math.floor(safe);
  const cents = Math.round((safe - rupees) * 100);
  const rupeeWords = `Rupees ${integerToWords(rupees)}`;
  const centWords = cents > 0 ? ` and Cents ${twoDigitsToWords(cents)}` : "";
  return `${rupeeWords}${centWords} Only`;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
