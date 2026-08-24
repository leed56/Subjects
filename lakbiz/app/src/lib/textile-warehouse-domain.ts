export type DispatchStatus = "draft" | "picking" | "packed" | "dispatched" | "delivered" | "cancelled";

const allowed: Record<DispatchStatus, DispatchStatus[]> = {
  draft: ["picking", "cancelled"], picking: ["packed", "cancelled"], packed: ["dispatched", "cancelled"],
  dispatched: ["delivered"], delivered: [], cancelled: [],
};

export function canTransitionDispatch(from: DispatchStatus, to: DispatchStatus): boolean {
  return allowed[from].includes(to);
}

export function validatePartialFulfilment(sold: number, alreadyAssigned: number, requested: number): string | null {
  if (!Number.isFinite(requested) || requested <= 0) return "Dispatch quantity must be greater than zero.";
  if (alreadyAssigned + requested > sold + 0.0005) return "Dispatch quantity exceeds the unfulfilled sold quantity.";
  return null;
}

export function dispatchProgress(items: Array<{ quantity: number; pickedQuantity: number; packedQuantity: number }>) {
  return items.reduce((sum, item) => ({ ordered: sum.ordered + item.quantity, picked: sum.picked + item.pickedQuantity, packed: sum.packed + item.packedQuantity }), { ordered: 0, picked: 0, packed: 0 });
}
