import type { PaymentMethod } from "@/lib/types";

const PAYMENT_KEYS: Record<PaymentMethod, string> = {
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
  return t(PAYMENT_KEYS[method]);
}

export const PAYMENT_OPTIONS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "card",
  "cheque",
  "credit",
];
