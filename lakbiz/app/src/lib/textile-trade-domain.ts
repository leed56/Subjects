export type LandedCostInput = { supplierValue: number; weightKg: number; quantity: number };
export type LandedCharges = { freight: number; duty: number; insurance: number; port: number; handling: number };

export function allocateTextileLandedCosts(lines: LandedCostInput[], charges: LandedCharges): number[] {
  const totalValue = lines.reduce((sum, line) => sum + line.supplierValue, 0);
  const totalWeight = lines.reduce((sum, line) => sum + line.weightKg, 0);
  const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);
  return lines.map((line) => {
    const valueShare = totalValue > 0 ? line.supplierValue / totalValue : 0;
    const weightShare = totalWeight > 0 ? line.weightKg / totalWeight : totalQty > 0 ? line.quantity / totalQty : 0;
    const qtyShare = totalQty > 0 ? line.quantity / totalQty : 0;
    return Math.round(((charges.duty + charges.insurance) * valueShare + charges.freight * weightShare + (charges.port + charges.handling) * qtyShare) * 100) / 100;
  });
}

export function receivableAgeBucket(dueDate: string, today: string): "current" | "1-30" | "31-60" | "61-90" | "90+" {
  const days = Math.floor((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${dueDate}T00:00:00Z`).getTime()) / 86_400_000);
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function commissionAmount(base: number, ratePercent: number): number {
  if (base < 0 || ratePercent < 0 || ratePercent > 100) throw new Error("Invalid commission base or rate");
  return Math.round(base * ratePercent) / 100;
}
