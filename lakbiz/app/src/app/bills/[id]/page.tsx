"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { InvoiceView } from "@/components/invoice-view";
import { useAppStore } from "@/lib/store/use-app-store";

export default function BillDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, ready } = useAppStore();

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">Loading...</main>
      </div>
    );
  }

  const sale = data.sales.find((s) => s.id === id);
  if (!sale) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-slate-600">Bill not found.</p>
          <Link href="/bills" className="mt-2 text-teal-700 underline">
            All bills
          </Link>
        </main>
      </div>
    );
  }

  const customer = sale.customerId
    ? data.customers.find((c) => c.id === sale.customerId)
    : undefined;

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link
          href="/bills"
          className="no-print text-sm text-teal-700 hover:underline"
        >
          ← All bills
        </Link>
        <div className="mt-4">
          <InvoiceView
            sale={sale}
            business={data.business}
            customerPhone={customer?.phone}
          />
        </div>
      </main>
    </div>
  );
}
