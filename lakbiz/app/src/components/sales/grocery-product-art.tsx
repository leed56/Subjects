"use client";

const ITEMS = [
  ["banana", "plantain", "කෙසෙල්"],
  ["apple"],
  ["tomato", "තක්කාලි"],
  ["potato", "අර්තාපල්"],
  ["onion", "red onion", "ලූනු"],
  ["carrot", "කැරට්"],
  ["ginger", "ඉඟුරු"],
  ["chili", "chilli", "මිරිස්"],
  ["chicken", "poultry", "කුකුල්"],
  ["bread", "පාන්"],
  ["rice", "හාල්", "සහල්"],
  ["flour", "wheat", "පිටි"],
  ["sugar", "සීනි"],
  ["coconut", "පොල්"],
  ["egg", "බිත්තර"],
  ["milk", "කිරි"],
] as const;

function spriteIndex(name: string, category?: string) {
  const value = `${name} ${category ?? ""}`.toLowerCase();
  const found = ITEMS.findIndex((words) => words.some((word) => value.includes(word)));
  if (found >= 0) return found;
  return Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0) % ITEMS.length;
}

function spriteStyle(index: number) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    backgroundImage: "url('/images/grocery-product-sprite.png')",
    backgroundPosition: `${(column / 3) * 100}% ${(row / 3) * 100}%`,
    backgroundSize: "400% 400%",
  } as const;
}

export function GroceryProductArt({ name, category, className = "" }: { name: string; category?: string; className?: string }) {
  return <span aria-hidden="true" className={`block bg-center bg-no-repeat ${className}`} style={spriteStyle(spriteIndex(name, category))} />;
}

export function GroceryCategoryArt({ label, className = "" }: { label: string; className?: string }) {
  return <GroceryProductArt name={label} className={className} />;
}

const STARTER_CATALOGUE = [
  "Banana", "Tomato", "Potato", "Red onion", "Carrot", "Ginger", "Chicken", "Bread",
  "Rice", "Flour", "Sugar", "Milk",
];

/** A visual, non-transactional starter shelf shown only until this shop has
 * real inventory. It makes the empty POS useful without inventing stock or
 * prices that could be charged to a customer. */
export function GroceryStarterShelf({ title, description }: { title: string; description: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-blue-100 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.14),transparent_35%),linear-gradient(135deg,#f8fbff,#ffffff_55%,#eef6ff)] p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-xl shadow-lg shadow-blue-200">🛒</span>
        <div>
          <p className="text-sm font-extrabold tracking-tight text-slate-950">{title}</p>
          <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {STARTER_CATALOGUE.map((name) => (
          <div key={name} className="rounded-xl border border-white/80 bg-white/80 p-2 text-center shadow-sm">
            <GroceryProductArt name={name} className="mx-auto h-12 w-full" />
            <p className="mt-1 truncate text-[10px] font-bold text-slate-700">{name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
