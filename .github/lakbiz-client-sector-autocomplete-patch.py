from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing expected block: {label}")
    return text.replace(old, new, 1)

# Product form: sector remains an internal admin-provisioned configuration,
# while client item creation gets reference-catalogue type-ahead.
p = Path("lakbiz/app/src/components/product-form.tsx")
s = p.read_text()
s = replace_once(
    s,
    'import { sectors, defaultCategoryForSector, categoriesForSector, sectorById } from "@/lib/sectors";',
    'import { sectors, defaultCategoryForSector, categoriesForSector } from "@/lib/sectors";',
    "product-form sectors import",
)
s = replace_once(
    s,
    'import { SectorIcon } from "@/components/sector-icon";\n',
    'import { ProductReferenceCombobox } from "@/components/product-reference-combobox";\n',
    "product-form combobox import",
)
s = replace_once(
    s,
    '  const lockedSector = lockedSectorId ? sectorById(lockedSectorId) : undefined;\n',
    '',
    "locked sector display model",
)

old_name = '''          <label className="block sm:col-span-2">
            <span className={fieldLabel}>{t("stock.item_name")}</span>
            <input
              required
              autoFocus
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass}
            />
          </label>'''
new_name = '''          {!initial && lockedSectorId ? (
            <ProductReferenceCombobox
              label={t("stock.item_name")}
              value={form.name}
              autoFocus
              onChange={(value) => set("name", value)}
              onSelect={(suggestion) => {
                setForm((current) => ({
                  ...current,
                  name: suggestion.name,
                  sku: suggestion.sku ?? current.sku,
                  unit: suggestion.unit ?? current.unit,
                  sectorCustom: {
                    ...current.sectorCustom,
                    ...(suggestion.source ? { source: suggestion.source } : {}),
                    ...(suggestion.sourceUrl ? { sourceUrl: suggestion.sourceUrl } : {}),
                    ...(suggestion.packSize ? { packSize: suggestion.packSize } : {}),
                    ...(suggestion.brand ? { brand: suggestion.brand } : {}),
                    ...(suggestion.genericName ? { genericName: suggestion.genericName } : {}),
                    ...(suggestion.strength ? { strength: suggestion.strength } : {}),
                    ...(suggestion.dosageForm ? { dosageForm: suggestion.dosageForm } : {}),
                    ...(suggestion.manufacturer ? { manufacturer: suggestion.manufacturer } : {}),
                    ...(suggestion.manufacturingCountry ? { manufacturingCountry: suggestion.manufacturingCountry } : {}),
                    ...(suggestion.regulatoryRegistrationNumber ? { regulatoryRegistrationNumber: suggestion.regulatoryRegistrationNumber } : {}),
                    ...(suggestion.regulatorySource ? { regulatorySource: suggestion.regulatorySource } : {}),
                    ...(suggestion.regulatorySourceUrl ? { regulatorySourceUrl: suggestion.regulatorySourceUrl } : {}),
                  },
                }));
              }}
            />
          ) : (
            <label className="block sm:col-span-2">
              <span className={fieldLabel}>{t("stock.item_name")}</span>
              <input
                required
                autoFocus
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass}
              />
            </label>
          )}'''
s = replace_once(s, old_name, new_name, "item-name input")

old_sector = '''          <div className="block">
            <span className={fieldLabel}>{t("stock.sector")}</span>
            {lockedSectorId && lockedSector ? (
              <div className="mt-1.5 flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-sm font-semibold text-slate-800">
                <span className="mr-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white text-teal-700 ring-1 ring-slate-200/80">
                  <SectorIcon sectorId={lockedSector.id} className="h-4 w-4" />
                </span>
                {isSinhala ? lockedSector.nameSi : lockedSector.nameEn}
              </div>
            ) : (
              <select value={form.sectorId} onChange={(e) => handleSectorChange(e.target.value as SectorId)} className={inputClass}>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.nameSi} / {s.nameEn}</option>
                ))}
              </select>
            )}
          </div>'''
new_sector = '''          {!lockedSectorId && (
            <label className="block">
              <span className={fieldLabel}>{t("stock.sector")}</span>
              <select value={form.sectorId} onChange={(e) => handleSectorChange(e.target.value as SectorId)} className={inputClass}>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.nameSi} / {s.nameEn}</option>
                ))}
              </select>
            </label>
          )}'''
s = replace_once(s, old_sector, new_sector, "client sector field")

s = replace_once(
    s,
    '  const sectorTitle = isSinhala ? "ව්‍යාපාර-විශේෂ තොරතුරු" : "Sector-specific details";\n',
    '  const sectorTitle = isSinhala ? "අමතර භාණ්ඩ තොරතුරු" : "Additional item details";\n',
    "sector details title",
)
s = replace_once(
    s,
    '    : "Only the extra fields required by this business type.";\n',
    '    : "Additional identity and handling information used for this item.";\n',
    "sector details hint",
)

# Remove the locked-sector badge from the additional-details card. It leaks the
# provisioning template without adding any operational value.
s, count = re.subn(
    r'\n\s*\{lockedSector && \(\n\s*<span className="rounded-full bg-slate-100[^>]*>\n\s*\{isSinhala \? lockedSector\.nameSi : lockedSector\.nameEn\}\n\s*</span>\n\s*\)\}',
    '',
    s,
    count=1,
)
if count != 1:
    raise SystemExit("missing expected block: locked-sector details badge")

# Ensure a catalogue-provided unit is representable even when it is more
# specific than the small default unit preset.
s = replace_once(
    s,
    '  const units = useMemo(\n    () => unitsForSector(lockedSectorId ?? form.sectorId),\n    [lockedSectorId, form.sectorId],\n  );',
    '  const units = useMemo(\n    () => Array.from(new Set([\n      ...unitsForSector(lockedSectorId ?? form.sectorId),\n      form.unit,\n    ].filter(Boolean))),\n    [lockedSectorId, form.sectorId, form.unit],\n  );',
    "catalogue unit option",
)

p.write_text(s)

# Stock command header: keep the tailored operational behavior, but remove the
# visible sector/template label from the client surface.
p = Path("lakbiz/app/src/components/stock/stock-command-header.tsx")
s = p.read_text()
s = replace_once(s, 'import { SectorIcon } from "@/components/sector-icon";\n', '', "stock sector icon import")
s = replace_once(s, 'import { sectorById } from "@/lib/sectors";\n', '', "stock sector label import")
s = replace_once(s, '  const template = sectorById(sector);\n  const label = template?.nameEn ?? "Inventory";\n', '', "stock sector label model")
s = replace_once(
    s,
    '<span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-teal-300"><SectorIcon sectorId={sector} className="h-4.5 w-4.5" /></span>',
    '<span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-teal-300"><StockIcon className="h-4.5 w-4.5" /></span>',
    "stock header icon",
)
s = replace_once(
    s,
    '<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">{label} inventory</p>',
    '<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">Inventory operations</p>',
    "stock header eyebrow",
)
p.write_text(s)

# Dashboard intelligence remains tailored internally but no longer announces
# the provisioning template to the client.
p = Path("lakbiz/app/src/components/dashboard/sector-command-center.tsx")
s = p.read_text()
s = s.replace('eyebrow: "Grocery intelligence",', 'eyebrow: "Stock intelligence",')
s = s.replace('eyebrow: "Pharmacy intelligence",', 'eyebrow: "Stock intelligence",')
p.write_text(s)

# One-shot patch files remove themselves after the application changes land.
Path(".github/lakbiz-client-sector-autocomplete-patch.py").unlink(missing_ok=True)
Path(".github/workflows/lakbiz-client-sector-autocomplete-patch.yml").unlink(missing_ok=True)
