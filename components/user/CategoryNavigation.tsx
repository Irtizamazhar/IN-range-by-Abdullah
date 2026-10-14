"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gift,
  House,
  LayoutGrid,
  Package,
  ShoppingBag,
  Search,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import styles from "./CategoryNavigation.module.css";

type NavCategory = { id: number; name: string; image?: string | null };

const NAV_ITEMS = [
  { label: "Shop Products", href: "/products", Icon: ShoppingBag },
  { label: "Services", href: "/services", Icon: Wrench },
  { label: "Gifts", href: "/gifts", Icon: Gift },
  { label: "MyHome", href: "/myhome", Icon: House },
  { label: "Wants", href: "/wants", Icon: UsersRound },
  { label: "Deals", href: "/deals", Icon: Flame },
] as const;

export function useNavCategories() {
  return useQuery<NavCategory[]>({
    queryKey: ["nav-categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Categories unavailable");
      return response.json();
    },
    staleTime: 60000,
  });
}

function CategoryImage({ category }: { category: NavCategory }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = category.image?.trim();

  return (
    <span data-category-image className={styles.image} aria-hidden="true">
      {src && src !== failedSrc ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="48px"
          unoptimized={shouldUnoptimizeImageSrc(src)}
          className="object-contain p-1"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Package className="h-6 w-6" strokeWidth={1.6} />
      )}
    </span>
  );
}

export function CategoryNavigation() {
  const { data: categories = [], isLoading, isError } = useNavCategories();
  const [open, setOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [bounds, setBounds] = useState({ top: 0, height: 0 });
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLElement>(null);
  const strip = useRef<HTMLElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });
  const focusSearch = useRef(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCategory = pathname === "/products" ? searchParams?.get("category") : null;
  const visibleCategories = categories.filter(category => category.name.toLocaleLowerCase().includes(categorySearch.trim().toLocaleLowerCase()));
  const route = `${pathname}?${searchParams?.toString() ?? ""}`;

  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const update = () => {
      const left = element.scrollLeft > 2;
      const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
      setScrollEdges(previous => previous.left === left && previous.right === right ? previous : { left, right });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, []);

  useEffect(() => {
    const element = strip.current;
    const active = element?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!element || !active) return;
    element.scrollLeft += active.getBoundingClientRect().left - element.getBoundingClientRect().left - (element.clientWidth - active.clientWidth) / 2;
  }, [pathname]);

  function scrollSections(direction: -1 | 1) {
    strip.current?.scrollBy({ left: direction * Math.max(120, strip.current.clientWidth * 0.75), behavior: "smooth" });
  }

  useEffect(() => {
    setOpen(false);
    setCategorySearch("");
  }, [route]);

  // Measure the real navigation edge, including wrapped mobile header rows.
  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      const top = Math.max(0, root.current?.getBoundingClientRect().bottom ?? 0);
      const viewport = window.visualViewport;
      const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
      setBounds({ top, height: Math.max(0, bottom - top) });
    };

    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbarWidth}px`;
    }
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    measure();

    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    const header = root.current?.closest("header");
    if (header) observer.observe(header);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.paddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const outside = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !root.current?.contains(target) && !menu.current?.contains(target)) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    if (open && focusSearch.current) {
      searchInput.current?.focus({ preventScroll: true });
      focusSearch.current = false;
    }
  }, [open]);

  function closeAndFocus() {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  }

  return (
    <div ref={root} className={styles.navigation}>
      <div className={styles.navigationInner}>
        <LoadingButton
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls="category-dropdown"
          onClick={() => { if (!open) setCategorySearch(""); setOpen(!open); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey && open)) {
              event.preventDefault();
              if (open) {
                searchInput.current?.focus();
              } else {
                focusSearch.current = true;
                setOpen(true);
              }
            }
          }}
          className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        >
          <LayoutGrid aria-hidden="true" className="h-4 w-4" />
          Categories
          <ChevronDown aria-hidden="true" className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
        </LoadingButton>
        <div className={styles.stripWrap}>
        <nav ref={strip} aria-label="JORO marketplace sections" className={styles.strip}>
          {NAV_ITEMS.map(({ label, href, Icon }) => {
            const active =
              href === "/products"
                ? pathname === "/products" || pathname?.startsWith("/products/")
                : href === "/wants"
                  ? pathname === "/wants" || pathname?.startsWith("/wants/")
                  : href !== null && pathname === href;

            const contents = (
              <>
                <Icon aria-hidden="true" className={styles.stripIcon} strokeWidth={1.9} />
                <span>{label}</span>
              </>
            );

            return href ? (
              <Link
                key={label}
                href={href}
                onNavigateComplete={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={styles.stripLink}
              >
                {contents}
              </Link>
            ) : (
              <span
                key={label}
                className={`${styles.stripLink} ${styles.plannedLink}`}
                title={`${label} — coming soon`}
                aria-label={`${label}, coming soon`}
              >
                {contents}
                <span className={styles.soonDot} aria-hidden="true" />
              </span>
            );
          })}
        </nav>
        {scrollEdges.left && <button type="button" aria-label="Scroll sections left" onClick={() => scrollSections(-1)} className={`${styles.scrollControl} ${styles.scrollLeft}`}><ChevronLeft aria-hidden="true" /></button>}
        {scrollEdges.right && <button type="button" aria-label="Scroll sections right" onClick={() => scrollSections(1)} className={`${styles.scrollControl} ${styles.scrollRight}`}><ChevronRight aria-hidden="true" /></button>}
        </div>
      </div>

      {open && createPortal(
        <div className={styles.overlay} style={{ top: bounds.top, height: bounds.height }}>
          <div
            data-category-backdrop
            className={styles.backdrop}
            aria-hidden="true"
            onPointerDown={(event) => {
              event.preventDefault();
              closeAndFocus();
            }}
          />
          <section
            ref={menu}
            id="category-dropdown"
            aria-labelledby="category-menu-heading"
            className={styles.panel}
            style={{ maxHeight: bounds.height }}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const controls = menu.current?.querySelectorAll<HTMLElement>("a, button");
              if (!controls?.length) return;
              // Preserve the disclosure's tab order even though the panel is portaled.
              if (event.shiftKey && document.activeElement === controls[0]) {
                event.preventDefault();
                button.current?.focus({ preventScroll: true });
              } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
                event.preventDefault();
                setOpen(false);
                (root.current?.querySelector<HTMLAnchorElement>("nav a") ?? button.current)?.focus({ preventScroll: true });
              }
            }}
          >
            <div className={styles.heading}>
              <div className={styles.titleGroup}>
                <h2 id="category-menu-heading">Shop by Category</h2>
                {!isLoading && !isError && categories.length > 0 && (
                  <span className={styles.count}>{categories.length}</span>
                )}
              </div>
              <Link href="/products" onNavigateComplete={() => setOpen(false)} className={styles.allProducts}>
                All Products <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
              <LoadingButton type="button" aria-label="Close categories" onClick={closeAndFocus} className={styles.close}>
                <X aria-hidden="true" className="h-5 w-5" />
              </LoadingButton>
            </div>
            <div className={styles.searchRow}>
              <Search aria-hidden="true" className={styles.searchIcon} />
              <input ref={searchInput} type="search" value={categorySearch} onChange={event => setCategorySearch(event.target.value)} placeholder="Find a category" aria-label="Find a product category" className={styles.searchInput} />
            </div>
            <div data-category-scroll className={styles.scrollArea}>
              <nav aria-label="All categories" className={styles.grid}>
                {visibleCategories.map((category) => (
                  <Link
                    key={category.id}
                    data-category-link
                    onNavigateComplete={() => setOpen(false)}
                    href={`/products?category=${encodeURIComponent(category.name)}`}
                    aria-current={selectedCategory === category.name ? "page" : undefined}
                    className={styles.categoryLink}
                  >
                    <CategoryImage category={category} />
                    <span className={styles.name}>{category.name}</span>
                    <ArrowRight aria-hidden="true" className={styles.cardArrow} />
                  </Link>
                ))}
              </nav>
              {isLoading && <p role="status" className={styles.status}>Loading categories…</p>}
              {isError && <p role="status" className={styles.status}>Categories are temporarily unavailable. Browse all products.</p>}
              {!isLoading && !isError && !categories.length && <p className={styles.status}>Browse all products while categories are being added.</p>}
              {!isLoading && !isError && categories.length > 0 && !visibleCategories.length && <p role="status" className={styles.status}>No matching categories.</p>}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
