import { createBrowserClient } from "./client";

type StockLogRow = Record<string, unknown>;
const columns = "id,organization_id,product_id,product_name,log_type,qty,note,log_date,related_job_id,related_supplier_id";

function sameMovement(local: StockLogRow, recorded: StockLogRow): boolean {
  const textColumns = ["id", "organization_id", "product_id", "product_name", "log_type", "note", "related_job_id", "related_supplier_id"];
  return textColumns.every((key) => (local[key] ?? null) === (recorded[key] ?? null)) &&
    Number(local.qty) === Number(recorded.qty) &&
    Date.parse(String(local.log_date)) === Date.parse(String(recorded.log_date));
}

/** A retry may confirm an existing movement, but must never rewrite it. */
export async function appendStockLogRows(rows: StockLogRow[]): Promise<string | null> {
  if (rows.length === 0) return null;
  const orgId = rows[0].organization_id;
  if (typeof orgId !== "string" || !orgId || rows.some((row) => row.organization_id !== orgId || !row.id)) {
    return "Stock movements must belong to one shop and have stable identifiers.";
  }
  const supabase = createBrowserClient();
  if (!supabase) return "Supabase not configured";
  for (let offset = 0; offset < rows.length; offset += 200) {
    const batch = rows.slice(offset, offset + 200);
    const { error } = await supabase.from("stock_logs").upsert(batch, { onConflict: "id", ignoreDuplicates: true });
    if (error) return error.message;

    // Confirm every id within this shop. DO NOTHING alone could hide a foreign
    // id collision, and an edited local copy must not masquerade as a retry.
    // Use smaller URL-sized read batches than the JSON write batches.
    for (let readOffset = 0; readOffset < batch.length; readOffset += 100) {
      const readBatch = batch.slice(readOffset, readOffset + 100);
      const { data, error: readError } = await supabase.from("stock_logs")
        .select(columns).eq("organization_id", orgId).in("id", readBatch.map((row) => String(row.id)));
      if (readError) return readError.message;
      const recorded = new Map((data ?? []).map((row) => [String(row.id), row as StockLogRow]));
      if (readBatch.some((row) => !recorded.has(String(row.id)))) return "A stock movement could not be confirmed for this shop. Refresh before retrying.";
      if (readBatch.some((row) => !sameMovement(row, recorded.get(String(row.id))!))) {
        return "Recorded stock movements cannot be changed. Refresh and record a new correction instead.";
      }
    }
  }
  return null;
}
