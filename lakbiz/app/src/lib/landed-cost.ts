export type LandedCostInput = {
  basis: "value" | "quantity";
  exchangeRate: number;
  charges: number[];
  recoverableVat: number;
  lines: { id: string; quantity: number; unitCost: number }[];
};
const zero = BigInt(0);
function scaled(value: number, scale: number, label: string): bigint {
  const result = Math.round(value * scale);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(result) || Math.abs(value * scale - result) > 0.00001) throw Error(`${label} has an invalid amount or precision.`);
  return BigInt(result);
}
function safe(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Shipment value exceeds the supported amount.");
  return Number(value);
}
export function purchaseLineMinor(quantity: number, unitCost: number): number {
  const units = scaled(quantity, 1000, "Quantity");
  if (units <= zero) throw Error("Received quantity must be greater than zero.");
  return safe((units * scaled(unitCost, 100, "Unit cost") + BigInt(500)) / BigInt(1000));
}
/** Integer minor units; stable largest remainders preserve every cent without negative residual lines. */
export function allocateLandedCost(input: LandedCostInput) {
  if (!["value", "quantity"].includes(input.basis) || input.lines.length < 1 || input.lines.length > 200 || new Set(input.lines.map(line => line.id)).size !== input.lines.length || input.lines.some(line => !line.id)) throw Error("Supply 1 to 200 distinct shipment lines and a valid allocation basis.");
  const fx = scaled(input.exchangeRate, 1000000, "Exchange rate");
  if (fx <= zero) throw Error("Exchange rate must be greater than zero.");
  const charges = input.charges.reduce((sum, value) => sum + scaled(value, 100, "Shipment charge"), zero);
  const vat = scaled(input.recoverableVat, 100, "Recoverable VAT");
  const divisor = BigInt(1000000000);
  const rows = input.lines.map(line => {
    const quantity = scaled(line.quantity, 1000, "Quantity");
    if (quantity <= zero) throw Error("Shipment quantities must be greater than zero.");
    const goods = (quantity * scaled(line.unitCost, 100, "Unit cost") * fx + divisor / BigInt(2)) / divisor;
    return { id: line.id, quantity, goods, weight: input.basis === "quantity" ? quantity : goods, share: zero, remainder: zero };
  });
  const weight = rows.reduce((sum, row) => sum + row.weight, zero);
  if (weight === zero && charges > zero) throw Error("Value allocation needs a nonzero goods value. Choose quantity allocation for free goods.");
  for (const row of rows) if (weight > zero) { row.share = charges * row.weight / weight; row.remainder = charges * row.weight % weight; }
  const residual = Number(charges - rows.reduce((sum, row) => sum + row.share, zero));
  const ranked = [...rows].sort((a, b) => a.remainder === b.remainder ? a.id < b.id ? -1 : a.id > b.id ? 1 : 0 : a.remainder > b.remainder ? -1 : 1);
  for (let index = 0; index < residual; index++) ranked[index].share++;
  const goods = rows.reduce((sum, row) => sum + row.goods, zero);
  return {
    goodsMinor: safe(goods), chargesMinor: safe(charges), vatMinor: safe(vat), inventoryMinor: safe(goods + charges), payableMinor: safe(goods + charges + vat),
    lines: rows.map(row => ({ id: row.id, goodsMinor: safe(row.goods), allocatedMinor: safe(row.share), landedMinor: safe(row.goods + row.share), landedUnit: safe(row.goods + row.share) * 10 / safe(row.quantity) })),
  };
}
