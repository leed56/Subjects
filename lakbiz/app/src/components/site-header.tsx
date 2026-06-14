import Link from "next/link";

const nav = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sectors", label: "Sectors" },
  { href: "/banking", label: "Banking" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-teal-800">LakBiz</span>
          <span className="hidden text-sm text-slate-500 sm:inline">
            ශ්‍රී ලංකා ව්‍යාපාර
          </span>
        </Link>
        <nav className="flex gap-4 text-sm font-medium text-slate-600">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-teal-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
