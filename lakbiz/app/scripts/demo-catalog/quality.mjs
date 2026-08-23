import { extractSpcBrand, normalizeSpace } from "./core.mjs";

const WORD = (value) => new RegExp(`\\b(?:${value})\\b`, "i");

const DOSAGE_FORM_WORDS = new Set([
  "TAB", "TABS", "TABLET", "TABLETS", "CAP", "CAPS", "CAPSULE", "CAPSULES",
  "INJ", "INJECTION", "INJECTIONS", "SUSP", "SUSPENSION", "SOLU", "SOLUTION",
  "SYRUP", "CREAM", "OINT", "OINTMENT", "DROPS", "DROP", "ORAL", "TOPICAL",
  "BP", "USP", "IP", "SLS", "FOR", "WITH", "AND", "THE", "OF", "W",
]);

function normalizeIdentity(value) {
  return normalizeSpace(value).toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function genericAnchorTokens(productName) {
  const beforeBrand = String(productName ?? "").split("(")[0].toUpperCase();
  return beforeBrand
    .replace(/\b\d+(?:\.\d+)?\s*(?:MG|MCG|G|ML|IU|MIU|%)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:ML|G))?\b/g, " ")
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !DOSAGE_FORM_WORDS.has(token) && !/^\d+$/.test(token));
}

function strengthTokens(value) {
  return [...String(value ?? "").toUpperCase().matchAll(/\b\d+(?:\.\d+)?\s*(?:MG|MCG|G|ML|IU|MIU|%)\b/g)]
    .map((match) => match[0].replace(/\s+/g, ""));
}

/**
 * Regulatory enrichment is deliberately conservative. Brand equality alone is
 * not enough: require one unique exact brand, at least one generic-name anchor
 * from the SPC item, and compatible strength whenever both sides expose one.
 */
export function conservativeMediVerifyMatch(spcProduct, results) {
  const brand = extractSpcBrand(spcProduct?.productName);
  if (!brand) return null;
  const targetBrand = normalizeIdentity(brand);
  const exactBrandRows = (results ?? []).filter((row) => normalizeIdentity(row?.brand) === targetBrand);
  if (exactBrandRows.length !== 1) return null;

  const match = exactBrandRows[0];
  const generic = normalizeIdentity(match.genericName ?? "");
  const anchors = genericAnchorTokens(spcProduct.productName);
  if (!anchors.length) return null;
  if (!anchors.some((token) => generic.includes(normalizeIdentity(token)))) return null;

  const sourceStrengths = new Set(strengthTokens(spcProduct.productName));
  const registryStrengths = new Set(strengthTokens(match.genericName));
  if (sourceStrengths.size && registryStrengths.size) {
    const overlaps = [...sourceStrengths].some((token) => registryStrengths.has(token));
    if (!overlaps) return null;
  }

  return match;
}

const BABY_NUTRITION = /\b(?:INFANT FORMULA|BABY FORMULA|FOLLOW[- ]?ON FORMULA|FORMULA MILK|CERELAC|LACTOGEN|SIMILAC|NAN OPTIPRO|NAN COMFORT|NAN SUPREME|ENFAGROW|PEDIASURE)\b/i;
const BABY = WORD("BABY|INFANT|DIAPER|NAPPY|WIPES?|FEEDING|BOTTLE|PACIFIER|TEETHER");
const WELLNESS = WORD("VITAMIN|MULTIVITAMIN|COLLAGEN|BIOTIN|SUPPLEMENT|WHEY|PROTEIN|NUTRITION|ENSURE|APPETON|DIABETASOL|GLUCERNA|PROTIFAR");
const DEVICE = /\b(?:GLUCOMETER|BLOOD PRESSURE|BP MONITOR|THERMOMETER|LANCET|NEBULIZER|NEBULISER|WHEEL\s*CHAIR|WHEELCHAIR|CRUTCH|WALKER|SUPPORT|BRACE|MASK|EXAMINATION GLOVES?|TEST STRIPS?)\b/i;
const ORAL = /\b(?:TOOTHPASTE|TOOTHBRUSH|TOOTH|MOUTHWASH|MOUTH|ORAL)\b/i;
const HAIR = /\b(?:SHAMPOO|CONDITIONER|HAIR)\b/i;
const BATH_BODY = /\b(?:SOAP|BODY WASH|SHOWER GEL|DEODORANT|SANITARY|INTIMATE|BODY SPRAY|COLOGNE)\b/i;
const SKIN = /\b(?:FACE WASH|CLEANSER|LOTION|SERUM|SUNSCREEN|SUN SCREEN|MOISTURIZER|MOISTURISER|MOISTURIZING|MOISTURISING|SKIN CREAM|FACE CREAM|HAND CREAM|BODY CREAM|BEAUTY CREAM|DAY CREAM|NIGHT CREAM|BB CREAM|CC CREAM)\b/i;
const SNACK = /\b(?:BISCUIT|CRACKER|CHOCOLATE|CANDY|SWEET|GUM|MINT|CHIPS|SNACK|NUTS?)\b/i;
const BEVERAGE = /\b(?:WATER|SOFT DRINK|FRUIT DRINK|JUICE|ENERGY DRINK|SPORTS DRINK|MILK DRINK)\b/i;
const HOUSEHOLD_HEALTH = /\b(?:TISSUE|WIPES?|DISINFECTANT|SANITIZER|SANITISER|MOSQUITO|REPELLENT)\b/i;

const OBVIOUS_GROCERY_NON_CONVENIENCE = /\b(?:FULL CREAM MILK|MILK POWDER|YOGHURT|YOGURT|CURD|CHEESE|BUTTER|MARGARINE|ICE CREAM|COCONUT CREAM|COCONUT MILK|CREAMER|RICE|FLOUR|DH?AL|LENTIL|SPICE|CURRY POWDER|COOKING OIL|NOODLES?|PASTA|SAUCE|KETCHUP|MAYONNAISE|CANNED|SAUSAGE|CHICKEN|FISH|MEAT|VEGETABLE|FRUIT|BREAD|BUN)\b/i;

export function classifyPharmacyRetailProduct(name) {
  const text = String(name ?? "");
  if (BABY_NUTRITION.test(text)) return { department: "Mother & Baby", category: "Baby Nutrition", subcategory: "Milk Formula" };
  if (BABY.test(text)) return { department: "Mother & Baby", category: "Baby Care", subcategory: "Baby Products" };
  if (DEVICE.test(text)) return { department: "Pharmaceutical", category: "Medical Devices", subcategory: "Health Devices" };
  if (WELLNESS.test(text)) return { department: "Wellness", category: "Vitamins & Supplements", subcategory: "Supplements & Nutrition" };
  if (ORAL.test(text)) return { department: "Personal Care", category: "Oral Care", subcategory: "Oral Care" };
  if (HAIR.test(text)) return { department: "Personal Care", category: "Hair Care", subcategory: "Hair Care" };
  if (BATH_BODY.test(text)) return { department: "Personal Care", category: "Bath & Body", subcategory: "Body & Hygiene" };
  if (SKIN.test(text)) return { department: "Personal Care", category: "Skin Care", subcategory: "Skin Care" };
  if (SNACK.test(text)) return { department: "Convenience Retail", category: "Snacks", subcategory: "Snacks & Confectionery" };
  if (BEVERAGE.test(text)) return { department: "Convenience Retail", category: "Beverages", subcategory: "Beverages" };
  if (HOUSEHOLD_HEALTH.test(text)) return { department: "Household & Health Convenience", category: "Hygiene", subcategory: "Health Convenience" };
  return { department: "Wellness", category: "Preventive Care", subcategory: "Health & Wellness" };
}

const PHARMACY_RETAIL_POSITIVE = /\b(?:INFANT FORMULA|BABY FORMULA|FOLLOW[- ]?ON FORMULA|FORMULA MILK|CERELAC|LACTOGEN|SIMILAC|NAN OPTIPRO|NAN COMFORT|NAN SUPREME|ENFAGROW|PEDIASURE|BABY|INFANT|DIAPER|NAPPY|WIPES?|FEEDING|PACIFIER|TEETHER|VITAMIN|MULTIVITAMIN|COLLAGEN|BIOTIN|SUPPLEMENT|WHEY|PROTEIN|NUTRITION|ENSURE|APPETON|DIABETASOL|GLUCERNA|GLUCOMETER|BLOOD PRESSURE|THERMOMETER|LANCET|NEBULIZER|NEBULISER|WHEEL\s*CHAIR|WHEELCHAIR|SUPPORT|BRACE|MASK|TOOTHPASTE|TOOTHBRUSH|MOUTHWASH|ORAL|SHAMPOO|CONDITIONER|HAIR|SOAP|BODY WASH|SHOWER GEL|DEODORANT|SANITARY|INTIMATE|LOTION|SERUM|SUNSCREEN|MOISTURIZER|MOISTURISER|FACE WASH|CLEANSER|SKIN CREAM|FACE CREAM|HAND CREAM|BODY CREAM|BEAUTY CREAM|DAY CREAM|NIGHT CREAM|BB CREAM|CC CREAM|BISCUIT|CRACKER|CHOCOLATE|CANDY|GUM|MINT|CHIPS|SNACK|WATER|SOFT DRINK|FRUIT DRINK|JUICE|ENERGY DRINK|SPORTS DRINK|MILK DRINK|TISSUE|DISINFECTANT|SANITIZER|SANITISER|MOSQUITO|REPELLENT)\b/i;

export function isPharmacyRetailCandidate(name) {
  const text = String(name ?? "");
  if (BABY_NUTRITION.test(text) || WELLNESS.test(text)) return true;
  if (OBVIOUS_GROCERY_NON_CONVENIENCE.test(text)) return false;
  return PHARMACY_RETAIL_POSITIVE.test(text);
}

export function catalogNameQualityIssue(name) {
  const text = normalizeSpace(name);
  if (!text) return "blank";
  if (/^[-–—\s]*LKR\s*[0-9]/i.test(text)) return "price_only";
  if (/^(?:LKR|Rs\.?)\s*[0-9]/i.test(text)) return "price_only";
  if (!/[A-Za-z]/.test(text)) return "no_letters";
  return null;
}
