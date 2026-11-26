import { createBrowserClient } from "@/lib/supabase/client";

export type GroceryTestBillLine = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
};

export type GroceryTestBill = {
  id: string;
  billNo: string;
  createdAt: string;
  lines: GroceryTestBillLine[];
  discount: number;
  total: number;
};

type GroceryTestBillInput = Omit<GroceryTestBill, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

type GroceryTestBillRow = {
  id: string;
  bill_no: string;
  created_at: string;
  lines: unknown;
  discount: number | string;
  total: number | string;
};

function isLine(value: unknown): value is GroceryTestBillLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<GroceryTestBillLine>;
  return (
    typeof line.productId === "string" &&
    typeof line.productName === "string" &&
    typeof line.qty === "number" &&
    Number.isFinite(line.qty) &&
    line.qty > 0 &&
    typeof line.unitPrice === "number" &&
    Number.isFinite(line.unitPrice) &&
    line.unitPrice >= 0
  );
}

function toGroceryTestBill(row: GroceryTestBillRow): GroceryTestBill | null {
  const discount = Number(row.discount);
  const total = Number(row.total);
  if (
    !row.id ||
    !row.bill_no ||
    !row.created_at ||
    !Array.isArray(row.lines) ||
    row.lines.length === 0 ||
    !row.lines.every(isLine) ||
    !Number.isFinite(discount) ||
    discount < 0 ||
    !Number.isFinite(total) ||
    total <= 0
  ) return null;
  return {
    id: row.id,
    billNo: row.bill_no,
    createdAt: row.created_at,
    lines: row.lines,
    discount,
    total,
  };
}

const BILL_SELECT = "id,bill_no,created_at,lines,discount,total";

export async function fetchGroceryTestBills(organizationId: string): Promise<{
  data: GroceryTestBill[];
  error: string | null;
}> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: [], error: "Cloud storage is not configured." };
  const { data, error } = await supabase
    .from("grocery_test_bills")
    .select(BILL_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as unknown as GroceryTestBillRow[])
      .map(toGroceryTestBill)
      .filter((bill): bill is GroceryTestBill => bill !== null),
    error: null,
  };
}

export async function saveGroceryTestBill(
  organizationId: string,
  bill: GroceryTestBillInput,
): Promise<{ data: GroceryTestBill | null; error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { data: null, error: "Cloud storage is not configured." };
  const values = {
    bill_no: bill.billNo,
    lines: bill.lines,
    discount: bill.discount,
    total: bill.total,
  };
  const result = bill.id
    ? await supabase
        .from("grocery_test_bills")
        .update(values)
        .eq("organization_id", organizationId)
        .eq("id", bill.id)
        .select(BILL_SELECT)
        .maybeSingle()
    : await supabase
        .from("grocery_test_bills")
        .insert({ organization_id: organizationId, ...values })
        .select(BILL_SELECT)
        .single();
  if (result.error) return { data: null, error: result.error.message };
  if (!result.data) return { data: null, error: "This test bill is no longer available." };
  return {
    data: toGroceryTestBill(result.data as unknown as GroceryTestBillRow),
    error: null,
  };
}

export async function deleteGroceryTestBill(
  organizationId: string,
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Cloud storage is not configured." };
  const { data, error } = await supabase
    .from("grocery_test_bills")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  return data ? { error: null } : { error: "This test bill is no longer available." };
}

export async function clearGroceryTestBills(
  organizationId: string,
): Promise<{ error: string | null }> {
  const supabase = createBrowserClient();
  if (!supabase) return { error: "Cloud storage is not configured." };
  const { error } = await supabase
    .from("grocery_test_bills")
    .delete()
    .eq("organization_id", organizationId);
  return { error: error?.message ?? null };
}
