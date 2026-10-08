"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, LayoutGrid, Package, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import styles from "./CategoryNavigation.module.css";

type NavCategory = { id: number; name: string; image?: string | null };

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
  const [bounds, setBounds] = useState({ top: 0, height: 0 });
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const focusFirstCategory = useRef(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCategory = pathname === "/products" ? searchParams?.get("category") : null;
  const route = `${pathname}?${searchParams?.toString() ?? ""}`;

  useEffect(() => {
    setOpen(false);
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
    if (open && focusFirstCategory.current) {
      (menu.current?.querySelector<HTMLAnchorElement>("[data-category-link]") ??
        menu.current?.querySelector<HTMLAnchorElement>("a"))?.focus({ preventScroll: true });
      focusFirstCategory.current = false;
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
          onClick={() => setOpen((isOpen) => !isOpen)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey && open)) {
              event.preventDefault();
              if (open) {
                menu.current?.querySelector<HTMLAnchorElement>("a")?.focus();
              } else {
                focusFirstCategory.current = true;
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
        <nav aria-label="Category strip" className={styles.strip}>
          <Link
            href="/products"
            aria-current={pathname === "/products" && !selectedCategory ? "page" : undefined}
            onNavigateComplete={() => setOpen(false)}
            className={styles.stripLink}
          >
            All products
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${encodeURIComponent(category.name)}`}
              onNavigateComplete={() => setOpen(false)}
              aria-current={selectedCategory === category.name ? "page" : undefined}
              className={styles.stripLink}
            >
              {category.name}
            </Link>
          ))}
        </nav>
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
            <div data-category-scroll className={styles.scrollArea}>
              <nav aria-label="All categories" className={styles.grid}>
                {categories.map((category) => (
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
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
