export type VehicleStatus =
  | "incoming"
  | "reconditioning"
  | "for_sale"
  | "sold";

export const VEHICLE_STATUSES: {
  value: VehicleStatus;
  labelEn: string;
}[] = [
  { value: "incoming", labelEn: "Incoming" },
  { value: "reconditioning", labelEn: "Reconditioning" },
  { value: "for_sale", labelEn: "For sale" },
  { value: "sold", labelEn: "Sold" },
];

export const CAR_MAKES = [
  "Toyota",
  "Suzuki",
  "Honda",
  "Nissan",
  "Mitsubishi",
  "Mercedes",
  "BMW",
  "Audi",
  "Other",
];

export const FINANCE_PARTNERS = [
  "Sampath Bank",
  "People's Leasing",
  "LOLC Finance",
  "Commercial Leasing",
  "NDB Bank",
  "Cash only",
  "Other",
];

export function generateVehicleStockId(count: number): string {
  const year = new Date().getFullYear();
  return `V-${year}-${String(count + 1).padStart(4, "0")}`;
}

export function daysInStock(dateAdded: string): number {
  const added = new Date(dateAdded);
  const today = new Date();
  added.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(
    0,
    Math.ceil((today.getTime() - added.getTime()) / 86400000),
  );
}

export function vehicleTotalCost(
  purchasePrice: number,
  reconditionCost: number,
): number {
  return purchasePrice + reconditionCost;
}

export function agingLabel(days: number): string | null {
  if (days >= 90) return "90+ days";
  if (days >= 60) return "60+ days";
  if (days >= 30) return "30+ days";
  return null;
}
