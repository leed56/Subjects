import type { ContactType } from "@/lib/types";

/** Individual walk-in vs B2B company on the same credit ledger (Phase B). */
export type { ContactType };

export function parseContactType(value: unknown): ContactType {
  return value === "company" ? "company" : "individual";
}

export function contactTypeI18nKey(
  type: ContactType,
): "cust.type_individual" | "cust.type_company" {
  return type === "company" ? "cust.type_company" : "cust.type_individual";
}

export function customerPrimaryLabel(customer: {
  name: string;
  contactType: ContactType;
  contactPerson?: string;
}): string {
  if (customer.contactType === "company" && customer.contactPerson) {
    return `${customer.name} · ${customer.contactPerson}`;
  }
  return customer.name;
}
