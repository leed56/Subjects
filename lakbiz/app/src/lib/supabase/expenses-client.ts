"use client";

/**
 * Business expense tracking — cloud-only client (Phase 11), same simple
 * direct-Supabase pattern as ac-assets-client.ts (Phase 4) and
 * crews-client.ts (Phase 6). See the migration file for why. Requires
 * being online — there is no offline queue for expenses yet.
 */
import { createBrowserClient } from "./client";

export type ExpenseCategory =
  | "rent"
  | "utilities"
  | "salaries"
  | "fuel"
  | "transport"
  | "supplies"
  | "maintenance"
  | "insurance"
  | "marketing"
  | "other"
  // HVAC platform Phase 7 — "other job costs". Deliberately no
  // "subcontractor" category here: that cost is already captured by
  // ACJob.subcontractCost for contractor-assigned jobs, so adding one
  // would invite double-counting the same cost two ways. These three
  // cover the spec's remaining named examples (parking, equipment
  // rental, outsourced repair) that had no existing home.
  | "parking"
  | "equipment_rental"
  | "outsourced_repair"
  // job-parts-materials phase — "External purchase, Expense only" (a
  // part bought specifically for one job, not added to inventory).
  // Distinct from outsourced_repair (paying a subcontractor to do work)
  // and from equipment_rental — this is materials, not labor or tools.
  | "parts_purchase";

export type ExpensePaymentMethod = "cash" | "bank_transfer" | "card" | "cheque";

export type Expense = {
  id: string;
  organizationId: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  vendor: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Links this expense into a specific job's "other costs" (HVAC
   * platform Phase 7) — nullable, most expenses (rent, salaries, ...)
   * aren't tied to any one job. */
  jobId: string | null;
};

export type ExpenseInput = {
  category?: ExpenseCategory;
  amount?: number;
  expenseDate?: string;
  paymentMethod?: ExpensePaymentMethod;
  vendor?: string;
  notes?: string;
  jobId?: string | null;
};

type ExpenseRow = {
  id: string;
  organization_id: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  payment_method: ExpensePaymentMethod;
  vendor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  job_id: string | null;
};

function fromRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    organizationId: row.organization_id,
    category: row.category,
    amount: Number(row.amount),
    expenseDate: row.expense_date,
    paymentMethod: row.payment_method,
    vendor: row.vendor,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    jobId: row.job_id,
  };
}

function toRow(input: ExpenseInput): Partial<ExpenseRow> {
  const row: Partial<ExpenseRow> = {};
  if (input.category !== undefined) row.category = input.category;
  if (input.amount !== undefined) row.amount = input.amount;
  if (input.expenseDate !== undefined) row.expense_date = input.expenseDate;
  if (input.paymentMethod !== undefined) row.payment_method = input.paymentMethod;
  if (input.vendor !== undefined) row.vendor = input.vendor.trim() || null;
  if (input.notes !== undefined) row.notes = input.notes.trim() || null;
  if (input.jobId !== undefined) row.job_id = input.jobId || null;
  return row;
}

export async function fetchOrgExpenses(organizationId: string): Promise<{ data: Expense[]; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("organization_id", organizationId)
    .order("expense_date", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as ExpenseRow[]).map(fromRow), error: null };
}

export async function createExpense(
  organizationId: string,
  input: ExpenseInput,
): Promise<{ data: Expense | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("expenses")
    .insert({ organization_id: organizationId, ...toRow(input) })
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: fromRow(data as ExpenseRow), error: null };
}

export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<{ data: Expense | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("expenses")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "Expense not found or no permission" };
  return { data: fromRow(data as ExpenseRow), error: null };
}

export async function deleteExpense(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Supabase not configured" };

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  return { error: error?.message ?? null };
}
