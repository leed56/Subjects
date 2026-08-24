import type { PaymentMethod } from "@/lib/types";
import {
  roundMoney,
  type SaleTenderDraft,
  type SaleTenderKind,
} from "@/lib/sale-tender";

export type CheckoutTenderKind = Exclude<SaleTenderKind, "return_credit">;

export type CheckoutChequeDetails = {
  chequeNo: string;
  chequeBank: string;
  chequeDate: string;
  postDated: boolean;
};

export type BuildCheckoutTendersInput = {
  saleTotal: number;
  primaryKind: CheckoutTenderKind;
  primaryId: string;
  split: boolean;
  secondaryKind: CheckoutTenderKind;
  secondaryAmount: number;
  secondaryId: string;
  cheque: CheckoutChequeDetails;
};

export type BuildCheckoutTendersResult = {
  tenders: SaleTenderDraft[];
  paymentMethod: PaymentMethod;
  cashTenderAmount: number;
  creditTenderAmount: number;
  error: string | null;
};

function withChequeDetails(
  tender: SaleTenderDraft,
  cheque: CheckoutChequeDetails,
): SaleTenderDraft {
  if (tender.kind !== "cheque") return tender;
  return {
    ...tender,
    chequeNo: cheque.chequeNo.trim(),
    chequeBank: cheque.chequeBank.trim(),
    chequeDate: cheque.chequeDate,
    postDated: cheque.postDated,
  };
}

export function buildCheckoutTenders(
  input: BuildCheckoutTendersInput,
): BuildCheckoutTendersResult {
  const total = Math.max(0, roundMoney(input.saleTotal));
  if (total <= 0) {
    return {
      tenders: [],
      paymentMethod: input.primaryKind,
      cashTenderAmount: 0,
      creditTenderAmount: 0,
      error: "Sale total must be greater than zero.",
    };
  }

  let tenders: SaleTenderDraft[];
  if (!input.split) {
    tenders = [
      withChequeDetails(
        { id: input.primaryId, kind: input.primaryKind, amount: total },
        input.cheque,
      ),
    ];
  } else {
    if (input.secondaryKind === input.primaryKind) {
      return {
        tenders: [],
        paymentMethod: "mixed",
        cashTenderAmount: 0,
        creditTenderAmount: 0,
        error: "Choose two different payment methods for a split payment.",
      };
    }

    const secondaryAmount = roundMoney(input.secondaryAmount);
    if (secondaryAmount <= 0 || secondaryAmount >= total) {
      return {
        tenders: [],
        paymentMethod: "mixed",
        cashTenderAmount: 0,
        creditTenderAmount: 0,
        error: "Split payment amount must be greater than zero and below the invoice total.",
      };
    }

    const primaryAmount = roundMoney(total - secondaryAmount);
    tenders = [
      withChequeDetails(
        { id: input.primaryId, kind: input.primaryKind, amount: primaryAmount },
        input.cheque,
      ),
      withChequeDetails(
        { id: input.secondaryId, kind: input.secondaryKind, amount: secondaryAmount },
        input.cheque,
      ),
    ];
  }

  return {
    tenders,
    paymentMethod: tenders.length > 1 ? "mixed" : input.primaryKind,
    cashTenderAmount: roundMoney(
      tenders
        .filter((tender) => tender.kind === "cash")
        .reduce((sum, tender) => sum + tender.amount, 0),
    ),
    creditTenderAmount: roundMoney(
      tenders
        .filter((tender) => tender.kind === "credit")
        .reduce((sum, tender) => sum + tender.amount, 0),
    ),
    error: null,
  };
}
