"use client";

import { useState } from "react";

/* Owner-supplied product photos use the regular img element because product
 * assets may be uploaded to the shop or bundled with the catalogue. */
/* eslint-disable @next/next/no-img-element */

const BARCODE_PRODUCT_IMAGES: ReadonlyArray<{
  barcodes: readonly string[];
  terms: readonly string[];
  src: string;
}> = [
  { barcodes: ["8697449910575"], terms: ["altunsa cola drink"], src: "/images/grocery/brands/altunsa-cola.jpg" },
  { barcodes: ["8697449910735"], terms: ["altunsa mango drink"], src: "/images/grocery/brands/altunsa-mango.jpg" },
  { barcodes: ["8697449910810"], terms: ["altunsa orange drink"], src: "/images/grocery/brands/altunsa-orange.jpg" },
  { barcodes: ["4796022660587"], terms: ["abha colour liquid", "abha color liquid", "abha 5 minute hair colour"], src: "/images/grocery/brands/abha-colour-liquid-21ml.jpg" },
  { barcodes: ["4796022661980"], terms: ["abha herbal black henna"], src: "/images/grocery/brands/abha-henna-black-10g.jpg" },
  { barcodes: ["4792057036014"], terms: ["alli thosai mixture"], src: "/images/grocery/brands/alli-thosai-mixture-400g.jpg" },
];

// These isolated photographs are for unbranded produce and bulk staples only.
// Match the whole product name (optionally followed by a unit/quantity) so an
// item such as Apple Hair Colour or Banana Chewing Gum cannot inherit fruit art.
const COMMODITY_PHOTOS: ReadonlyArray<{ terms: readonly string[]; src: string }> = [
  { terms: ["banana", "bananas", "plantain", "කෙසෙල්", "வாழைப்பழம்"], src: "/images/grocery/banana.png" },
  { terms: ["apple", "apples", "ඇපල්", "ஆப்பிள்"], src: "/images/grocery/apple.png" },
  { terms: ["tomato", "tomatoes", "තක්කාලි", "தக்காளி"], src: "/images/grocery/tomato.png" },
  { terms: ["potato", "potatoes", "අර්තාපල්", "உருளைக்கிழங்கு"], src: "/images/grocery/potato.png" },
  { terms: ["red onion", "onion", "ලූනු", "வெங்காயம்"], src: "/images/grocery/red-onion.png" },
  { terms: ["carrot", "carrots", "කැරට්", "கேரட்"], src: "/images/grocery/carrot.png" },
  { terms: ["ginger", "ඉඟුරු", "இஞ்சி"], src: "/images/grocery/ginger.png" },
  { terms: ["green chilli", "green chili", "අමු මිරිස්", "பச்சை மிளகாய்"], src: "/images/grocery/green-chilli.png" },
  { terms: ["bread", "පාන්", "ரொட்டி"], src: "/images/grocery/bread.png" },
  { terms: ["wheat flour", "flour", "wheat", "පිටි", "மா"], src: "/images/grocery/wheat-flour.png" },
  { terms: ["rice", "basmathi", "basmati", "samba", "keeri samba", "rathu kakulu", "kekulu", "හාල්", "සහල්", "அரிசி"], src: "/images/grocery/rice.png" },
  { terms: ["sugar", "seeni", "sini", "සීනි", "சீனி"], src: "/images/grocery/sugar.png" },
  { terms: ["coconut", "පොල්", "தேங்காய்"], src: "/images/grocery/coconut.png" },
  { terms: ["egg", "eggs", "බිත්තර", "முட்டை"], src: "/images/grocery/eggs.png" },
];

const CATEGORY_IMAGES: ReadonlyArray<{ terms: readonly string[]; src: string }> = [
  { terms: ["fruit"], src: "/images/grocery/apple.png" },
  { terms: ["vegetable"], src: "/images/grocery/carrot.png" },
  { terms: ["bread", "bakery"], src: "/images/grocery/bread.png" },
  { terms: ["milk", "dairy"], src: "/images/grocery/fresh-milk.png" },
  { terms: ["meat", "seafood", "poultry"], src: "/images/grocery/chicken.png" },
  { terms: ["rice", "flour", "grain"], src: "/images/grocery/rice.png" },
  { terms: ["sugar", "salt"], src: "/images/grocery/sugar.png" },
  { terms: ["coconut"], src: "/images/grocery/coconut.png" },
  { terms: ["egg"], src: "/images/grocery/eggs.png" },
];

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function containsTerm(value: string, term: string): boolean {
  const haystack = normalize(value);
  const needle = normalize(term);
  if (!haystack || !needle) return false;
  if (/[\u0B80-\u0BFF\u0D80-\u0DFF]/u.test(needle)) return haystack.includes(needle);
  return (` ${haystack} `).includes(` ${needle} `);
}

function quantityTailOnly(value: string, phrase: string): boolean {
  const normalized = normalize(value);
  const normalizedPhrase = normalize(phrase);
  if (normalized === normalizedPhrase) return true;
  if (!normalized.startsWith(`${normalizedPhrase} `)) return false;
  const tail = normalized.slice(normalizedPhrase.length).trim();
  return /^(?:\d+(?:\.\d+)?\s*)?(?:kg|g|mg|l|ml|pcs|pc|pack|packs|units?)?$/.test(tail);
}

function specificImageFor(name: string, sku?: string | null, barcode?: string | null): string | undefined {
  const productCodes = [barcode, sku]
    .map((code) => code?.trim())
    .filter((code): code is string => Boolean(code));
  const exactBarcodeMatch = BARCODE_PRODUCT_IMAGES.find((item) =>
    item.barcodes.some((code) => productCodes.includes(code)),
  );
  if (exactBarcodeMatch) return exactBarcodeMatch.src;

  const brandedNameMatch = BARCODE_PRODUCT_IMAGES.find((item) =>
    item.terms.some((term) => containsTerm(name, term)),
  );
  if (brandedNameMatch) return brandedNameMatch.src;

  // Ajinomoto is the shop's bulk monosodium-glutamate product. Its source row
  // has a stock code rather than a retail barcode, so match the product name.
  if (["ajinomoto", "ajinamoto", "ajinomota", "aji no moto", "monosodium glutamate", "msg powder"]
    .some((term) => quantityTailOnly(name, term))) {
    return "/images/grocery/brands/ajinomoto-msg-100g.jpg";
  }

  return COMMODITY_PHOTOS.find((item) => item.terms.some((term) => quantityTailOnly(name, term)))?.src;
}

function imageForCategory(label: string): string | undefined {
  return CATEGORY_IMAGES.find((item) => item.terms.some((term) => containsTerm(label, term)))?.src;
}

function ProductArt({ source, className = "" }: { source?: string; className?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  if (!source || failedSource === source) {
    return (
      <span aria-hidden="true" className={`flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 ${className}`}>
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9" aria-hidden="true">
          <path d="M10 16.5h28v21H10zM17 16.5l2.5-5h9l2.5 5M10 22h28" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="24" cy="29.5" r="5.5" stroke="currentColor" strokeWidth="2.4" />
        </svg>
      </span>
    );
  }

  return (
    <img
      src={source}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailedSource(source)}
      className={`block object-contain object-center ${className}`}
    />
  );
}

export function GroceryProductArt({
  name,
  sku,
  barcode,
  imageUrl,
  className = "",
}: {
  name: string;
  category?: string;
  sku?: string | null;
  barcode?: string | null;
  imageUrl?: string;
  className?: string;
}) {
  const ownerImage = imageUrl?.trim();
  const source = ownerImage || specificImageFor(name, sku, barcode);
  return <ProductArt source={source} className={className} />;
}

export function GroceryCategoryArt({ label, className = "" }: { label: string; className?: string }) {
  return <ProductArt source={imageForCategory(label)} className={className} />;
}
