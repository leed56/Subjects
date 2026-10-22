export type SaleExchangePlan = {
  appliedCredit: number;
  remainingReturnCredit: number;
  replacementBalanceAfterCredit: number;
};

function money(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/**
 * Pure UI mirror of the database exchange rule.
 *
 * The credit note is never used as a discount on the replacement invoice.
 * Instead, the replacement remains a full-value CREDIT sale and the return
 * credit reduces its customer receivable after sale creation.
 */
export function computeSaleExchangePlan(
  remainingReturnCredit: number,
  replacementCreditAmount: number,
): SaleExchangePlan {
  const returnCredit = Math.max(0, money(remainingReturnCredit));
  const replacementCredit = Math.max(0, money(replacementCreditAmount));
  const appliedCredit = money(Math.min(returnCredit, replacementCredit));

  return {
    appliedCredit,
    remainingReturnCredit: money(Math.max(0, returnCredit - appliedCredit)),
    replacementBalanceAfterCredit: money(
      Math.max(0, replacementCredit - appliedCredit),
    ),
  };
}
