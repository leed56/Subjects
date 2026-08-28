#!/usr/bin/env node
/**
 * i18n key-parity regression guard.
 *
 * Round 6 finding (HVAC sweep, translations audit): Tamil covers only
 * ~13% of the app's translation keys (227 of ~1707) -- every major
 * module (Jobs, Dashboard, Admin, Messages, Sales, Stock, Vehicles,
 * Bills, VAT, and 24 more) is missing wholesale, not scattered gaps.
 * translate(locale, key) falls back through dictionaries[locale][key]
 * -> dictionaries.en[key] -> a humanized version of the key itself, so
 * a missing Tamil string silently shows English rather than a raw key
 * -- which is exactly why this went unnoticed for this long.
 *
 * Per the explicit decision on scope: this script does NOT attempt to
 * close that gap (that's real translation work, likely wanting a
 * native-speaker pass, tracked separately). What it DOES do is stop
 * that gap from growing invisibly from here: scripts/i18n-parity-
 * baseline.json is a snapshot of every key currently missing per
 * locale (the existing, tolerated debt). This script recomputes the
 * real gap from translations.ts and fails only on keys missing from a
 * locale that are NOT already in that locale's baseline -- i.e. a
 * *newly introduced* gap (someone added an English/Sinhala string and
 * never gave Tamil or Sinhala the same key). The existing ~1480-key
 * Tamil debt stays tolerated until it's actually translated; closing
 * part of it only shrinks the baseline, it never fails this check.
 *
 * Usage: node scripts/check-i18n-parity.mjs
 *   Exits 1 and prints exactly which keys are newly missing, and from
 *   which locale, if any. Exits 0 otherwise (including today, with the
 *   full existing Tamil gap in place).
 *
 * To intentionally accept a new gap (e.g. mid-refactor) or to record
 * progress after translating some keys, regenerate the baseline:
 *   node scripts/check-i18n-parity.mjs --write-baseline
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const translationsPath = path.join(__dirname, "..", "src", "lib", "i18n", "translations.ts");
const baselinePath = path.join(__dirname, "i18n-parity-baseline.json");

const source = readFileSync(translationsPath, "utf8");
const lines = source.split("\n");

/** Locates `const <name>: Dict = {` ... closing `};` at column 0, and
 * extracts every top-level `"key.path": ...` line inside that range.
 * Deliberately line-based (not a JSON/AST parse) -- translations.ts is
 * a plain TS object literal with one key per line, which every
 * existing entry in the file already follows; a stray key that doesn't
 * match this shape is exactly the kind of format drift worth this
 * script noticing anyway (it would just be silently invisible to it,
 * not a false failure). */
function findDictBlock(name) {
  const startPattern = new RegExp(`^const ${name}: Dict = \\{`);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startPattern.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    throw new Error(`Could not find "const ${name}: Dict = {" in ${translationsPath}`);
  }
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\};?\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error(`Could not find the closing "};" for "const ${name}" in ${translationsPath}`);
  }
  const keys = new Set();
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^\s*"([^"]+)":/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

const si = findDictBlock("si");
const en = findDictBlock("en");
const ta = findDictBlock("ta");

// Canonical key set: si and en are the two locales this app has always
// kept in lockstep (see the near-zero diff between them) -- their
// union is "every key a user could ever need," independent of which
// locale happens to have introduced it first.
const canonical = new Set([...si, ...en]);

function missingFrom(locale) {
  return [...canonical].filter((k) => !locale.has(k)).sort();
}

const current = {
  si: missingFrom(si),
  en: missingFrom(en),
  ta: missingFrom(ta),
};

if (process.argv.includes("--write-baseline")) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Wrote ${baselinePath}`);
  console.log(`  si missing: ${current.si.length}`);
  console.log(`  en missing: ${current.en.length}`);
  console.log(`  ta missing: ${current.ta.length}`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

let failed = false;
for (const locale of ["si", "en", "ta"]) {
  const allowed = new Set(baseline[locale] ?? []);
  const newlyMissing = current[locale].filter((k) => !allowed.has(k));
  if (newlyMissing.length > 0) {
    failed = true;
    console.error(`\n✖ ${newlyMissing.length} key(s) newly missing from "${locale}" (not in the tolerated baseline):`);
    for (const k of newlyMissing) console.error(`    ${k}`);
  }
}

if (failed) {
  console.error(
    "\nEvery locale must define every key some other locale defines, OR the gap must already be" +
      "\nrecorded in scripts/i18n-parity-baseline.json. Either add the missing translation(s), or if" +
      "\nthis gap is intentional/pre-existing, run: node scripts/check-i18n-parity.mjs --write-baseline",
  );
  process.exit(1);
}

console.log("i18n key parity: no new gaps beyond the tolerated baseline.");
console.log(`  (baseline debt: si ${baseline.si?.length ?? 0}, en ${baseline.en?.length ?? 0}, ta ${baseline.ta?.length ?? 0})`);
