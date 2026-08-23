import { normalizeSpace, stripTags } from "./core.mjs";

/**
 * Parse only the factual product title from a public SPAR product page. The
 * crawler deliberately ignores description, images, reviews and marketing copy.
 */
export function parseSparProductTitle(html) {
  const text = String(html ?? "");
  const selectors = [
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
    /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i,
  ];
  for (const pattern of selectors) {
    const match = text.match(pattern);
    if (!match) continue;
    const title = normalizeSpace(stripTags(match[1]))
      .replace(/\s*[–—-]\s*SPAR2U Sri Lanka\s*$/i, "")
      .trim();
    if (title && title.length >= 2 && title.length <= 220 && !title.includes("...")) return title;
  }
  return null;
}

export function needsSparTitleHydration(row) {
  return row?.source === "spar2u" && String(row?.productName ?? "").includes("...") && /^https:\/\/spar2u\.lk\/products\//i.test(String(row?.sourceUrl ?? ""));
}
