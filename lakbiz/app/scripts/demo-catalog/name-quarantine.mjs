/** Publish complete source identities only; keep exclusions auditable. */
export function partitionCatalogNames(rows, retrievedAt) {
  const complete = [], quarantined = [];
  for (const row of rows) {
    const name = String(row.productName ?? "").trim();
    const reason = !name ? "blank_name" : /\.\.\.|…/.test(name) ? "unresolved_truncated_name" : null;
    if (!reason) complete.push(row);
    else quarantined.push({ source: row.source, sourceProductId: row.sourceProductId, sourceUrl: row.sourceUrl, productName: row.productName ?? null, reason, retrievedAt });
  }
  return { complete, quarantined };
}
