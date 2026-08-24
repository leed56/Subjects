import { Suspense, type ReactNode } from "react";

export default function ReceiveTrackedStockLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] bg-slate-50 px-6 py-10">
          <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-500">
            Loading receiving workspace…
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
