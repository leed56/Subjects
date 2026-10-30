import type { ProductInput } from "@/lib/store/types";
import { addProduct } from "@/lib/store/actions";
import { loadAppData, saveAppData } from "@/lib/store/storage";

export const DEMO_PHARMACY_PRODUCTS: ProductInput[] = [
  {
    name: "Amoxil Capsules 500mg (GSK)",
    category: "Antibiotics",
    sectorId: "pharmacy",
    condition: "new",
    unit: "capsule",
    buyPrice: 18.5,
    sellPrice: 24.0,
    stockQty: 300,
    reorderLevel: 50,
    active: true,
    sku: "MED-AMX-500",
    customFields: {
      genericName: "Amoxicillin",
      strength: "500mg",
      brand: "Amoxil",
      packSize: "10x10",
      unit: "capsule",
      requiresPrescription: true,
      shelf: "A-01",
    },
  },
  {
    name: "Augmentin 625mg Tablets",
    category: "Antibiotics",
    sectorId: "pharmacy",
    condition: "new",
    unit: "tablet",
    buyPrice: 120.0,
    sellPrice: 155.0,
    stockQty: 140,
    reorderLevel: 20,
    active: true,
    sku: "MED-AUG-625",
    customFields: {
      genericName: "Amoxicillin + Clavulanate",
      strength: "625mg",
      brand: "Augmentin",
      packSize: "2x7",
      unit: "tablet",
      requiresPrescription: true,
      shelf: "A-02",
    },
  },
  {
    name: "Panadol Regular Tablets 500mg",
    category: "Analgesics & Antipyretics",
    sectorId: "pharmacy",
    condition: "new",
    unit: "tablet",
    buyPrice: 3.5,
    sellPrice: 5.0,
    stockQty: 800,
    reorderLevel: 100,
    active: true,
    sku: "MED-PAN-500",
    customFields: {
      genericName: "Paracetamol",
      strength: "500mg",
      brand: "Panadol",
      packSize: "10 strips of 10",
      unit: "tablet",
      requiresPrescription: false,
      shelf: "B-01",
    },
  },
  {
    name: "Panadol Actifast 500mg",
    category: "Analgesics & Antipyretics",
    sectorId: "pharmacy",
    condition: "new",
    unit: "tablet",
    buyPrice: 6.5,
    sellPrice: 9.0,
    stockQty: 450,
    reorderLevel: 50,
    active: true,
    sku: "MED-ACT-500",
    customFields: {
      genericName: "Paracetamol",
      strength: "500mg",
      brand: "Panadol Actifast",
      packSize: "10 strips of 10",
      unit: "tablet",
      requiresPrescription: false,
      shelf: "B-02",
    },
  },
  {
    name: "Zyrtec 10mg Tablets",
    category: "Antihistamines",
    sectorId: "pharmacy",
    condition: "new",
    unit: "tablet",
    buyPrice: 35.0,
    sellPrice: 48.0,
    stockQty: 250,
    reorderLevel: 30,
    active: true,
    sku: "MED-ZYR-010",
    customFields: {
      genericName: "Cetirizine",
      strength: "10mg",
      brand: "Zyrtec",
      packSize: "10x10",
      unit: "tablet",
      requiresPrescription: false,
      shelf: "C-01",
    },
  },
  {
    name: "Omeprazole Capsules 20mg",
    category: "Gastrointestinal",
    sectorId: "pharmacy",
    condition: "new",
    unit: "capsule",
    buyPrice: 12.0,
    sellPrice: 17.5,
    stockQty: 400,
    reorderLevel: 60,
    active: true,
    sku: "MED-OMP-020",
    customFields: {
      genericName: "Omeprazole",
      strength: "20mg",
      brand: "Omez",
      packSize: "10x10",
      unit: "capsule",
      requiresPrescription: true,
      shelf: "C-03",
    },
  },
  {
    name: "Metformin 500mg Tablets",
    category: "Antidiabetic",
    sectorId: "pharmacy",
    condition: "new",
    unit: "tablet",
    buyPrice: 8.0,
    sellPrice: 11.5,
    stockQty: 600,
    reorderLevel: 100,
    active: true,
    sku: "MED-MET-500",
    customFields: {
      genericName: "Metformin",
      strength: "500mg",
      brand: "Glucophage",
      packSize: "10x10",
      unit: "tablet",
      requiresPrescription: true,
      shelf: "D-01",
    },
  },
  {
    name: "Ciprofloxacin 500mg Tablets",
    category: "Antibiotics",
    sectorId: "pharmacy",
    condition: "new",
    unit: "tablet",
    buyPrice: 22.0,
    sellPrice: 32.0,
    stockQty: 180,
    reorderLevel: 25,
    active: true,
    sku: "MED-CIP-500",
    customFields: {
      genericName: "Ciprofloxacin",
      strength: "500mg",
      brand: "Ciprobid",
      packSize: "10x10",
      unit: "tablet",
      requiresPrescription: true,
      shelf: "A-04",
    },
  },
];

export function seedPharmacyCatalog(orgId: string | null = null): void {
  if (typeof window === "undefined") return;
  let appData = loadAppData(orgId);
  // Filter out any partial or duplicate seed items
  appData = {
    ...appData,
    products: appData.products.filter((p) => !p.sku?.startsWith("MED-")),
  };
  for (const input of DEMO_PHARMACY_PRODUCTS) {
    appData = addProduct(appData, input);
  }
  saveAppData(appData, orgId);
  try {
    localStorage.setItem(
      "lakbiz-org-demo",
      JSON.stringify({
        id: orgId,
        sector: "pharmacy",
        name: "LakBiz Central Pharmacy",
        isAuthenticated: false,
        role: "owner",
      })
    );
  } catch {}
}

