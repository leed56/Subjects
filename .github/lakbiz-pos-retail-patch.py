from pathlib import Path

# Final bilingual polish for the already-applied Pharmacy/Grocery POS changes.
p = Path("lakbiz/app/src/app/sales/page.tsx")
s = p.read_text()
replacements = [
    (
        'placeholder={fastRetailPos ? (org.sector === "pharmacy" ? "Search medicine, generic, brand, code or barcode…" : "Scan barcode or search product, brand or code…") : t("sales.search_placeholder")}',
        'placeholder={fastRetailPos ? (si ? (org.sector === "pharmacy" ? "ඖෂධය, generic නම, brand, code හෝ barcode සොයන්න…" : "Barcode scan කරන්න හෝ භාණ්ඩය, brand හෝ code සොයන්න…") : (org.sector === "pharmacy" ? "Search medicine, generic, brand, code or barcode…" : "Scan barcode or search product, brand or code…")) : t("sales.search_placeholder")}',
    ),
    (
        '<span>{org.sector === "pharmacy" ? "Name · generic · brand · strength · code · barcode" : "Name · brand · code · barcode"}</span>',
        '<span>{si ? (org.sector === "pharmacy" ? "නම · generic · brand · strength · code · barcode" : "නම · brand · code · barcode") : (org.sector === "pharmacy" ? "Name · generic · brand · strength · code · barcode" : "Name · brand · code · barcode")}</span>',
    ),
    (
        '<span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">Enter adds first match · Esc clears</span>',
        '<span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{si ? "Enter = පළමු match එක add · Esc = clear" : "Enter adds first match · Esc clears"}</span>',
    ),
    (
        '>All <span className="opacity-70">{inStock.length}</span></button>',
        '>{si ? "සියල්ල" : "All"} <span className="opacity-70">{inStock.length}</span></button>',
    ),
    (
        '|| "Batch-controlled stock"}</p>',
        '|| (si ? "Batch පාලිත තොග" : "Batch-controlled stock")}</p>',
    ),
    (
        '<span className="block text-sm font-bold text-slate-800">Show more products</span>',
        '<span className="block text-sm font-bold text-slate-800">{si ? "තවත් භාණ්ඩ පෙන්වන්න" : "Show more products"}</span>',
    ),
    (
        '<span className="mt-1 block text-xs text-slate-500">Showing {visibleProducts.length} of {filtered.length}. Search or choose a category for faster access.</span>',
        '<span className="mt-1 block text-xs text-slate-500">{si ? `${filtered.length} න් ${visibleProducts.length} පෙන්වයි. ඉක්මනින් සොයාගැනීමට search හෝ category භාවිතා කරන්න.` : `Showing ${visibleProducts.length} of ${filtered.length}. Search or choose a category for faster access.`}</span>',
    ),
]
for old, new in replacements:
    if old in s:
        s = s.replace(old, new, 1)
p.write_text(s)

# Do not expose the assigned platform template in the Sinhala dashboard either.
p = Path("lakbiz/app/src/components/dashboard/retail-command-center.tsx")
s = p.read_text()
s = s.replace('pharmacyEyebrow: "ඖෂධ අලෙවිසැල් මෙහෙයුම්"', 'pharmacyEyebrow: "මෙහෙයුම් වැඩබිම"', 1)
s = s.replace('groceryEyebrow: "සිල්ලර මෙහෙයුම් මධ්‍යස්ථානය"', 'groceryEyebrow: "මෙහෙයුම් වැඩබිම"', 1)
p.write_text(s)

# The temporary patch assets are removed by the final workflow run.
for temp in [Path(".github/lakbiz-pos-retail-patch.py"), Path(".github/workflows/lakbiz-pos-retail-patch.yml")]:
    if temp.exists():
        temp.unlink()
