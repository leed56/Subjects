import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { sectors } from "@/lib/sectors";
import type { SectorId } from "@/lib/types";

const fieldLabels: Partial<Record<SectorId, Record<string, string>>> = {
  ac_hvac: {
    brand: "Brand (Daikin, LG, Gree…)",
    btu: "Capacity (BTU)",
    hp: "Horsepower",
    unitType: "Wall / Cassette / Ducted / VRV",
    indoorSerial: "Indoor unit serial",
    outdoorSerial: "Outdoor unit serial",
    compressorWarrantyMonths: "Compressor warranty (months)",
  },
  car_sales: {
    chassisNo: "Chassis number",
    engineNo: "Engine number",
    regNo: "Registration number",
    mileageKm: "Mileage (km)",
    reconditionCost: "Recondition cost (LKR)",
    financePartner: "Leasing bank (Sampath, LOLC…)",
  },
};

export function generateStaticParams() {
  return sectors.map((s) => ({ id: s.id }));
}

export default async function SectorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sector = sectors.find((s) => s.id === id);
  if (!sector) notFound();

  const labels = fieldLabels[sector.id as SectorId] ?? {};

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/sectors" className="text-sm text-teal-700 hover:underline">
          ← All sectors
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-4xl">{sector.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {sector.nameEn}
            </h1>
            <p className="text-slate-500">{sector.nameSi}</p>
          </div>
        </div>
        <p className="mt-4 text-slate-600">{sector.description}</p>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Extra fields</h2>
          <ul className="mt-3 space-y-2">
            {sector.extraFields.map((field) => (
              <li
                key={field}
                className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0"
              >
                <code className="text-slate-700">{field}</code>
                <span className="text-slate-500">
                  {labels[field] ?? field.replace(/([A-Z])/g, " $1")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Reports</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {sector.reports.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
