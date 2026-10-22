"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store/use-app-store";
import { formatLkr } from "@/lib/format";
import { SearchIcon, CloseIcon, StockIcon, CustomersIcon, BillsIcon } from "@/components/ui/icons";

type ResultGroup = "product" | "customer" | "sale";

type SearchResult = {
  group: ResultGroup;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const MAX_PER_GROUP = 5;

/**
 * App-wide search overlay — Cmd/Ctrl+K from any page, or the visible
 * trigger next to the sidebar bell. Searches SKU/product name, customers
 * (name/phone) and sales/bills (bill number/customer name) — all already
 * loaded client-side via useAppStore(), so there's no new network round
 * trip and no reason this should ever feel slow.
 *
 * Deliberately does not search batch/lot numbers: that data isn't loaded
 * at the shell level today (only the pharmacy dashboard fetches lots),
 * and adding a shell-wide lots fetch just to serve search felt like the
 * wrong tradeoff for this pass — flagged as a scoped-out follow-up.
 */
export function GlobalSearch() {
  const { data, ready } = useAppStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const results = useMemo((): SearchResult[] => {
    const trimmed = query.trim().toLowerCase();
    if (!ready || !data || trimmed.length < 2) return [];

    const products: SearchResult[] = data.products
      .filter((product) => product.active && (product.name.toLowerCase().includes(trimmed) || (product.sku ?? "").toLowerCase().includes(trimmed)))
      .slice(0, MAX_PER_GROUP)
      .map((product) => ({
        group: "product",
        id: product.id,
        title: product.name,
        subtitle: product.sku ? `SKU ${product.sku} · ${product.category}` : product.category,
        href: `/stock?q=${encodeURIComponent(product.name)}`,
      }));

    const customers: SearchResult[] = data.customers
      .filter((customer) => customer.name.toLowerCase().includes(trimmed) || (customer.phone ?? "").toLowerCase().includes(trimmed))
      .slice(0, MAX_PER_GROUP)
      .map((customer) => ({
        group: "customer",
        id: customer.id,
        title: customer.name,
        subtitle: customer.phone ?? "No phone on file",
        href: `/customers?q=${encodeURIComponent(customer.name)}`,
      }));

    const sales: SearchResult[] = data.sales
      .filter((sale) => (sale.billNo ?? "").toLowerCase().includes(trimmed) || (sale.customerName ?? "").toLowerCase().includes(trimmed))
      .slice(0, MAX_PER_GROUP)
      .map((sale) => ({
        group: "sale",
        id: sale.id,
        title: sale.billNo ? `Bill ${sale.billNo}` : "Sale",
        subtitle: `${formatLkr(sale.total)}${sale.customerName ? ` · ${sale.customerName}` : ""}`,
        href: `/bills/${sale.id}`,
      }));

    return [...products, ...customers, ...sales];
  }, [data, ready, query]);

  const groupLabel: Record<ResultGroup, string> = { product: "Products", customer: "Customers", sale: "Sales & bills" };
  const groupIcon: Record<ResultGroup, typeof StockIcon> = { product: StockIcon, customer: CustomersIcon, sale: BillsIcon };
  const grouped = (["product", "customer", "sale"] as ResultGroup[])
    .map((group) => ({ group, items: results.filter((r) => r.group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-left text-xs text-slate-500 transition hover:border-white/[0.14] hover:bg-white/[0.06]"
      >
        <SearchIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Search…</span>
        <kbd className="ml-auto shrink-0 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/50 px-4 pt-[12vh] backdrop-blur-sm" role="presentation">
          <div ref={containerRef} role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5">
              <SearchIcon className="h-4.5 w-4.5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, customers, sales…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400">Type at least 2 characters to search.</p>
              ) : grouped.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400">No matches for &ldquo;{query}&rdquo;.</p>
              ) : (
                grouped.map(({ group, items }) => {
                  const Icon = groupIcon[group];
                  return (
                    <div key={group} className="mb-2 last:mb-0">
                      <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{groupLabel[group]}</p>
                      {items.map((item) => (
                        <Link
                          key={`${item.group}:${item.id}`}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-slate-50"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                            <p className="truncate text-xs text-slate-400">{item.subtitle}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
