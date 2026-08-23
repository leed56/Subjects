"use client";

import { useEffect, useRef, useState } from "react";
import {
  searchProductReferenceCatalog,
  type ProductReferenceSuggestion,
} from "@/lib/supabase/product-reference-catalog";

export function ProductReferenceCombobox({
  value,
  onChange,
  onSelect,
  label,
  placeholder = "Start typing a product name…",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: ProductReferenceSuggestion) => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<ProductReferenceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (!query) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchProductReferenceCatalog(query, 12).then((rows) => {
        if (cancelled) return;
        setSuggestions(rows);
        setLoading(false);
        setOpen(true);
        setActiveIndex(rows.length ? 0 : -1);
      });
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value]);

  const choose = (suggestion: ProductReferenceSuggestion) => {
    onSelect(suggestion);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  return (
    <div ref={rootRef} className="relative sm:col-span-2">
      <label className="block">
        <span className="text-[13px] font-semibold text-slate-600">{label}</span>
        <div className="relative mt-1.5">
          <input
            required
            autoFocus={autoFocus}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="product-reference-listbox"
            value={value}
            onFocus={() => {
              if (value.trim()) setOpen(true);
            }}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (!open || suggestions.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(suggestions.length - 1, index + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
              } else if (event.key === "Enter" && activeIndex >= 0) {
                event.preventDefault();
                choose(suggestions[activeIndex]);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-24 text-sm text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.025)] outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-semibold text-slate-400">
            {loading ? "Searching…" : value.trim() ? "Suggestions" : "Type to search"}
          </span>
        </div>
      </label>

      {open && value.trim() && (
        <div
          id="product-reference-listbox"
          role="listbox"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_22px_60px_rgba(15,23,42,0.18)]"
        >
          {!loading && suggestions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500">
              No catalogue match. You can continue typing a new item name.
            </div>
          ) : (
            suggestions.map((suggestion, index) => {
              const meta = [
                suggestion.genericName,
                suggestion.strength,
                suggestion.packSize,
                suggestion.brand,
              ].filter(Boolean);
              return (
                <button
                  key={suggestion.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(suggestion)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                    index === activeIndex
                      ? "bg-teal-50 text-slate-950 ring-1 ring-inset ring-teal-100"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{suggestion.name}</p>
                      {meta.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">{meta.join(" · ")}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {suggestion.sku && (
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{suggestion.sku}</p>
                      )}
                      {suggestion.source && (
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-teal-700">{suggestion.source}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
