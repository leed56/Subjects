from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing expected block: {label}")
    return text.replace(old, new, 1)

# Client RPC model carries category returned by the server-scoped reference catalogue.
p = Path("lakbiz/app/src/lib/supabase/product-reference-catalog.ts")
s = p.read_text()
s = replace_once(s, "  unit: string | null;\n  source: string | null;", "  unit: string | null;\n  category: string | null;\n  source: string | null;", "suggestion category type")
s = replace_once(s, "    unit: row.unit ? String(row.unit) : null,\n    source: row.source ? String(row.source) : null,", "    unit: row.unit ? String(row.unit) : null,\n    category: row.category ? String(row.category) : null,\n    source: row.source ? String(row.source) : null,", "suggestion category mapping")
p.write_text(s)

# Selecting a reference must carry the operational category when it belongs to
# the provisioned shop taxonomy. Never let a client-supplied sector override it.
p = Path("lakbiz/app/src/components/product-form.tsx")
s = p.read_text()
s = replace_once(
    s,
    "                  unit: suggestion.unit ?? current.unit,\n                  sectorCustom: {",
    "                  unit: suggestion.unit ?? current.unit,\n                  category: suggestion.category && categoriesForSector(lockedSectorId ?? current.sectorId).includes(suggestion.category)\n                    ? suggestion.category\n                    : current.category,\n                  sectorCustom: {",
    "selected suggestion category",
)
p.write_text(s)

# Drawer bodies are scroll containers. Keep the suggestion panel in document
# flow so it cannot be clipped by overflow-y-auto, while retaining keyboard UX.
p = Path("lakbiz/app/src/components/product-reference-combobox.tsx")
s = p.read_text()
s = replace_once(s, 'className="relative z-30 sm:col-span-2"', 'className="relative sm:col-span-2"', "combobox root z-index")
s = replace_once(
    s,
    'className="absolute left-0 right-0 z-[80] mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_24px_70px_rgba(15,23,42,0.22)]"',
    'className="relative z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.14)]"',
    "in-flow suggestion panel",
)
s = replace_once(
    s,
    "                const meta = [\n                  suggestion.genericName,",
    "                const meta = [\n                  suggestion.category,\n                  suggestion.genericName,",
    "suggestion category metadata",
)
p.write_text(s)
