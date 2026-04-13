"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Search,
  Menu,
  X,
  Home,
  Package,
  MapPin,
  FileText,
  CircleHelp,
  CircleUser,
  User,
  Store,
} from "lucide-react";
import { CartSidebar } from "./CartSidebar";
import { LogoMark } from "@/components/user/LogoMark";

import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useSession, signOut } from "next-auth/react";
import type { LucideIcon } from "lucide-react";
import { sellOnWhatsappUrl } from "@/lib/whatsapp-sell";
import { formatPKR } from "@/lib/format";

type SearchSuggestion = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Highlight when pathname starts with this (e.g. /products for nested pages) */
  activePrefix?: string;
  /** Opens WhatsApp with a pre-filled message (uses site WhatsApp number). */
  whatsappSell?: boolean;
  /** Open link in a new browser tab (e.g. vendor registration). */
  openInNewTab?: boolean;
};

const nav: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/products", label: "All product", icon: Package },
  {
    href: "/vendor/register",
    label: "Sell Now",
    icon: Store,
    activePrefix: "/vendor",
    openInNewTab: true,
  },
  { href: "/track-order", label: "Track Order", icon: MapPin },
  { href: "/return-policy", label: "Return Policy", icon: FileText },
  { href: "/faq", label: "FAQ", icon: CircleHelp },
];

const utilityBarSepClass =
  "px-2.5 sm:px-3 text-[10px] sm:text-xs text-darkText/30 select-none tabular-nums";

function utilityLinkClass(active: boolean) {
  return [
    "text-xs sm:text-sm font-medium text-darkText/80 transition-colors hover:text-primaryBlue",
    "hover:underline hover:decoration-primaryBlue hover:underline-offset-4",
    active
      ? "font-semibold text-primaryBlue underline decoration-primaryBlue underline-offset-4"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Navbar({ whatsappNumber }: { whatsappNumber: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { totalQty } = useCart();
  const { openAuthModal, openProfileModal } = useCustomerAuth();
  const { data: session } = useSession();

  const urlSearchQuery = useMemo(() => {
    if (!pathname?.startsWith("/products")) return "";
    return (searchParams?.get("search") || "").trim();
  }, [pathname, searchParams]);

  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSearchQuery(urlSearchQuery);
  }, [urlSearchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const el = searchRef.current;
      if (el && event.target instanceof Node && !el.contains(event.target)) {
        setShowDropdown(false);
      }
      const menuEl = profileMenuRef.current;
      if (menuEl && event.target instanceof Node && !menuEl.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowDropdown(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showDropdown]);

  useEffect(() => {
    if (pathname?.startsWith("/track-order")) {
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }

    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestions([]);
      setLoading(true);
      setShowDropdown(true);
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(q)}&limit=6`,
          { signal: ac.signal }
        );
        const data = (await res.json()) as { products?: SearchSuggestion[] };
        if (ac.signal.aborted) return;
        setSuggestions(Array.isArray(data.products) ? data.products : []);
      } catch {
        if (!ac.signal.aborted) setSuggestions([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [searchQuery, pathname]);

  const isTrackOrderPage = pathname?.startsWith("/track-order");
  const isCheckoutPage = pathname === "/checkout";

  return (
    <>
      <header className="sticky top-8 z-40 shadow-sm">
        {/* ROW 1 — utility nav (Daraz-style thin bar; announcement bar stays above in UserRouteShell) */}
        <div className="border-b border-borderGray/80 bg-white">
          <div className="mx-auto flex w-full max-w-[min(100%,90rem)] flex-wrap items-center justify-end gap-x-0.5 gap-y-1.5 px-4 py-2 md:px-8">
            {nav.map((item, i) => {
              const { href, label, activePrefix, whatsappSell, openInNewTab } =
                item;
              const rowKey = whatsappSell ? "nav-sell-now" : href;
              const active =
                !whatsappSell &&
                !openInNewTab &&
                (pathname === href ||
                  (!!activePrefix && !!pathname?.startsWith(activePrefix)));
              return (
                <span key={rowKey} className="inline-flex items-center">
                  {i > 0 ? (
                    <span className={utilityBarSepClass} aria-hidden>
                      |
                    </span>
                  ) : null}
                  {whatsappSell ? (
                    <a
                      href={sellOnWhatsappUrl(whatsappNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={utilityLinkClass(false)}
                    >
                      {label}
                    </a>
                  ) : openInNewTab ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={utilityLinkClass(false)}
                    >
                      {label}
                    </a>
                  ) : (
                    <Link href={href} className={utilityLinkClass(active)}>
                      {label}
                    </Link>
                  )}
                </span>
              );
            })}

            {!session ? (
              <>
                <span className={utilityBarSepClass} aria-hidden>
                  |
                </span>
                <button
                  type="button"
                  onClick={() => openAuthModal("login")}
                  className="text-xs sm:text-sm font-medium text-darkText/80 transition-colors hover:text-primaryBlue hover:underline hover:decoration-primaryBlue hover:underline-offset-4"
                >
                  Log in
                </button>
                <span className={utilityBarSepClass} aria-hidden>
                  |
                </span>
                <button
                  type="button"
                  onClick={() => openAuthModal("signup")}
                  className="text-xs sm:text-sm font-bold uppercase tracking-wide text-primaryYellow transition-colors hover:text-primaryBlue hover:underline hover:decoration-primaryBlue hover:underline-offset-4"
                >
                  Sign up
                </button>
              </>
            ) : session.user?.role === "admin" ? (
              <>
                <span className={utilityBarSepClass} aria-hidden>
                  |
                </span>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-xs sm:text-sm font-medium text-darkText/80 transition-colors hover:text-primaryBlue hover:underline hover:decoration-primaryBlue hover:underline-offset-4"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <span className={utilityBarSepClass} aria-hidden>
                  |
                </span>
                <div className="relative" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((v) => !v)}
                    className="inline-flex max-w-[min(220px,48vw)] items-center gap-2 text-left text-xs sm:text-sm font-medium text-darkText/80 transition-colors hover:text-primaryBlue"
                  >
                    {session.user?.image ? (
                      <Image
                        src={session.user.image}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-primaryBlue/20"
                      />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primaryBlue text-white">
                        <User className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    )}
                    <span className="truncate font-semibold text-darkText hover:underline hover:decoration-primaryBlue hover:underline-offset-4">
                      {session.user?.name || "Profile"}
                    </span>
                  </button>
                  {profileMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[180px] rounded-xl border border-borderGray bg-white p-1.5 shadow-xl">
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-darkText transition-colors hover:bg-lightGray"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          openProfileModal();
                        }}
                      >
                        Profile
                      </button>
                      <Link
                        href="/track-order"
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-darkText transition-colors hover:bg-lightGray"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        Orders
                      </Link>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          void signOut({ callbackUrl: "/" });
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ROW 2 — Track Order: banner. Checkout: no logo/search/cart; mobile menu only. Else: logo + search + cart. */}
        {isTrackOrderPage ? (
          <div className="relative border-b border-borderGray bg-neutral-100">
            <button
              type="button"
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/90 bg-white/95 p-2 text-primaryBlue shadow-md md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Image
              src="/track-order-banner.png"
              alt="Track and trace your order with ease"
              width={1920}
              height={480}
              className="h-auto w-full object-cover object-center max-h-[200px] sm:max-h-[260px] md:max-h-[320px]"
              priority
            />
          </div>
        ) : isCheckoutPage ? (
          <div className="border-b border-borderGray bg-white md:hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                className="shrink-0 rounded-full border border-primaryBlue/40 p-2 text-primaryBlue"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-sm font-semibold text-darkText">
                Checkout
              </span>
            </div>
          </div>
        ) : (
          <div className="border-b border-borderGray bg-white">
            <div className="flex w-full justify-center px-4 py-3 md:px-5">
              <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4">
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-primaryBlue/40 p-2 text-primaryBlue md:hidden"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <LogoMark href="/" className="shrink-0" />
                </div>

                <div
                  ref={searchRef}
                  className="relative z-50 min-w-0 w-[min(92vw,42rem)] max-w-2xl shrink-0"
                >
                  <form
                    action="/products"
                    method="get"
                    className="flex min-w-0 w-full items-stretch"
                    role="search"
                    onSubmit={() => {
                      setShowDropdown(false);
                    }}
                  >
                    <div className="flex min-w-0 w-full overflow-hidden rounded-md border border-borderGray bg-white shadow-sm focus-within:border-[#EAB308] focus-within:ring-2 focus-within:ring-[#EAB308]/25">
                      <input
                        type="search"
                        name="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => {
                          if (searchQuery.trim().length >= 2) setShowDropdown(true);
                        }}
                        placeholder="Search products…"
                        autoComplete="off"
                        className="min-h-[44px] w-full min-w-0 flex-1 border-0 bg-transparent px-4 py-2 text-sm text-darkText outline-none placeholder:text-darkText/45 focus:outline-none focus:ring-0"
                      />
                      <button
                        type="submit"
                        className="shrink-0 border-l border-yellow-600/25 bg-[#EAB308] px-4 text-black transition-colors hover:bg-yellow-600"
                        aria-label="Search"
                      >
                        <Search className="h-5 w-5 text-black" aria-hidden />
                      </button>
                    </div>
                  </form>

                  {showDropdown && searchQuery.trim().length >= 2 ? (
                    <div
                      className="animate-search-suggest-in absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[min(24rem,70vh)] overflow-y-auto rounded-xl border border-borderGray bg-white shadow-xl"
                      aria-label="Search suggestions"
                    >
                      {loading ? (
                        <p className="border-b border-borderGray p-3 text-sm text-darkText/50">
                          Searching…
                        </p>
                      ) : null}

                      {!loading && suggestions.length === 0 ? (
                        <p className="border-b border-borderGray p-3 text-sm text-darkText/60">
                          No products found.
                        </p>
                      ) : null}

                      {suggestions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            router.push(`/products/${product.id}`);
                            setShowDropdown(false);
                            setSearchQuery("");
                          }}
                          className="flex w-full cursor-pointer items-center gap-3 border-b border-borderGray p-3 text-left last:border-b-0 hover:bg-lightGray/60 motion-reduce:transition-none"
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-lightGray">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package
                                className="absolute inset-0 m-auto h-6 w-6 text-darkText/25"
                                aria-hidden
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-darkText">
                              {product.name}
                            </p>
                            <p className="truncate text-xs text-darkText/55">
                              {product.category}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-primaryBlue">
                            {formatPKR(product.price)}
                          </p>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const q = searchQuery.trim();
                          router.push(
                            `/products?search=${encodeURIComponent(q)}`
                          );
                          setShowDropdown(false);
                        }}
                        className="w-full cursor-pointer border-t border-borderGray p-3 text-center text-sm font-semibold text-primaryBlue transition-colors hover:bg-lightGray/60"
                      >
                        View all results for &quot;{searchQuery.trim()}&quot;
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    className="relative inline-flex items-center justify-center rounded-lg p-1.5 text-primaryBlue transition-colors hover:bg-primaryBlue/5"
                    aria-label="Open cart"
                  >
                    <ShoppingCart className="h-7 w-7" aria-hidden />
                    {totalQty > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primaryBlue px-1 text-[10px] font-bold text-white tabular-nums">
                        {totalQty > 99 ? "99+" : totalQty}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-primaryBlue text-white md:hidden">
          <div className="flex items-center justify-between border-b border-white/20 p-4">
            <span className="text-xl font-bold">Menu</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-full p-2 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-col gap-6 p-6 text-base font-medium">
            {nav.map(
              ({
                href,
                label,
                icon: Icon,
                activePrefix,
                whatsappSell,
                openInNewTab,
              }) => {
                const rowKey = whatsappSell ? "nav-sell-now" : href;
                const active =
                  !whatsappSell &&
                  !openInNewTab &&
                  (pathname === href ||
                    (!!activePrefix &&
                      (pathname?.startsWith(activePrefix) ?? false)));
                const itemClass = `flex items-center gap-3 ${active ? "font-semibold underline decoration-white underline-offset-4" : ""}`;
                if (whatsappSell) {
                  return (
                    <a
                      key={rowKey}
                      href={sellOnWhatsappUrl(whatsappNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={itemClass}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon className="h-6 w-6" />
                      {label}
                    </a>
                  );
                }
                if (openInNewTab) {
                  return (
                    <a
                      key={rowKey}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={itemClass}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon className="h-6 w-6" />
                      {label}
                    </a>
                  );
                }
                return (
                  <Link
                    key={rowKey}
                    href={href}
                    className={itemClass}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="h-6 w-6" />
                    {label}
                  </Link>
                );
              }
            )}
            {!isCheckoutPage ? (
              <button
                type="button"
                className="flex items-center gap-3 text-left"
                onClick={() => {
                  setMobileOpen(false);
                  setCartOpen(true);
                }}
              >
                <ShoppingCart className="h-6 w-6" />
                Cart {totalQty > 0 ? `(${totalQty})` : ""}
              </button>
            ) : null}
            <a
              href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3"
              onClick={() => setMobileOpen(false)}
            >
              WhatsApp
            </a>
            {!session ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => {
                    setMobileOpen(false);
                    openAuthModal("login");
                  }}
                >
                  <User className="h-6 w-6" />
                  Log in
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left font-bold uppercase tracking-wide"
                  onClick={() => {
                    setMobileOpen(false);
                    openAuthModal("signup");
                  }}
                >
                  Sign up
                </button>
              </>
            ) : session.user?.role === "admin" ? (
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left"
                onClick={() => {
                  setMobileOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
              >
                Logout
              </button>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left"
                onClick={() => {
                  setMobileOpen(false);
                  openProfileModal();
                }}
              >
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <CircleUser className="h-6 w-6" />
                )}
                Profile ({session.user?.name || "Account"})
              </button>
            )}
          </nav>
        </div>
      ) : null}

      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
