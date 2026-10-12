import { ProBadge, ProCard } from "@/components/ui/pro-shell";
import { CheckIcon, StockIcon } from "@/components/ui/icons";

type RollOption = {
  id: string;
  productName: string;
  rollNo: string;
  lengthUnit: "metre" | "yard";
  availableLength: number;
  receivedLength: number;
  dyeLot: string | null;
  shade: string | null;
  rackLocation: string | null;
};

type CatalogueCopy = {
  catalogue: string; noMatch: string; available: string;
  dye: string; shade: string; metre: string; yard: string;
  selected: string; reservationLocked: string;
};

/** Read-only availability from the existing roll query; no cost or invented photo. */
export function TextileRollCatalogue({ rolls, selectedId, locked, busy = false, onSelect, copy }: {
  rolls: RollOption[];
  selectedId: string;
  locked: boolean;
  busy?: boolean;
  onSelect: (id: string) => void;
  copy: CatalogueCopy;
}) {
  return (
    <ProCard title={copy.catalogue} action={<ProBadge tone="teal">{rolls.length}</ProBadge>}>
      {locked && <p className="mb-4 text-sm leading-6 text-slate-600">{copy.reservationLocked}</p>}
      {rolls.length === 0 ? <p role="status" className="text-sm text-slate-600">{copy.noMatch}</p> : (
        <div className="textile-roll-grid" data-ui="textile-roll-catalogue">
          {rolls.map((roll) => (
            <button
              key={roll.id}
              type="button"
              aria-pressed={roll.id === selectedId}
              disabled={locked || busy}
              className="textile-roll-option"
              onClick={() => onSelect(roll.id)}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="textile-roll-icon" aria-hidden="true"><StockIcon className="h-5 w-5" /></span>
                {roll.id === selectedId && <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-blue-700"><CheckIcon className="h-4 w-4 shrink-0" /><span className="sr-only sm:not-sr-only">{copy.selected}</span></span>}
              </span>
              <span className="mt-3 block text-sm font-bold leading-5 text-slate-950">{roll.productName}</span>
              <span className="mt-1 block font-mono text-xs text-slate-500">{roll.rollNo}</span>
              <span className="mt-3 block text-base font-bold tabular-nums text-slate-900">
                {roll.availableLength.toFixed(3)} {roll.lengthUnit === "metre" ? copy.metre : copy.yard}
              </span>
              <span className="block text-xs text-slate-600">{copy.available}</span>
              <span className="my-3 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <span className="block h-full rounded-full bg-teal-400" style={{ width: `${roll.receivedLength > 0 ? Math.min(100, Math.max(0, roll.availableLength / roll.receivedLength * 100)) : 0}%` }} />
              </span>
              <span className="block text-xs leading-5 text-slate-600">
                {[roll.dyeLot && `${copy.dye}: ${roll.dyeLot}`, roll.shade && `${copy.shade}: ${roll.shade}`, roll.rackLocation].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </ProCard>
  );
}

type DisplayLine = {
  id: string; productName: string; rollNo: string;
  quantity: number; unit: "metre" | "yard"; unitPrice: number;
  saleMode: "retail_cut" | "wholesale_cut" | "full_roll"; priceSource: string;
};

export function textileMoney(amount: number): string {
  return `Rs. ${(Object.is(amount, -0) ? 0 : amount).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TextileAllocationCart({ lines, onRemove, unitLabel, modeLabel, priceLabel, copy, busy = false }: {
  lines: DisplayLine[];
  busy?: boolean;
  onRemove: (id: string) => void;
  unitLabel: (unit: "metre" | "yard") => string;
  modeLabel: (mode: DisplayLine["saleMode"]) => string;
  priceLabel: (source: string) => string;
  copy: { allocated: string; cart: string; noCuts: string; line: string; lines: string; remove: string; removeLabel: string };
}) {
  return (
    <ProCard title={copy.allocated} eyebrow={copy.cart} action={<ProBadge tone={lines.length ? "teal" : "slate"}>{lines.length} {lines.length === 1 ? copy.line : copy.lines}</ProBadge>}>
      {lines.length === 0 ? <p className="py-5 text-center text-sm text-slate-600">{copy.noCuts}</p> : (
        <ol className="divide-y divide-slate-100" data-ui="textile-allocation-cart">
          {lines.map((line, index) => (
            <li key={line.id} className="textile-allocation-row">
              <span className="textile-line-number" aria-hidden="true">{index + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-5 text-slate-950">{line.productName}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{line.rollNo}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{line.quantity.toFixed(3)} {unitLabel(line.unit)} × {textileMoney(line.unitPrice)}</p>
                <p className="text-xs leading-5 text-teal-700">{modeLabel(line.saleMode)} · {priceLabel(line.priceSource)}</p>
              </div>
              <div className="textile-line-actions">
                <span className="text-sm font-bold tabular-nums text-slate-950">{textileMoney(line.quantity * line.unitPrice)}</span>
                <button type="button" disabled={busy} aria-label={copy.removeLabel.replace("{fabric}", line.productName).replace("{roll}", line.rollNo)} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50" onClick={() => onRemove(line.id)}>{copy.remove}</button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ProCard>
  );
}

export function TextileBillSummary({ gross, discount, total, copy }: {
  gross: number; discount: number; total: number;
  copy: { subtotal: string; discount: string; amountDue: string };
}) {
  return (
    <div className="textile-bill-summary" data-ui="textile-bill-summary">
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt>{copy.subtotal}</dt><dd className="font-semibold tabular-nums">{textileMoney(gross)}</dd></div>
        <div className="flex justify-between gap-4"><dt>{copy.discount}</dt><dd className="font-semibold tabular-nums text-emerald-700">{textileMoney(-discount)}</dd></div>
        <div className="textile-bill-total"><dt>{copy.amountDue}</dt><dd className="font-bold tabular-nums">{textileMoney(total)}</dd></div>
      </dl>
    </div>
  );
}
