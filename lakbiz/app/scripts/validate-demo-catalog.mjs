#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { catalogNameQualityIssue } from "./demo-catalog/quality.mjs";

const valueArg = (name, fallback) => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const catalogPath = resolve(valueArg("--catalog", "/tmp/lakbiz-sri-lanka-demo-catalog.json"));
const summaryPath = valueArg("--summary-out", "");

const payload = JSON.parse(await readFile(catalogPath, "utf8"));
if (payload.schemaVersion !== 1 || !Array.isArray(payload.pharmacy) || !Array.isArray(payload.grocery)) {
  throw new Error("Unsupported or invalid LakBiz demo catalog file");
}

const allRows = [...payload.pharmacy, ...payload.grocery];
const medicines = payload.pharmacy.filter((p) => p.productKind === "medicine");
const medicineCount = medicines.length;
const nonMedicineCount = payload.pharmacy.length - medicineCount;
const pharmacyCategories = new Set(payload.pharmacy.map((p) => `${p.department} > ${p.category} > ${p.subcategory}`));
const groceryCategories = new Set(payload.grocery.map((p) => `${p.department} > ${p.category} > ${p.subcategory}`));
const pharmacyDepartments = new Set(payload.pharmacy.map((p) => p.department).filter(Boolean));
const regulatoryRows = payload.pharmacy.filter((p) => p.registrationNumber);
const syntheticCosts = allRows.filter((p) => p.costSource === "synthetic_demo").length;
const factualSpcCosts = payload.pharmacy.filter((p) => p.costSource === "spc_wholesale").length;
const priceOnlyNames = payload.pharmacy.filter((p) => /^[-–—\s]*LKR\s*[0-9]/i.test(String(p.productName ?? ""))).length;
const obviousFoodSkin = payload.pharmacy.filter((p) => p.source === "spar2u" && p.category === "Skin Care" && /\b(?:FULL CREAM MILK|MILK POWDER|YOGHURT|YOGURT|CHEESE|BUTTER|COCONUT CREAM|CREAMER)\b/i.test(String(p.productName ?? ""))).length;
const truncatedNames = allRows.filter((p) => String(p.productName ?? "").includes("...")).length;
const blankNames = allRows.filter((p) => !String(p.productName ?? "").trim()).length;
// The fragment guard is deliberately Pharmacy-specific. Grocery has valid
// compact brands such as "7 UP" that should not be rejected merely because
// their alphabetic brand token is short; the bad fragment class was observed
// in Healthguard Pharmacy acquisition (100G / 60 S / AD S / etc.).
const invalidIdentityNames = payload.pharmacy.filter((p) => catalogNameQualityIssue(p.productName)).length;
const zeroRetailPrices = allRows.filter((p) => !(Number(p.sellPrice) > 0)).length;
const medicineDosageFormCount = medicines.filter((p) => p.dosageForm).length;
const babyNutritionCount = payload.pharmacy.filter((p) => p.category === "Baby Nutrition").length;
const medicalDeviceCount = payload.pharmacy.filter((p) => p.category === "Medical Devices").length;
const personalCareCount = payload.pharmacy.filter((p) => p.department === "Personal Care").length;
const convenienceCount = payload.pharmacy.filter((p) => p.department === "Convenience Retail").length;

const duplicateCount = (rows, keyOf) => {
  const keys = rows.map(keyOf);
  return keys.length - new Set(keys).size;
};

const approvedHosts = {
  spc: new Set(["www.spc.lk", "spc.lk"]),
  healthguard: new Set(["www.healthguard.lk", "healthguard.lk"]),
  spar2u: new Set(["spar2u.lk", "www.spar2u.lk"]),
};
let invalidSourceUrls = 0;
for (const row of allRows) {
  try {
    const url = new URL(row.sourceUrl);
    if (url.protocol !== "https:" || !approvedHosts[row.source]?.has(url.hostname)) invalidSourceUrls += 1;
  } catch {
    invalidSourceUrls += 1;
  }
}

let invalidRegulatoryProvenance = 0;
for (const row of regulatoryRows) {
  try {
    const url = new URL(row.regulatorySourceUrl);
    if (row.regulatorySource !== "mediverify" || url.protocol !== "https:" || !["mediverify.lk", "www.mediverify.lk"].includes(url.hostname)) {
      invalidRegulatoryProvenance += 1;
    }
  } catch {
    invalidRegulatoryProvenance += 1;
  }
}

const summary = {
  generatedAt: payload.generatedAt,
  pharmacy: payload.pharmacy.length,
  medicineCount,
  nonMedicineCount,
  pharmacyDepartments: pharmacyDepartments.size,
  pharmacyCategoryPaths: pharmacyCategories.size,
  medicineDosageFormCount,
  medicineDosageFormCoverage: medicineCount ? Math.round((medicineDosageFormCount / medicineCount) * 10000) / 100 : 0,
  babyNutritionCount,
  medicalDeviceCount,
  personalCareCount,
  convenienceCount,
  grocery: payload.grocery.length,
  groceryCategoryPaths: groceryCategories.size,
  sourceCounts: payload.sourceCounts,
  factualSpcCosts,
  syntheticCosts,
  regulatoryConservativeMatches: regulatoryRows.length,
  priceOnlyNames,
  obviousFoodSkin,
  truncatedNames,
  blankNames,
  invalidIdentityNames,
  zeroRetailPrices,
  invalidSourceUrls,
  invalidRegulatoryProvenance,
  pharmacyDuplicateSourceIds: duplicateCount(payload.pharmacy, (p) => `${p.source}:${p.sourceProductId}`),
  groceryDuplicateSourceIds: duplicateCount(payload.grocery, (p) => `${p.source}:${p.sourceProductId}`),
  pharmacyDuplicateIds: duplicateCount(payload.pharmacy, (p) => p.id),
  groceryDuplicateIds: duplicateCount(payload.grocery, (p) => p.id),
};

console.log(JSON.stringify(summary, null, 2));
if (summaryPath) await writeFile(resolve(summaryPath), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

const fail = (condition, message) => { if (condition) throw new Error(message); };
fail((payload.sourceCounts?.spc ?? 0) < 150, `SPC coverage too small: ${payload.sourceCounts?.spc ?? 0}`);
fail((payload.sourceCounts?.healthguard ?? 0) < 500, `Healthguard coverage too small: ${payload.sourceCounts?.healthguard ?? 0}`);
fail(payload.grocery.length < 1000, `Grocery coverage too small: ${payload.grocery.length}`);
fail(payload.pharmacy.length < 1000, `Pharmacy coverage too small: ${payload.pharmacy.length}`);
fail(medicineCount < 100, `Medicine coverage too small: ${medicineCount}`);
fail(nonMedicineCount < 500, `Modern pharmacy non-medicine coverage too small: ${nonMedicineCount}`);
fail(pharmacyDepartments.size < 5, `Pharmacy department breadth too small: ${pharmacyDepartments.size}`);
fail(pharmacyCategories.size < 20, `Pharmacy taxonomy too narrow: ${pharmacyCategories.size}`);
fail(medicineCount > 0 && medicineDosageFormCount / medicineCount < 0.7, `Explicit dosage-form coverage too low: ${summary.medicineDosageFormCoverage}%`);
fail(babyNutritionCount < 1, "No Baby Nutrition products were identified");
fail(medicalDeviceCount < 20, `Medical-device coverage too small: ${medicalDeviceCount}`);
fail(personalCareCount < 100, `Personal-care coverage too small: ${personalCareCount}`);
fail(convenienceCount < 50, `Convenience-retail coverage too small: ${convenienceCount}`);
fail(regulatoryRows.length < 1, "Regulatory enrichment produced zero conservative matches");
fail(priceOnlyNames > 0, `Price-only pseudo-products detected: ${priceOnlyNames}`);
fail(obviousFoodSkin > 0, `Obvious grocery products misclassified as Skin Care: ${obviousFoodSkin}`);
fail(truncatedNames > 0, `Truncated product names remain after hydration: ${truncatedNames}`);
fail(blankNames > 0, `Blank product names detected: ${blankNames}`);
fail(invalidIdentityNames > 0, `Insufficient Pharmacy product identities detected: ${invalidIdentityNames}`);
fail(zeroRetailPrices > 20, `Too many products have no public sell price: ${zeroRetailPrices}`);
fail(invalidSourceUrls > 0, `Invalid/unapproved source URLs detected: ${invalidSourceUrls}`);
fail(invalidRegulatoryProvenance > 0, `Regulatory rows missing exact MediVerify provenance: ${invalidRegulatoryProvenance}`);
fail(summary.pharmacyDuplicateSourceIds || summary.groceryDuplicateSourceIds || summary.pharmacyDuplicateIds || summary.groceryDuplicateIds, "Duplicate catalog identities detected");

console.log("LakBiz demo catalog validation PASSED");
