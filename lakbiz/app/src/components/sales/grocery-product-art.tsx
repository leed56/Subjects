"use client";

import { useState } from "react";

/* Owner-supplied image URLs are allowed, so render them with a regular img.
 * Unrecognized products use a neutral placeholder instead of borrowing art
 * from an unrelated category (for example, cosmetics showing a coconut). */
/* eslint-disable @next/next/no-img-element */

const PRODUCT_IMAGES: ReadonlyArray<{ terms: readonly string[]; src: string }> = [
  { terms: ["green chilli", "green chili"], src: "/images/grocery/green-chilli.png" },
  { terms: ["broiler parent chicken", "parent chicken"], src: "/images/grocery/meat/broiler-parent-chicken.svg" },
  { terms: ["chicken breast"], src: "/images/grocery/meat/chicken-breast.svg" },
  { terms: ["chicken drumstick", "chicken drumsticks", "drumstick"], src: "/images/grocery/meat/chicken-drumsticks.svg" },
  { terms: ["chicken parts"], src: "/images/grocery/meat/chicken-parts.svg" },
  { terms: ["small sausage", "small sausages", "sausage small"], src: "/images/grocery/meat/sausages-small.svg" },
  { terms: ["large sausage", "large sausages", "sausage large", "big sausage"], src: "/images/grocery/meat/sausages-large.svg" },
  { terms: ["meatball", "meatballs"], src: "/images/grocery/meat/meatballs.svg" },
  { terms: ["farm chicken"], src: "/images/grocery/meat/farm-chicken.svg" },
  { terms: ["banana", "plantain", "කෙසෙල්"], src: "/images/grocery/banana.png" },
  { terms: ["apple"], src: "/images/grocery/apple.png" },
  { terms: ["tomato", "තක්කාලි"], src: "/images/grocery/tomato.png" },
  { terms: ["potato", "අර්තාපල්"], src: "/images/grocery/potato.png" },
  { terms: ["red onion", "onion", "ලූනු"], src: "/images/grocery/red-onion.png" },
  { terms: ["carrot", "කැරට්"], src: "/images/grocery/carrot.png" },
  { terms: ["ginger", "ඉඟුරු"], src: "/images/grocery/ginger.png" },
  { terms: ["chicken", "poultry", "කුකුල්"], src: "/images/grocery/chicken.png" },
  { terms: ["bread", "පාන්"], src: "/images/grocery/bread.png" },
  { terms: ["wheat flour", "flour", "wheat", "පිටි"], src: "/images/grocery/wheat-flour.png" },
  { terms: ["rice", "හාල්", "සහල්"], src: "/images/grocery/rice.png" },
  { terms: ["sugar", "සීනි"], src: "/images/grocery/sugar.png" },
  { terms: ["coconut", "පොල්"], src: "/images/grocery/coconut.png" },
  { terms: ["egg", "බිත්තර"], src: "/images/grocery/eggs.png" },
  { terms: ["fresh milk", "milk", "කිරි"], src: "/images/grocery/fresh-milk.png" },
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
  // Sinhala and Tamil do not use whitespace-delimited morphology like English;
  // substring matching preserves their localized product-name support.
  if (/[\u0B80-\u0BFF\u0D80-\u0DFF]/u.test(needle)) return haystack.includes(needle);
  return (` ${haystack} `).includes(` ${needle} `) || (` ${haystack} `).includes(` ${needle}s `);
}

function productImageFor(name: string): string | undefined {
  return PRODUCT_IMAGES.find((item) => item.terms.some((term) => containsTerm(name, term)))?.src;
}

function categoryImageFor(label: string): string | undefined {
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
  imageUrl,
  className = "",
}: {
  name: string;
  category?: string;
  imageUrl?: string;
  className?: string;
}) {
  const source = imageUrl?.trim() || productImageFor(name);
  return <ProductArt source={source} className={className} />;
}

export function GroceryCategoryArt({ label, className = "" }: { label: string; className?: string }) {
  return <ProductArt source={categoryImageFor(label)} className={className} />;
}

