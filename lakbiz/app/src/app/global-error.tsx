"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="m-0 flex min-h-screen items-center justify-center bg-slate-100 p-4 font-sans text-slate-950">
        <main role="alert" className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-7 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-700">LakBiz recovery</p>
          <h1 className="mt-2 text-2xl font-bold">LakBiz could not open / LakBiz විවෘත කළ නොහැක</h1>
          <p className="mt-3 leading-6 text-slate-600">Retry once. Your saved business data is not deleted by this screen. / නැවත උත්සාහ කරන්න. මෙම තිරය ඔබගේ සුරැකි දත්ත මකන්නේ නැත.</p>
          <button type="button" onClick={reset} className="mt-6 min-h-11 rounded-xl bg-teal-600 px-5 font-bold text-white hover:bg-teal-700">Retry / නැවත උත්සාහ කරන්න</button>
        </main>
      </body>
    </html>
  );
}
