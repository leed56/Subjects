"use client";

/* The image URL field is owner-editable in Stock, so an ordinary image element
 * is intentional here: remote supplier/catalogue URLs are not known at build
 * time and cannot safely be placed in Next Image's static remote allowlist. */
/* eslint-disable @next/next/no-img-element */

const PRODUCT_IMAGES: ReadonlyArray<{ words: readonly string[]; src: string }> = [
  { words: ["banana", "plantain", "කෙසෙල්"], src: "/images/grocery/banana.png" },
  { words: ["apple"], src: "/images/grocery/apple.png" },
  { words: ["tomato", "තක්කාලි"], src: "/images/grocery/tomato.png" },
  { words: ["potato", "අර්තාපල්"], src: "/images/grocery/potato.png" },
  { words: ["onion", "red onion", "ලූනු"], src: "/images/grocery/red-onion.png" },
  { words: ["carrot", "කැරට්"], src: "/images/grocery/carrot.png" },
  { words: ["ginger", "ඉඟුරු"], src: "/images/grocery/ginger.png" },
  { words: ["chili", "chilli", "මිරිස්"], src: "/images/grocery/green-chilli.png" },
  { words: ["chicken", "poultry", "කුකුල්"], src: "/images/grocery/chicken.png" },
  { words: ["bread", "පාන්"], src: "/images/grocery/bread.png" },
  { words: ["rice", "හාල්", "සහල්"], src: "/images/grocery/rice.png" },
  { words: ["flour", "wheat", "පිටි"], src: "/images/grocery/wheat-flour.png" },
  { words: ["sugar", "සීනි"], src: "/images/grocery/sugar.png" },
  { words: ["coconut", "පොල්"], src: "/images/grocery/coconut.png" },
  { words: ["egg", "බිත්තර"], src: "/images/grocery/eggs.png" },
  { words: ["milk", "කිරි"], src: "/images/grocery/fresh-milk.png" },
];

const CATEGORY_IMAGES: ReadonlyArray<{ words: readonly string[]; src: string }> = [
  { words: ["fruit"], src: "/images/grocery/apple.png" },
  { words: ["vegetable"], src: "/images/grocery/carrot.png" },
  { words: ["bread", "bakery"], src: "/images/grocery/bread.png" },
  { words: ["milk", "dairy"], src: "/images/grocery/fresh-milk.png" },
  { words: ["meat", "seafood"], src: "/images/grocery/chicken.png" },
  { words: ["rice", "flour", "grain"], src: "/images/grocery/rice.png" },
  { words: ["sugar", "salt"], src: "/images/grocery/sugar.png" },
  { words: ["coconut"], src: "/images/grocery/coconut.png" },
  { words: ["egg"], src: "/images/grocery/eggs.png" },
];

function imageFor(value: string, category?: string): string {
  const normalized = `${value} ${category ?? ""}`.toLowerCase();
  return PRODUCT_IMAGES.find((item) => item.words.some((word) => normalized.includes(word)))?.src
    ?? CATEGORY_IMAGES.find((item) => item.words.some((word) => normalized.includes(word)))?.src
    ?? "/images/grocery/coconut.png";
}

export function GroceryProductArt({
  name,
  category,
  imageUrl,
  className = "",
}: {
  name: string;
  category?: string;
  imageUrl?: string;
  className?: string;
}) {
  const source = imageUrl?.trim() || imageFor(name, category);
  return <img src={source} alt="" aria-hidden="true" loading="lazy" className={`block object-contain object-center ${className}`} />;
}

export function GroceryCategoryArt({ label, className = "" }: { label: string; className?: string }) {
  return <GroceryProductArt name={label} className={className} />;
}
