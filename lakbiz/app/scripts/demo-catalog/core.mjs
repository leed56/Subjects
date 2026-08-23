const HTML_ENTITIES = new Map([
  ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["#39", "'"], ["nbsp", " "],
]);

export const NMRA_PUBLIC_DATA_STATUS =
  "NMRA public medicine-registration data has a known update limitation; do not treat this demo snapshot as a complete/current 2026 national register.";

export function normalizeSpace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function decodeHtml(value) {
  return String(value ?? "").replace(/&([^;]+);/g, (full, key) => {
    if (HTML_ENTITIES.has(key)) return HTML_ENTITIES.get(key);
    if (/^#\d+$/.test(key)) return String.fromCodePoint(Number(key.slice(1)));
    if (/^#x[0-9a-f]+$/i.test(key)) return String.fromCodePoint(parseInt(key.slice(2), 16));
    return full;
  });
}

export function stripTags(value) {
  return normalizeSpace(decodeHtml(String(value ?? "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")));
}

export function parseMoney(value) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

export function stableHash(input) {
  let hash = 2166136261;
  for (const char of String(input)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function stableDemoId(sector, source, sourceProductId) {
  return `demo:${sector}:${source}:${stableHash(`${source}:${sourceProductId}`)}`;
}

export function syntheticDemoCost(retailPrice, seed) {
  if (!Number.isFinite(retailPrice) || retailPrice <= 0) return 0;
  const bucket = parseInt(stableHash(seed).slice(-2), 36) || 0;
  const ratio = 0.72 + (bucket % 13) / 100;
  return Math.round(retailPrice * ratio * 100) / 100;
}

export function syntheticStock(seed) {
  const n = parseInt(stableHash(seed).slice(-3), 36) || 0;
  if (n % 29 === 0) return 0;
  if (n % 11 === 0) return 2;
  return 6 + (n % 35);
}

export function parsePackSizeFromName(name) {
  const text = normalizeSpace(name);
  const matches = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(kg|g|mg|mcg|l|ml|cl|pcs?|tabs?|tablets?|caps?|capsules?|sachets?|s|x\s*\d+)\b/gi)];
  return matches.length ? normalizeSpace(matches[matches.length - 1][0]) : null;
}

export function inferUnitFromName(name) {
  const pack = (parsePackSizeFromName(name) ?? "").toLowerCase();
  if (/\bkg\b/.test(pack)) return "kg";
  if (/\bml\b|\bl\b|\bcl\b/.test(pack)) return "bottle";
  if (/tab|caps?/.test(pack)) return "pack";
  if (/\bg\b|mg|mcg/.test(pack)) return "pack";
  return "pcs";
}

export function parseSpcRows(html, sourceUrl = "https://www.spc.lk/products.php") {
  const rows = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const match of html.matchAll(rowRe)) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]));
    if (cells.length < 6) continue;
    const [itemCode, description, unit, supplier, wholesaleRaw, retailRaw] = cells;
    if (!/^\d{5,}$/.test(itemCode)) continue;
    const wholesalePrice = parseMoney(wholesaleRaw);
    const retailPrice = parseMoney(retailRaw);
    if (!description) continue;
    rows.push({
      source: "spc",
      sourceUrl,
      sourceProductId: itemCode,
      productName: description,
      supplier,
      unit: unit || inferUnitFromName(description),
      packSize: parsePackSizeFromName(description),
      wholesalePrice,
      retailPrice,
    });
  }
  return dedupeBySourceId(rows);
}

function nearestPrice(html, start, end = start + 5000) {
  const slice = html.slice(start, Math.min(html.length, end));
  const dataAmount = slice.match(/data-price-amount=["']([0-9.,]+)["']/i);
  if (dataAmount) return parseMoney(dataAmount[1]);
  const lkr = slice.match(/(?:LKR|Rs\.?|₨)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  return lkr ? parseMoney(lkr[1]) : null;
}

export function parseSparCollectionProducts(html, pageUrl) {
  const products = [];
  const anchorRe = /<a\b[^>]*href=["']([^"']*\/products\/([^"'?#/]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRe)) {
    const name = stripTags(match[3]);
    if (!name || /^(view|choose|shop|quick add|add to cart)/i.test(name) || name.length < 2) continue;
    const handle = match[2];
    const index = match.index ?? 0;
    const price = nearestPrice(html, index, index + 4500);
    products.push({
      source: "spar2u",
      sourceUrl: new URL(match[1], pageUrl).href,
      sourceProductId: handle,
      productName: name,
      retailPrice: price,
      packSize: parsePackSizeFromName(name),
      unit: inferUnitFromName(name),
    });
  }
  return dedupeBySourceId(products);
}

export function parseHealthguardProducts(html, pageUrl) {
  const products = [];
  const blockRe = /<(?:li|div)\b[^>]*class=["'][^"']*product-item[^"']*["'][^>]*>([\s\S]*?)(?=<\/(?:li|div)>)/gi;
  for (const blockMatch of html.matchAll(blockRe)) {
    const block = blockMatch[1];
    const link = block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*product-item-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
      ?? block.match(/<a\b[^>]*class=["'][^"']*product-item-link[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const productName = stripTags(link[2]);
    if (!productName) continue;
    const absoluteUrl = new URL(link[1], pageUrl).href;
    const sourceProductId = absoluteUrl.replace(/\/$/, "").split("/").pop();
    const dataAmount = block.match(/data-price-amount=["']([0-9.,]+)["']/i);
    const priceText = block.match(/(?:LKR|Rs\.?|₨)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
    products.push({
      source: "healthguard",
      sourceUrl: absoluteUrl,
      sourceProductId: sourceProductId || stableHash(absoluteUrl),
      productName,
      retailPrice: parseMoney(dataAmount?.[1] ?? priceText?.[1]),
      packSize: parsePackSizeFromName(productName),
      unit: inferUnitFromName(productName),
    });
  }
  return dedupeBySourceId(products);
}

export function parseMediVerifyResults(html, sourceUrl) {
  const text = String(html ?? "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(?:h\d|div|p|section)>/gi, "\n");
  const plain = decodeHtml(text.replace(/<[^>]+>/g, " ")).replace(/\r/g, "");
  const chunks = plain.split(/(?=\bName:\s*)/g);
  const rows = [];
  for (const chunk of chunks) {
    const pick = (label) => normalizeSpace(chunk.match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"))?.[1] ?? "") || null;
    const name = pick("Name");
    const brand = pick("Brand");
    if (!name || !brand) continue;
    rows.push({
      source: "mediverify",
      sourceUrl,
      genericName: name,
      brand,
      dosageForm: pick("Dosage Form"),
      packType: pick("Pack Type"),
      packSize: pick("Pack Size"),
      manufacturer: pick("Manufacturer"),
      manufacturingCountry: normalizeSpace(chunk.match(/Made in\s+([^\n]+)/i)?.[1] ?? "") || null,
      localAgent: pick("Local Agent"),
      registrationNumber: pick("Registration Number"),
      registrationDate: pick("Registration Date"),
      validity: pick("Validity Period"),
      schedule: pick("Schedule"),
    });
  }
  return rows;
}

export function extractSpcBrand(name) {
  const candidates = [...String(name ?? "").matchAll(/\(([^()]{2,40})\)/g)].map((m) => normalizeSpace(m[1]));
  return candidates.find((candidate) => !/^\d+x?\d*$/i.test(candidate) && !/^(BP|USP|IP|SLS)$/i.test(candidate)) ?? null;
}

export function exactMediVerifyMatch(spcProduct, results) {
  const brand = extractSpcBrand(spcProduct.productName);
  if (!brand) return null;
  const normalize = (value) => normalizeSpace(value).toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const target = normalize(brand);
  const exact = results.filter((row) => normalize(row.brand) === target);
  if (exact.length !== 1) return null;
  return exact[0];
}

export function parseSpcDosageForm(name) {
  const upper = String(name ?? "").toUpperCase();
  const forms = [
    [/\b(?:TAB|TABLET|TABLETS)\b/, "Tablet", "Tablets"],
    [/\b(?:CAP|CAPS|CAPSULE|CAPSULES)\b/, "Capsule", "Capsules"],
    [/\b(?:INJ|INJECTION|INJECTIONS)\b/, "Injection", "Injections"],
    [/\b(?:SUSP|SUSPENSION|SYRUP)\b/, "Oral liquid", "Syrups & Suspensions"],
    [/\b(?:CREAM|OINT|OINTMENT|GEL)\b/, "Topical", "Creams, Ointments & Gels"],
    [/\b(?:EAR DROP|EYE DROP|EYE DROPS|DROPS|DROP|OPHTH)\b/, "Drops", "Eye & Ear Drops"],
    [/\b(?:INHA|INHALER|INHALATION)\b/, "Inhaled", "Inhalers & Inhalation"],
    [/\b(?:SUPPO|SUPPOSITORY|SUPPOSITORIES)\b/, "Suppository", "Suppositories"],
    [/\b(?:SOLU|SOLUTION)\b/, "Solution", "Solutions"],
  ];
  for (const [pattern, dosageForm, subcategory] of forms) {
    if (pattern.test(upper)) return { dosageForm, subcategory };
  }
  return { dosageForm: null, subcategory: "Other Medicines" };
}

export function classifySpcProduct(name) {
  const upper = String(name ?? "").toUpperCase();
  const device = /\b(?:GAUZE|COTTON WOOL|SYRINGE|NEEDLE|DIAPER|MASK|URINE BAG|BED PAN|GLOVE|BANDAGE|CATHETER|THERMOMETER|TEST STRIP|LANCET)\b/.test(upper);
  if (device) {
    return { department: "Pharmaceutical", category: "Medical Devices", subcategory: "Medical & First Aid Supplies", productKind: "medical_supply", taxonomyMethod: "conservative_keyword", dosageForm: null };
  }
  const form = parseSpcDosageForm(upper);
  return { department: "Pharmaceutical", category: "Medicines", subcategory: form.subcategory, productKind: "medicine", taxonomyMethod: "explicit_source_dosage_form", dosageForm: form.dosageForm };
}

export function classifyRetailProduct(name, sector) {
  const upper = String(name ?? "").toUpperCase();
  const has = (re) => re.test(upper);

  if (sector === "pharmacy") {
    if (has(/DIAPER|BABY|INFANT|FORMULA|FEEDING|PEDIASURE/)) return { department: "Mother & Baby", category: "Baby Care", subcategory: "Baby Products" };
    if (has(/VITAMIN|MULTIVITAMIN|COLLAGEN|BIOTIN|SUPPLEMENT|WHEY|PROTEIN|NUTRITION|ENSURE|APPETON/)) return { department: "Wellness", category: "Vitamins & Supplements", subcategory: "Supplements & Nutrition" };
    if (has(/GLUCOMETER|BLOOD PRESSURE|THERMOMETER|LANCET|MASK|SUPPORT|BRACE|NEBULIZER/)) return { department: "Pharmaceutical", category: "Medical Devices", subcategory: "Health Devices" };
    if (has(/TOOTH|MOUTH|ORAL/)) return { department: "Personal Care", category: "Oral Care", subcategory: "Oral Care" };
    if (has(/SHAMPOO|CONDITIONER|HAIR/)) return { department: "Personal Care", category: "Hair Care", subcategory: "Hair Care" };
    if (has(/SOAP|BODY WASH|SHOWER|DEODORANT|SANITARY|INTIMATE/)) return { department: "Personal Care", category: "Bath & Body", subcategory: "Body & Hygiene" };
    if (has(/CREAM|LOTION|SERUM|SUNSCREEN|SUN SCREEN|MOISTUR|FACE WASH|CLEANSER/)) return { department: "Personal Care", category: "Skin Care", subcategory: "Skin Care" };
    if (has(/BISCUIT|CRACKER|CHOCOLATE|CANDY|GUM|MINT|CHIPS|SNACK/)) return { department: "Convenience Retail", category: "Snacks", subcategory: "Snacks & Confectionery" };
    if (has(/WATER|DRINK|JUICE|7\s*UP|PEPSI|COCA|ENERGY/)) return { department: "Convenience Retail", category: "Beverages", subcategory: "Beverages" };
    if (has(/TISSUE|WIPE|DISINFECT|SANITIZER|MOSQUITO|REPELLENT/)) return { department: "Household & Health Convenience", category: "Hygiene", subcategory: "Health Convenience" };
    return { department: "Wellness", category: "Preventive Care", subcategory: "Health & Wellness" };
  }

  if (has(/RICE|ATTA|FLOUR|OATS|CEREAL|GRAIN/)) return { department: "Grocery & Staples", category: "Rice, Flour & Grains", subcategory: "Rice, Flour & Grains" };
  if (has(/DHAL|LENTIL|CHICKPEA|BEAN|PULSE/)) return { department: "Grocery & Staples", category: "Pulses", subcategory: "Dhal & Pulses" };
  if (has(/SUGAR|SALT|SPICE|CHILLI|CURRY|PEPPER|SEASONING|CINNAMON/)) return { department: "Grocery & Staples", category: "Spices & Seasoning", subcategory: "Staples & Seasoning" };
  if (has(/OIL|COCONUT MILK|COCONUT CREAM/)) return { department: "Grocery & Staples", category: "Oil & Fats", subcategory: "Oil & Coconut Products" };
  if (has(/BISCUIT|CRACKER|COOKIE/)) return { department: "Packaged Food", category: "Biscuits & Crackers", subcategory: "Biscuits & Crackers" };
  if (has(/NOODLE|PASTA|MACARONI/)) return { department: "Packaged Food", category: "Noodles & Pasta", subcategory: "Noodles & Pasta" };
  if (has(/SAUCE|KETCHUP|MAYONNAISE|CHUTNEY|CONDIMENT/)) return { department: "Packaged Food", category: "Sauces & Condiments", subcategory: "Sauces & Condiments" };
  if (has(/CHIPS|SNACK|MIXTURE|NUT|CHOCOLATE|CANDY|GUM|TOFFEE/)) return { department: "Snacks & Confectionery", category: "Snacks", subcategory: "Snacks & Confectionery" };
  if (has(/WATER|JUICE|DRINK|PEPSI|COCA|7\s*UP|SPRITE|TEA|COFFEE|MILK POWDER|MALT/)) return { department: "Beverages", category: "Water & Soft Drinks", subcategory: "Beverages" };
  if (has(/ONION|CARROT|POTATO|BEANS|CABBAGE|TOMATO|VEGETABLE|BANANA|APPLE|ORANGE|MANGO|PAPAYA/)) return { department: "Fresh Food", category: "Vegetables", subcategory: "Fresh Produce" };
  if (has(/YOGURT|YOGHURT|CURD|CHEESE|BUTTER|FRESH MILK/)) return { department: "Chilled & Dairy", category: "Milk & Dairy", subcategory: "Dairy" };
  if (has(/FROZEN|ICE CREAM/)) return { department: "Frozen", category: "Frozen Foods", subcategory: "Frozen" };
  if (has(/BREAD|BUN|CAKE/)) return { department: "Bakery", category: "Bread & Buns", subcategory: "Bakery" };
  if (has(/SOAP|SHAMPOO|TOOTH|SANITARY|DIAPER|BABY/)) return { department: "Personal & Baby", category: "Personal Care", subcategory: "Personal & Baby" };
  if (has(/DETERGENT|DISHWASH|CLEANER|TISSUE|AIR FRESH|PEST|BATTERY|VIM|SURF/)) return { department: "Household", category: "Cleaning", subcategory: "Household" };
  if (has(/PET|DOG|CAT/)) return { department: "Pet Care", category: "Pet Food & Care", subcategory: "Pet Care" };
  return { department: "Packaged Food", category: "Packaged Food", subcategory: "General Grocery" };
}

export function dedupeBySourceId(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.source}:${row.sourceProductId}`;
    const existing = map.get(key);
    if (!existing || (!existing.retailPrice && row.retailPrice)) map.set(key, row);
  }
  return [...map.values()];
}

export function toNormalizedDemoProduct(row, sector, retrievedAt = new Date().toISOString()) {
  const taxonomy = row.taxonomy ?? (row.source === "spc" ? classifySpcProduct(row.productName) : classifyRetailProduct(row.productName, sector));
  const retailPrice = Number(row.retailPrice ?? 0);
  const factualCost = row.wholesalePrice != null && Number.isFinite(Number(row.wholesalePrice));
  const buyPrice = factualCost ? Number(row.wholesalePrice) : syntheticDemoCost(retailPrice, `${row.source}:${row.sourceProductId}`);
  return {
    id: stableDemoId(sector, row.source, row.sourceProductId),
    source: row.source,
    sourceUrl: row.sourceUrl,
    sourceProductId: String(row.sourceProductId),
    retrievedAt,
    productName: normalizeSpace(row.productName),
    brand: row.regulatory?.brand ?? row.brand ?? null,
    genericName: row.regulatory?.genericName ?? null,
    strength: row.regulatory?.strength ?? null,
    dosageForm: row.regulatory?.dosageForm ?? taxonomy.dosageForm ?? null,
    packSize: row.regulatory?.packSize ?? row.packSize ?? parsePackSizeFromName(row.productName),
    unit: row.unit || inferUnitFromName(row.productName),
    department: taxonomy.department,
    category: taxonomy.category,
    subcategory: taxonomy.subcategory,
    productKind: taxonomy.productKind ?? "retail",
    taxonomyMethod: taxonomy.taxonomyMethod ?? "normalization_heuristic",
    supplier: row.supplier ?? null,
    manufacturer: row.regulatory?.manufacturer ?? null,
    manufacturingCountry: row.regulatory?.manufacturingCountry ?? null,
    localAgent: row.regulatory?.localAgent ?? null,
    sellPrice: retailPrice,
    buyPrice,
    costSource: factualCost ? "spc_wholesale" : "synthetic_demo",
    sourcePriceDate: row.sourcePriceDate ?? null,
    barcode: row.barcode ?? null,
    registrationNumber: row.regulatory?.registrationNumber ?? null,
    registrationDate: row.regulatory?.registrationDate ?? null,
    registrationValidity: row.regulatory?.validity ?? null,
    regulatorySchedule: row.regulatory?.schedule ?? null,
    regulatorySource: row.regulatory ? "mediverify" : null,
    regulatorySourceUrl: row.regulatory?.sourceUrl ?? null,
    regulatorySourceStatus: row.regulatory ? NMRA_PUBLIC_DATA_STATUS : null,
    active: true,
  };
}
