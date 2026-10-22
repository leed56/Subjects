import type { PaymentMethod } from "@/lib/types";

const PAYMENT_KEYS: Partial<Record<PaymentMethod, string>> = {
  cash: "pay.cash",
  bank_transfer: "pay.bank",
  card: "pay.card",
  cheque: "pay.cheque",
  credit: "pay.credit",
};

export function paymentLabel(
  t: (key: string) => string,
  method: PaymentMethod,
): string {
  // `mixed` is a read/display value produced by the normalized tender ledger;
  // it is intentionally not a legacy POS input option yet.
  if (method === "mixed") return "Mixed payment";
  return t(PAYMENT_KEYS[method] ?? "pay.cash");
}

export const PAYMENT_OPTIONS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "card",
  "cheque",
  "credit",
];
