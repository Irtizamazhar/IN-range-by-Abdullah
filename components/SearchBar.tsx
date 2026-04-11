"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Package, Search } from "lucide-react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "", label: "All Categories" },
  { value: "Electronics", label: "Electronics" },
  { value: "Fashion", label: "Fashion" },
  { value: "Home & Living", label: "Home & Living" },
  { value: "Sports", label: "Sports" },
  { value: "Beauty", label: "Beauty" },
  { value: "Books", label: "Books" },
  { value: "Toys", label: "Toys" },
  { value: "Groceries", label: "Groceries" },
  { value: "Automotive", label: "Automotive" },
];

const POPULAR_SEARCHES = ["Headphones", "Smart Watch", "Running Shoes"];

/** Seeds used to fake type-ahead matches (Daraz-style demo list). */
const SUGGESTION_SEEDS = [
  "nike shoes",
  "nike air max",
  "nike socks",
  "nike running",
  "samsung phone",
  "iphone case",
  "bluetooth headphones",
  "wireless earbuds",
  "smart watch",
  "running shoes",
  "laptop bag",
  "usb cable",
  "power bank",
  "kitchen scale",
  "face cream",
  "makeup kit",
  "fiction books",
  "kids toys",
  "rice 5kg",
  "car phone holder",
];

function buildProductsHref(search: string, category: string) {
  const p = new URLSearchParams();
  const q = search.trim();
  if (q) p.set("search", q);
  if (category) p.set("category", category);
  const qs = p.toString();
  return qs ? `/products?${qs}` : "/products";
}

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlSearch = useMemo(() => {
    if (!pathname?.startsWith("/products")) return "";
    return (searchParams?.get("search") || "").trim();
  }, [pathname, searchParams]);

  const urlCategory = useMemo(() => {
    if (!pathname?.startsWith("/products")) return "";
    return (searchParams?.get("category") || "").trim();
  }, [pathname, searchParams]);

  const [query, setQuery] = useState(urlSearch);
  const [category, setCategory] = useState(urlCategory);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [containerFocused, setContainerFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    setCategory(urlCategory);
  }, [urlCategory]);

  const filteredSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SUGGESTION_SEEDS.filter((s) => s.toLowerCase().includes(q)).slice(
      0,
      6
    );
  }, [query]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const el = containerRef.current;
      if (!el) return;
      const target = e.target as Node;
      if (!el.contains(target)) {
        setSuggestionsOpen(false);
        setContainerFocused(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  function navigateSearch() {
    router.push(buildProductsHref(query, category));
    setSuggestionsOpen(false);
  }

  function handleInputChange(v: string) {
    setQuery(v);
    setSuggestionsOpen(v.trim().length > 0);
  }

  function handleSuggestionPick(text: string) {
    setQuery(text);
    setSuggestionsOpen(false);
    router.push(buildProductsHref(text, category));
  }

  const showDropdown = suggestionsOpen && query.trim().length > 0;

  const borderFocused = containerFocused || showDropdown;

  return (
    <div ref={containerRef} className="relative z-[1000] w-full md:w-[420px] lg:w-[600px]">
      <div
        className="flex h-10 w-full overflow-hidden rounded-[4px] transition-[border-color] duration-150"
        style={{
          borderWidth: "1.5px",
          borderStyle: "solid",
          borderColor: borderFocused ? "#F57224" : "#e0e0e0",
        }}
      >
        {/* Category — desktop only (1024px+) */}
        <div className="relative hidden shrink-0 lg:block" style={{ width: 110 }}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full cursor-pointer appearance-none border-0 border-r pl-2.5 pr-8 text-[13px] font-medium outline-none"
            style={{
              backgroundColor: "#f5f5f5",
              borderRight: "1px solid #e0e0e0",
              color: "#333",
              borderRadius: "4px 0 0 0",
            }}
            aria-label="Category"
          >
            {CATEGORIES.map((c) => (
              <option key={c.label} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]"
            aria-hidden
          />
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            setContainerFocused(true);
            if (query.trim().length > 0) setSuggestionsOpen(true);
          }}
          onBlur={() => {
            setContainerFocused(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              navigateSearch();
            }
          }}
          placeholder="Search products..."
          autoComplete="off"
          className="h-10 min-w-0 flex-1 border-0 bg-white px-4 text-sm font-normal text-[#333] outline-none placeholder:text-[#999999]"
        />

        <button
          type="button"
          onClick={navigateSearch}
          className="hidden h-10 shrink-0 items-center justify-center border-0 text-sm font-semibold text-white transition-colors md:flex"
          style={{
            width: 80,
            backgroundColor: "#F57224",
            borderRadius: "0 4px 4px 0",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#e5621a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#F57224";
          }}
        >
          SEARCH
        </button>

        {/* Mobile: icon-only search button */}
        <button
          type="button"
          onClick={navigateSearch}
          className="flex h-10 w-10 shrink-0 items-center justify-center border-0 text-white transition-colors md:hidden"
          style={{
            backgroundColor: "#F57224",
            borderRadius: "0 4px 4px 0",
          }}
          aria-label="Search"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#e5621a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#F57224";
          }}
        >
          <Search className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {showDropdown ? (
        <div
          className="absolute left-0 max-h-[400px] w-full overflow-y-auto rounded-b border border-t-0 bg-white shadow-md"
          style={{
            top: 44,
            borderColor: "#e0e0e0",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 1000,
          }}
        >
          {filteredSuggestions.map((text) => (
            <button
              key={text}
              type="button"
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-normal transition-colors"
              style={{ color: "#333" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionPick(text)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#fff8f4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
              }}
            >
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "#999" }} />
              {text}
            </button>
          ))}

          <div
            className="border-t px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.5px]"
            style={{ borderColor: "#f0f0f0", color: "#999" }}
          >
            <span className="flex items-center gap-2.5">
              <Package className="h-3.5 w-3.5" style={{ color: "#999" }} />
              Popular Searches
            </span>
          </div>
          {POPULAR_SEARCHES.map((text) => (
            <button
              key={text}
              type="button"
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 pl-10 text-left text-sm font-normal transition-colors"
              style={{ color: "#333" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionPick(text)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#fff8f4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
              }}
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
