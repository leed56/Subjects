import { readFile, writeFile } from "node:fs/promises";

const source = await readFile("src/lib/grocery-localization.ts", "utf8");
const labels = [...source.matchAll(/^  "(GRC-(?:MILL|MEAT)-[A-Z]{3}-001)": \{ en: "([^"]+)", si: "([^"]+)", ta: "([^"]+)" \},$/gm)];
if (labels.length !== 45) throw new Error(`Expected 36 mill and 9 meat labels; found ${labels.length}`);
const rows = labels.map(([, sku, en, si, ta]) => `| ${sku} | ${en} | ${si} | ${ta} |  |`).join("\n");
const markdown = `# Native-language review: optional grocery catalogues

These display names are drafts tied to stable SKUs. The user's Sinhala and Tamil
native reviewers should check spelling, locally used shop terms, product
distinctions, pack and selling units, search synonyms, and the Stock confirmation
and POS checkout wording. Record corrections in the last column, then add each
reviewer's name, locale and date below. Do not mark this gate complete before
both reviewers have checked the actual screens at desktop and mobile widths.

The 36 mill templates are researched in [GRINDING_MILL_CATALOGUE.md](GRINDING_MILL_CATALOGUE.md).
The nine meat templates are researched in [GROCERY_MEAT_CATALOGUE.md](GROCERY_MEAT_CATALOGUE.md).

| SKU | English | Sinhala draft | Tamil draft | Correction or approved |
| --- | --- | --- | --- | --- |
${rows}

Sinhala reviewer: **pending**

Review date: **pending**

Tamil reviewer: **pending**

Review date: **pending**

Screens and selling units reviewed: **pending**
`;
await writeFile("docs/GROCERY_NATIVE_REVIEW.md", markdown, "utf8");
console.log("Prepared 45-row native review sheet.");
