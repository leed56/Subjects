export type InventoryTransferStatus =
  | "draft"
  | "dispatched"
  | "in_transit"
  | "received"
  | "cancelled";

export type InventoryTransferLineInput = {
  productId: string;
  variantId?: string | null;
  lotId?: string | null;
  unitId?: string | null;
  qty: number;
};

const transitions: Record<InventoryTransferStatus, InventoryTransferStatus[]> = {
  draft: ["dispatched", "cancelled"],
  dispatched: ["in_transit"],
  in_transit: ["received"],
  received: [],
  cancelled: [],
};

export function canTransitionInventoryTransfer(
  from: InventoryTransferStatus,
  to: InventoryTransferStatus,
): boolean {
  return transitions[from].includes(to);
}

export function validateInventoryTransfer(input: {
  fromLocationId: string;
  toLocationId: string;
  lines: InventoryTransferLineInput[];
}): string | null {
  if (!input.fromLocationId || !input.toLocationId) return "Origin and destination are required.";
  if (input.fromLocationId === input.toLocationId) return "Origin and destination must be different.";
  if (input.lines.length === 0) return "Add at least one stock line.";

  const identities = new Set<string>();
  for (const line of input.lines) {
    if (!line.productId) return "Every line requires a product.";
    if (!Number.isFinite(line.qty) || line.qty <= 0) return "Every quantity must be greater than zero.";
    if (line.unitId && line.qty !== 1) return "A serialized unit must move with quantity one.";
    const identity = [line.productId, line.variantId ?? "", line.lotId ?? "", line.unitId ?? ""].join(":");
    if (identities.has(identity)) return "Combine duplicate stock identities into one line.";
    identities.add(identity);
  }
  return null;
}

export function transferProgress(status: InventoryTransferStatus): number {
  if (status === "draft" || status === "cancelled") return 0;
  if (status === "dispatched") return 34;
  if (status === "in_transit") return 67;
  return 100;
}
