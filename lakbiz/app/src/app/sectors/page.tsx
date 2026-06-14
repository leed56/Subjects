import { SiteHeader } from "@/components/site-header";
import { SectorCard } from "@/components/sector-card";
import { sectors } from "@/lib/sectors";

export default function SectorsPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Business sectors</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          Enable one or more templates when you set up your business. Core
          stock, sales, and banking work the same — sectors add the right
          fields and reports.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((sector) => (
            <SectorCard key={sector.id} sector={sector} />
          ))}
        </div>
      </main>
    </div>
  );
}
