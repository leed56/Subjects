"use client";

import { useState, type ReactNode } from "react";
import { GroceryCatalogArt, type GroceryCatalogArtKind } from "@/components/sales/grocery-catalog-art";

/* Owner-supplied image URLs are allowed, so render them with a regular img.
 * Unrecognized products use a neutral placeholder instead of borrowing art
 * from an unrelated category (for example, cosmetics showing a coconut). */
/* eslint-disable @next/next/no-img-element */

const PRODUCT_IMAGES: ReadonlyArray<{ terms: readonly string[]; src: string }> = [
  { terms: ["green chilli", "green chili"], src: "/images/grocery/green-chilli.png" },
  { terms: ["chicken liver"], src: "/images/grocery/meat/chicken-parts.svg" },
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
  { terms: ["rice", "basmathi", "basmati", "samba", "keeri samba", "rathu kakulu", "kekulu", "හාල්", "සහල්"], src: "/images/grocery/rice.png" },
  { terms: ["sugar", "seeni", "sini", "සීනි"], src: "/images/grocery/sugar.png" },
  { terms: ["coconut", "පොල්"], src: "/images/grocery/coconut.png" },
  { terms: ["egg", "බිත්තර"], src: "/images/grocery/eggs.png" },
  { terms: ["fresh milk", "milk", "කිරි"], src: "/images/grocery/fresh-milk.png" },
];

// Keep dedicated meat-cut artwork ahead of family-level category art.
const SPECIFIC_PRODUCT_IMAGES = PRODUCT_IMAGES.slice(1, 10);

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

const CATALOG_ART_RULES: ReadonlyArray<{ terms: readonly string[]; kind: GroceryCatalogArtKind }> = [
  // Specific phrases are ordered before broad product words to avoid a brand
  // name such as “Coconut Milk Powder” receiving the wrong milk or coconut art.
  { terms: ["coconut milk powder", "coconut milkpowder", "coconut powder"], kind: "coconut-powder" },
  { terms: ["sera coconut milk", "coconut milk"], kind: "coconut-milk" },
  { terms: ["cinnamon oil", "motha banana essence", "motha banana assence", "motha banana", "banana essence", "banana assence", "motha caramel", "vanilla flavour", "vanilla flavor", "star vanilla flavour", "rose flavour", "rose fllavour", "rose flavor", "almond essence"], kind: "essence" },
  { terms: ["fortune soya", "sunflower oil", "vegetable oil", "gingelly oil", "sesame oil", "edible oil", "polthel", "coconut oil", "locale polthel"], kind: "cooking-oil" },
  { terms: ["milo drink", "chocolate milk", "chocolatemilk", "kotmale kiri vanila", "kotmale milk chocolate", "vanilla flavoured milk", "vanilla flav milk", "vanillaflavmilk", "strawberry milk", "flavoured milk", "flavored milk", "milk juice", "smak chocolate drink"], kind: "milk-drink" },
  { terms: ["milkmaid", "condensed milk"], kind: "milk-can" },
  { terms: ["yogurt drink", "yoghurt drink", "yog drink", "yog:drink", "yougut drink", "yoghurt", "yogurt"], kind: "yogurt" },
  { terms: ["curd", "set kiri"], kind: "curd" },
  { terms: ["cheese"], kind: "cheese" },
  { terms: ["astra", "margarine", "butter", "fat spread"], kind: "butter" },
  { terms: ["anchor milk", "anchor", "milk powder", "full cream milk powder", "ratthi", "maliban kiri", "kiri w f"], kind: "milk-powder" },
  { terms: ["ice cream", "icecream", "chocolateicecream", "ice cup", "faluda ice", "kotmale milky berry", "milky pop", "kithul ice"], kind: "ice-cream" },
  { terms: ["kelloggs oats", "kellogs chocos", "corn flakes", "samaposha", "oats", "cereal"], kind: "cereal" },
  { terms: ["mixed fruit jam", "strawberry jam", "mango jam", "woodapple jam", "melon jam", "jam cup", "jam"], kind: "jam" },
  { terms: ["motha baking powder", "baking powder", "cornflour", "corn flour", "custard powder", "jelly powder", "gelatine", "gelatin", "faluda mix", "icing sugar", "kurakkan flour", "kurakkan lus", "gram flour", "idli flour", "alli thosai mixture", "allie thosai mixture", "thosai mix", "thosai mixture", "kurakkan", "string hopper flour", "white rice flour", "rice flour", "atta flour", "prima flour", "wheat flour", "tetha hal piti"], kind: "baking" },
  { terms: ["motha vanilla custard", "king custard", "motha jelly", "blackcurrant jelly", "orange jelly", "strawberry jelly"], kind: "baking" },
  { terms: ["chicken sausagess", "chicken sausage", "sausages", "sausage", "hot dog"], kind: "sausage" },
  { terms: ["maggi chicken", "chicken cube", "knor seasoning", "seasoning powder"], kind: "spice-powder" },
  { terms: ["soya meat", "cuttlefish soya", "soya chicken", "devilled prawn soya", "soya"], kind: "soya" },
  { terms: ["noodle", "kottu mee", "dagara noodles", "pasta", "prima stella chicken"], kind: "noodles" },
  { terms: ["cuttlefish", "jack mackerel", "canned fish", "ocean star"], kind: "canned-fish" },
  { terms: ["karawala", "dry fish", "katta", "keeramin"], kind: "dry-fish" },
  { terms: ["tomato sauce", "tomato sause", "fish sauce", "fish sause", "soya sauce", "ketchup", "oyster sauce", "oyster sause", "dark sauce", "chilli sauce", "chille sauce", "mayonnaise", "mango chutney", "marmite", "sambal"], kind: "sauce" },
  { terms: ["vinegar", "vinger", "vinakiri"], kind: "vinegar" },
  { terms: ["rose water", "rosewater"], kind: "rose-water" },
  { terms: ["apple juice", "mixed fruit nectar", "mixed fruit cordial", "orange cordial", "sunquick", "fruit nectar", "mango nectar", "woodapple nectar", "mango drink", "orange drink", "altunsa mango", "altunsa orange", "orange crush", "freshco lime", "fruit n nut", "fruit and nut drink", "fruit drink", "juice", "nectar"], kind: "juice" },
  { terms: ["cola", "coca cola", "cocacola", "kik cola", "my cola"], kind: "cola" },
  { terms: ["lemonade", "appa soda", "cream soda", "soda", "egb", "ginger beer", "orange barley", "portello", "necto", "sprite", "fanta"], kind: "soda" },
  { terms: ["drinking water", "mineral water", "bottled water"], kind: "water" },
  { terms: ["iced coffee", "ice coffee", "coffee drink", "smak coffee", "coffee", "nescafe", "nescafé"], kind: "coffee" },
  { terms: ["watawala tea", "ratti kiri tea", "ratthi kiri tea", "tea bag", "tea"], kind: "tea" },
  { terms: ["milo", "glucolin", "nestomalt", "nestomolt", "viva", "chocolate drink", "malt drink"], kind: "malt" },
  { terms: ["little lion choco roll", "roll cake", "maderira cake", "madeira cake", "swiss roll", "cake", "watalappan", "pudding cup"], kind: "cake" },
  { terms: ["biscuit", "biscut", "cracker", "wafer", "snacker", "cookie", "puff", "hacks original", "gem biscuit", "rusks"], kind: "biscuit" },
  { terms: ["papadam", "papad", "murukku", "tipi tip", "tipitip", "papara", "chips", "crisps", "peanuts", "jambo", "popit", "snackers masala"], kind: "snack" },
  { terms: ["perfume", "cologne", "body spray", "deodorant", "fogg", "rexona rose", "passy perfume"], kind: "perfume" },
  { terms: ["shampoo", "conditioner", "dandex", "dandex hair faill", "lifebuoy storng", "sunsilk", "hair wash", "lifebuoy health shampoo", "clear shampoo", "kumarika shampoo"], kind: "shampoo" },
  { terms: ["hair gel", "hair wax", "hair oil", "hair fall", "navarathna oil"], kind: "hair-care" },
  { terms: ["baby talc", "talc", "deo talc", "paris talc", "khomba deo talc", "voodoo talc", "rani powder"], kind: "talc" },
  { terms: ["vaseline", "baby cream", "face cream", "facial cream", "fair & lovely", "fair and lovely", "facewash", "facialwash", "face wash"], kind: "face-cream" },
  { terms: ["abha herbal black henna", "amins black henna", "herbal black henna", "black henna", "henna", "mehendi"], kind: "henna" },
  { terms: ["soap"], kind: "soap" },
  { terms: ["colour liquid", "color liquid", "food colour", "food color", "green color", "green colour", "cochineal colour", "egg yellow powder food color"], kind: "colour" },
  { terms: ["incense", "insence", "hadunkuru", "agarbathi", "sambrani", "kapuru"], kind: "incense" },
  { terms: ["toothbrush", "tooth brush", "t.brush", "chooty brush"], kind: "toothbrush" },
  { terms: ["toothpaste", "sensodyne", "clogard", "signal", "link sudantha", "supiriwiki"], kind: "toothpaste" },
  { terms: ["sanitary pad", "pads", "napkin", "cotton feel", "fems", "eva", "8napkin"], kind: "sanitary" },
  { terms: ["serviette", "tissue", "paper napkin"], kind: "serviette" },
  { terms: ["paper cup", "paper plate", "garbage bag", "grocery bag", "tulip bag", "paper"], kind: "paper-goods" },
  { terms: ["cotton buds", "cotton bud"], kind: "cotton-buds" },
  { terms: ["bulb", "fibit led", "led bulb", "day light", "leyo led"], kind: "bulb" },
  { terms: ["battery", "batery", "aa a1.5v", "laxapana aa"], kind: "battery" },
  { terms: ["broom"], kind: "broom" },
  { terms: ["bic easy", "bic comfort", "racer", "razor", "big racer"], kind: "razor" },
  { terms: ["iodex", "balm", "siddhalepa"], kind: "ointment" },
  { terms: ["detol", "dettol plaster", "panadol", "eno orange"], kind: "medicine" },
  { terms: ["d.powder", "detergent powder", "washing powder", "surf excel", "surfexcel", "sunlight detergent", "sunlight d", "diva", "rin detergent", "sunny detergent", "blish wash", "bliss wash"], kind: "detergent" },
  { terms: ["dishwash liquid", "dish wash liquid", "vim liquid", "comfort", "harpic", "lysol", "nilma", "unic", "toilet cleaner", "cleaner"], kind: "cleaning-liquid" },
  { terms: ["ninja", "mortien", "mosquito vaporizer", "ratkill", "rat kill", "insect repellent", "insect spray"], kind: "insect-control" },
  { terms: ["pen", "sharpener", "sello tape", "chalk", "atlas chooty", "hitline chalk"], kind: "stationery" },
  { terms: ["gini petti", "match box", "matches", "lighter"], kind: "matches" },
  { terms: ["tennis ball"], kind: "sports-ball" },
  { terms: ["honey"], kind: "honey" },
  { terms: ["chocolate", "choco", "cocoa", "chocalate"], kind: "chocolate" },
  { terms: ["chewing gum", "center fruit", "lollipop", "toffee", "toffe", "jujubs", "marbles", "marbels"], kind: "gum" },
  { terms: ["almond", "amond", "kaju", "cashew", "nut", "plums", "dates", "pottu kadala"], kind: "nuts" },
  { terms: ["salt", "sudu lunu", "isi table salt"], kind: "salt" },
  { terms: ["green peas", "peas"], kind: "peas" },
  { terms: ["gotukola", "mukunuwanna"], kind: "leafy-greens" },
  { terms: ["karawilla", "bitter gourd"], kind: "bitter-gourd" },
  { terms: ["bandakka", "okra", "ladies finger"], kind: "okra" },
  { terms: ["bonchi", "beans", "green bean"], kind: "beans" },
  { terms: ["gowa", "cabbage"], kind: "cabbage" },
  { terms: ["cassava", "casasava", "manioc"], kind: "cassava" },
  { terms: ["dhal", "lentil"], kind: "dhal" },
  { terms: ["curry leaves", "karapincha"], kind: "curry-leaves" },
  { terms: ["goraka"], kind: "goraka" },
  { terms: ["kurudu", "cinnamon stick", "cinnamon bark"], kind: "cinnamon" },
  { terms: ["chilli pieces", "chilli flakes", "chili flakes", "dried chilli"], kind: "chilli" },
  { terms: ["aba ata", "kasa kasa ata", "kottamalli ata", "mun ata", "udu ata", "coriander seed", "cumin seed", "fennel seed", "mustard seed", "poppy seed", "black pepper", "kali miris", "maduru", "karabu nati", "ajinamoto", "karadamungu", "suduru"], kind: "spice-seeds" },
  { terms: ["aba kudu", "bedapu miris kudu", "beema kudu", "miris kudu", "mas karry kudu", "malu curry kudu", "thunpaha", "curry powder", "masala", "spice powder", "chilli powder", "chili powder", "turmeric powder", "knor seasoning", "seasoning powder", "all purpose seasoning", "freelan rasam", "rashika mixer"], kind: "spice-powder" },
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
  if (needle.includes(" ") && haystack.replaceAll(" ", "").includes(needle.replaceAll(" ", ""))) return true;
  return (` ${haystack} `).includes(` ${needle} `) || (` ${haystack} `).includes(` ${needle}s `);
}

function productImageFor(name: string): string | undefined {
  return PRODUCT_IMAGES.find((item) => item.terms.some((term) => containsTerm(name, term)))?.src;
}

function productCatalogArtFor(name: string): GroceryCatalogArtKind | undefined {
  return CATALOG_ART_RULES.find((item) => item.terms.some((term) => containsTerm(name, term)))?.kind;
}

function specificProductImageFor(name: string): string | undefined {
  return SPECIFIC_PRODUCT_IMAGES.find((item) => item.terms.some((term) => containsTerm(name, term)))?.src;
}

function categoryImageFor(label: string): string | undefined {
  return CATEGORY_IMAGES.find((item) => item.terms.some((term) => containsTerm(label, term)))?.src;
}

function ProductArt({ source, fallback, className = "" }: { source?: string; fallback?: ReactNode; className?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  if (!source || failedSource === source) {
    if (fallback) return <>{fallback}</>;
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
  const ownerImage = imageUrl?.trim();
  const appDefaultImage = ownerImage?.startsWith("/images/grocery/") ? undefined : ownerImage;
  const specificImage = appDefaultImage ? undefined : specificProductImageFor(name);
  const catalogArt = productCatalogArtFor(name);
  const source = appDefaultImage || specificImage || (catalogArt ? undefined : productImageFor(name) || ownerImage);
  const fallback = catalogArt ? <GroceryCatalogArt kind={catalogArt} className={className} /> : undefined;
  if (!appDefaultImage && !specificImage && catalogArt) return fallback;
  return <ProductArt source={source} fallback={fallback} className={className} />;
}

export function GroceryCategoryArt({ label, className = "" }: { label: string; className?: string }) {
  return <ProductArt source={categoryImageFor(label)} className={className} />;
}

