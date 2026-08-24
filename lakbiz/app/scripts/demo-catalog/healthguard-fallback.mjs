import {
  decodeHtml,
  inferUnitFromName,
  normalizeSpace,
  parseMoney,
  parsePackSizeFromName,
  stableHash,
} from "./core.mjs";
import {
  catalogNameQualityIssue,
  isPharmacyRetailCandidate,
} from "./quality.mjs";

const UI_LINE = /^(?:sort by|per page|shop by|shopping options|category|price|color|size|new product|next|previous|add to cart|out of stock|in stock|clear all|remove this item|contact us)$/i;

function listingLines(html) {
  const withoutScripts = String(html ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:a|div|li|p|span|strong|h[1-6]|button|option)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtml(withoutScripts)
    .split(/\r?\n/)
    .map(normalizeSpace)
    .filter(Boolean);
}

function looksLikeProductName(line) {
  if (!line || line.length < 3 || line.length > 180) return false;
  if (UI_LINE.test(line)) return false;
  if (catalogNameQualityIssue(line)) return false;
  if (/^\(?\d+(?:\.\d+)?%?\)?$/.test(line)) return false;
  if (/^(?:LKR)?[0-9,.]+\s*(?:items?)?$/i.test(line)) return false;
  if (/^\d+\s+items?$/i.test(line)) return false;

  const letters = line.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  const uppercase = letters.replace(/[^A-Z]/g, "").length;
  return uppercase / letters.length >= 0.72;
}

/**
 * Magento storefront markup can change while the server-rendered listing text
 * remains stable. This fallback extracts only the nearest uppercase product
 * name preceding a public LKR price. It deliberately does not copy long
 * descriptions, images, reviews or medical claims.
 */
export function parseHealthguardListingText(html, pageUrl) {
  const lines = listingLines(html);
  const products = [];
  const seen = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const priceMatch = lines[index].match(/^LKR\s*([0-9][0-9,]*(?:\.\d{1,2})?)$/i);
    if (!priceMatch) continue;

    let productName = null;
    for (let back = index - 1; back >= Math.max(0, index - 8); back -= 1) {
      const candidate = lines[back];
      if (/^\(\d+\)$/.test(candidate)) continue;
      if (looksLikeProductName(candidate)) {
        productName = candidate;
        break;
      }
    }
    if (!productName) continue;

    const normalizedName = normalizeSpace(productName);
    const key = normalizedName.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    products.push({
      source: "healthguard",
      sourceUrl: pageUrl,
      sourceProductId: `listing-${stableHash(key)}`,
      productName: normalizedName,
      retailPrice: parseMoney(priceMatch[1]),
      packSize: parsePackSizeFromName(normalizedName),
      unit: inferUnitFromName(normalizedName),
      sourceIdentityQuality: "listing_name_hash",
    });
  }

  return products;
}

export function pharmacyRetailCandidatesFromSpar(rows, maxProducts = 450) {
  const selected = [];
  for (const row of rows) {
    if (!isPharmacyRetailCandidate(row.productName)) continue;
    selected.push({ ...row });
    if (selected.length >= maxProducts) break;
  }
  return selected;
}
