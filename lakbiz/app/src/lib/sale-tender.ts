export type SaleTenderKind =
  | "cash"
  | "card"
  | "bank_transfer"
  | "cheque"
  | "credit"
  | "return_credit";

export type SaleTenderDraft = {
  id: string;
  kind: SaleTenderKind;
  amount: number;
  /** Required when kind=bank_transfer once the DB workflow is wired. */
  bankAccountId?: string;
  /** Required when kind=cheque once the DB workflow is wired. */
  chequeId?: string;
  /** Required when kind=return_credit. */
  returnId?: string;
  note?: string;
};

export type SaleTenderValidationContext = {
  saleTotal: number;
  /** Credit tender is only valid when the sale has a real customer account. */
  hasCustomerAccount: boolean;
  /** Maximum still-unused credit available from an issued return credit note. */
  availableReturnCredit?: number;
};

export type SaleTenderSummary = {
  saleTotal: number;
  tenderedTotal: number;
  remaining: number;
  changeDue: number;
  creditAmount: number;
  returnCreditApplied: number;
  settled: boolean;
};

const MONEY_EPSILON = 0.005;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function summarizeSaleTenders(
  saleTotal: number,
  tenders: Pick<SaleTenderDraft, "kind" | "amount">[],
): SaleTenderSummary {
  const total = Math.max(0, roundMoney(saleTotal));
  const normalized = tenders.map((tender) => ({
    kind: tender.kind,
    amount: Math.max(0, roundMoney(tender.amount)),
  }));
  const tenderedTotal = roundMoney(
    normalized.reduce((sum, tender) => sum + tender.amount, 0),
  );
  const remaining = roundMoney(Math.max(0, total - tenderedTotal));
  const changeDue = roundMoney(Math.max(0, tenderedTotal - total));
  const creditAmount = roundMoney(
    normalized
      .filter((tender) => tender.kind === "credit")
      .reduce((sum, tender) => sum + tender.amount, 0),
  );
  const returnCreditApplied = roundMoney(
    normalized
      .filter((tender) => tender.kind === "return_credit")
      .reduce((sum, tender) => sum + tender.amount, 0),
  );

  return {
    saleTotal: total,
    tenderedTotal,
    remaining,
    changeDue,
    creditAmount,
    returnCreditApplied,
    settled: remaining <= MONEY_EPSILON,
  };
}

/**
 * Pure validation used before any eventual DB write. It deliberately does not
 * infer missing payment sources: mixed tender is only safe when every amount is
 * explicit and the final allocation exactly explains the sale total.
 */
export function validateSaleTenders(
  tenders: SaleTenderDraft[],
  context: SaleTenderValidationContext,
): string[] {
  const errors: string[] = [];
  const total = Math.max(0, roundMoney(context.saleTotal));

  if (total <= MONEY_EPSILON) {
    errors.push("Sale total must be greater than zero.");
  }
  if (tenders.length === 0) {
    errors.push("Add at least one payment tender.");
    return errors;
  }

  const seenIds = new Set<string>();
  for (const tender of tenders) {
    if (!tender.id || seenIds.has(tender.id)) {
      errors.push("Each payment tender must have a unique id.");
    }
    seenIds.add(tender.id);

    const amount = roundMoney(tender.amount);
    if (!Number.isFinite(tender.amount) || amount <= MONEY_EPSILON) {
      errors.push("Every payment tender must have a positive amount.");
    }

    if (tender.kind === "credit" && !context.hasCustomerAccount) {
      errors.push("Credit payment requires a customer account.");
    }
    if (tender.kind === "bank_transfer" && !tender.bankAccountId) {
      errors.push("Bank transfer requires a destination bank account.");
    }
    if (tender.kind === "cheque" && !tender.chequeId) {
      errors.push("Cheque payment requires a cheque record.");
    }
    if (tender.kind === "return_credit" && !tender.returnId) {
      errors.push("Return credit requires a return document.");
    }
  }

  const summary = summarizeSaleTenders(total, tenders);
  const availableReturnCredit = Math.max(
    0,
    roundMoney(context.availableReturnCredit ?? 0),
  );
  if (summary.returnCreditApplied - availableReturnCredit > MONEY_EPSILON) {
    errors.push("Return credit exceeds the available issued credit-note balance.");
  }

  // Credit is a receivable allocation, not an unpaid remainder. Every rupee of
  // the invoice must still be explicitly allocated to cash/card/bank/cheque,
  // customer credit or return credit.
  if (summary.remaining > MONEY_EPSILON) {
    errors.push("Payment allocation does not cover the full sale total.");
  }
  if (summary.changeDue > MONEY_EPSILON) {
    errors.push("Payment allocation exceeds the sale total.");
  }

  return Array.from(new Set(errors));
}

export function saleTenderLabel(kind: SaleTenderKind): string {
  switch (kind) {
    case "cash":
      return "Cash";
    case "card":
      return "Card";
    case "bank_transfer":
      return "Bank transfer";
    case "cheque":
      return "Cheque";
    case "credit":
      return "Customer credit";
    case "return_credit":
      return "Return credit";
  }
}
