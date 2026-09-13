"use client";

import Image from "next/image";
import { MarketplaceNav } from "./MarketplaceNav";
import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  Heart,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Store,
  User,
  X,
} from "lucide-react";
import {
  signOut,
  useSession,
} from "next-auth/react";

import { CartSidebar } from "./CartSidebar";
import { LogoMark } from "./LogoMark";

import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

import { formatPKR } from "@/lib/format";

/* =========================================================
   TYPES
========================================================= */

type SearchSuggestion = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string | null;
};

/* =========================================================
   SECOND NAV CATEGORIES
========================================================= */

const navCategories = [
  "Mobiles",
  "Computers",
  "Fashion",
  "Home & Living",
  "Beauty",
  "Groceries",
  "Sports",
  "Automotive",
];

/* =========================================================
   NAVBAR
========================================================= */

export function Navbar({
  whatsappNumber,
}: {
  whatsappNumber: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchRef =
    useRef<HTMLDivElement | null>(null);

  const profileRef =
    useRef<HTMLDivElement | null>(null);

  /* =======================================================
     STATE
  ======================================================= */

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    cartOpen,
    setCartOpen,
  ] = useState(false);

  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    suggestions,
    setSuggestions,
  ] = useState<SearchSuggestion[]>([]);

  const [
    showDropdown,
    setShowDropdown,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  /* =======================================================
     CONTEXT
  ======================================================= */

  const { totalQty } = useCart();

  const {
    openAuthModal,
    openProfileModal,
  } = useCustomerAuth();

  const { data: session } =
    useSession();

  /* =======================================================
     CURRENT SEARCH QUERY
  ======================================================= */

  const urlSearchQuery =
    useMemo(() => {
      if (
        !pathname?.startsWith(
          "/products"
        )
      ) {
        return "";
      }

      return (
        searchParams?.get(
          "search"
        ) || ""
      ).trim();
    }, [
      pathname,
      searchParams,
    ]);

  useEffect(() => {
    setSearchQuery(
      urlSearchQuery
    );
  }, [urlSearchQuery]);

  /* =======================================================
     CLOSE DROPDOWNS ON OUTSIDE CLICK
  ======================================================= */

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        searchRef.current &&
        event.target instanceof
          Node &&
        !searchRef.current.contains(
          event.target
        )
      ) {
        setShowDropdown(false);
      }

      if (
        profileRef.current &&
        event.target instanceof
          Node &&
        !profileRef.current.contains(
          event.target
        )
      ) {
        setProfileOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  /* =======================================================
     ESC KEY
  ======================================================= */

  useEffect(() => {
    function handleEscape(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape"
      ) {
        setShowDropdown(false);
        setProfileOpen(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  /* =======================================================
     LIVE PRODUCT SEARCH
  ======================================================= */

  useEffect(() => {
    const query =
      searchQuery.trim();

    if (
      query.length < 2 ||
      pathname?.startsWith(
        "/track-order"
      )
    ) {
      setSuggestions([]);
      setLoading(false);

      return;
    }

    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          setLoading(true);
          setShowDropdown(true);

          try {
            const response =
              await fetch(
                `/api/products/search?q=${encodeURIComponent(
                  query
                )}&limit=6`,
                {
                  signal:
                    controller.signal,
                }
              );

            if (!response.ok) {
              throw new Error(
                "Search failed"
              );
            }

            const data =
              (await response.json()) as {
                products?: SearchSuggestion[];
              };

            if (
              controller.signal
                .aborted
            ) {
              return;
            }

            setSuggestions(
              Array.isArray(
                data.products
              )
                ? data.products
                : []
            );
          } catch {
            if (
              !controller.signal
                .aborted
            ) {
              setSuggestions([]);
            }
          } finally {
            if (
              !controller.signal
                .aborted
            ) {
              setLoading(false);
            }
          }
        },
        280
      );

    return () => {
      window.clearTimeout(
        timer
      );

      controller.abort();
    };
  }, [
    searchQuery,
    pathname,
  ]);

  /* =======================================================
     SEARCH SUBMIT
  ======================================================= */

  function submitSearch() {
    const query =
      searchQuery.trim();

    if (!query) {
      return;
    }

    router.push(
      `/products?search=${encodeURIComponent(
        query
      )}`
    );

    setShowDropdown(false);
  }

  /* =======================================================
     CHECKOUT NAV
  ======================================================= */

  if (
    pathname === "/checkout"
  ) {
    return (
      <>
        <header className="sticky top-8 z-40 border-b border-black/[0.06] bg-white shadow-sm">
          <div className="mx-auto flex min-h-[64px] max-w-7xl items-center justify-between px-4 sm:px-6">
            <LogoMark compact />

            <div className="flex items-center gap-3">
              <span className="text-[12px] font-black uppercase tracking-[0.13em] text-black/40">
                Secure Checkout
              </span>

              {session ? (
                <button
                  type="button"
                  onClick={() =>
                    openProfileModal()
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-link transition hover:bg-brand-primary hover:text-brand-dark"
                  aria-label="Open profile"
                >
                  <User className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </header><MarketplaceNav />

        <CartSidebar
          open={cartOpen}
          onClose={() =>
            setCartOpen(false)
          }
        />
      </>
    );
  }

  /* =======================================================
     MAIN NAVBAR
  ======================================================= */

  return (
    <>
      <header className="sticky top-8 z-40 w-full bg-white shadow-[0_5px_22px_rgba(17,17,17,0.055)]">
        {/* =================================================
            MAIN ROW
        ================================================= */}

        <div className="border-b border-black/[0.06] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
            <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-4">
              {/* MOBILE MENU */}

              <button
                type="button"
                onClick={() =>
                  setMobileOpen(true)
                }
                className="order-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-brand-dark shadow-sm transition hover:bg-brand-soft lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>

              {/* =================================================
                  LOGO
              ================================================= */}

              <div className="order-2 shrink-0">
                <LogoMark href="/" />

                <p className="mt-0.5 hidden text-[12px] font-bold uppercase tracking-[0.075em] text-black/40 xl:block">
                  People • Products • Vendors • Together
                </p>
              </div>

              {/* =================================================
                  SEARCH
              ================================================= */}

              <div
                ref={searchRef}
                className="order-4 relative z-50 w-full lg:order-3 lg:min-w-0 lg:flex-1"
              >
                <form
                  action="/products"
                  method="get"
                  role="search"
                  onSubmit={(
                    event
                  ) => {
                    event.preventDefault();
                    submitSearch();
                  }}
                >
                  <div className="flex h-[44px] overflow-hidden rounded-xl border border-black/[0.09] bg-white shadow-[0_3px_14px_rgba(17,17,17,0.045)] transition duration-200 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20">
                    <input
                      type="search"
                      name="search"
                      value={
                        searchQuery
                      }
                      onChange={(
                        event
                      ) =>
                        setSearchQuery(
                          event.target
                            .value
                        )
                      }
                      onFocus={() => {
                        if (
                          searchQuery.trim()
                            .length >=
                          2
                        ) {
                          setShowDropdown(
                            true
                          );
                        }
                      }}
                      placeholder="Search products, brands or your want..."
                      autoComplete="off"
                      className="min-w-0 flex-1 border-0 bg-transparent px-4 text-[12px] font-medium text-brand-dark outline-none placeholder:text-black/35 sm:text-[12px]"
                    />

                    <button
                      type="submit"
                      aria-label="Search products"
                      className="flex w-[50px] shrink-0 items-center justify-center bg-brand-primary text-brand-dark transition hover:bg-brand-hover"
                    >
                      <Search className="h-[19px] w-[19px]" />
                    </button>
                  </div>
                </form>

                {/* SEARCH DROPDOWN */}

                {showDropdown &&
                searchQuery.trim()
                  .length >= 2 ? (
                  <div className="animate-search-suggest-in absolute left-0 right-0 top-[calc(100%+7px)] max-h-[390px] overflow-y-auto rounded-2xl border border-black/[0.08] bg-white p-1.5 text-brand-dark shadow-[0_20px_55px_rgba(0,0,0,0.15)]">
                    {loading ? (
                      <div className="px-4 py-4 text-[12px] font-semibold text-black/40">
                        Searching…
                      </div>
                    ) : null}

                    {!loading &&
                    suggestions.length ===
                      0 ? (
                      <div className="p-4">
                        <p className="text-[12px] font-black text-brand-dark">
                          Product nahi mila?
                        </p>

                        <p className="mt-1 text-[12px] font-medium text-black/45">
                          Apni Want post karo aur sellers ko batao kya chahiye.
                        </p>

                        <Link
                          href="/wants"
                          onClick={() =>
                            setShowDropdown(
                              false
                            )
                          }
                          className="mt-3 inline-flex h-9 items-center rounded-lg bg-brand-primary px-3 text-[12px] font-black text-brand-dark transition hover:bg-brand-hover"
                        >
                          Want Post Karo
                        </Link>
                      </div>
                    ) : null}

                    {suggestions.map(
                      (product) => (
                        <button
                          key={
                            product.id
                          }
                          type="button"
                          onClick={() => {
                            router.push(
                              `/products/${product.id}`
                            );

                            setShowDropdown(
                              false
                            );
                          }}
                          className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-brand-soft/70"
                        >
                          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-brand-background">
                            {product.image ? (
                              <Image
                                src={
                                  product.image
                                }
                                alt={
                                  product.name
                                }
                                fill
                                sizes="44px"
                                className="object-contain p-1"
                                unoptimized={
                                  product.image.startsWith(
                                    "/api/"
                                  ) ||
                                  product.image.startsWith(
                                    "/uploads/"
                                  ) ||
                                  product.image.startsWith(
                                    "blob:"
                                  ) ||
                                  product.image.startsWith(
                                    "data:"
                                  )
                                }
                              />
                            ) : (
                              <Package className="absolute inset-0 m-auto h-4 w-4 text-black/20" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-black text-brand-dark">
                              {
                                product.name
                              }
                            </p>

                            <p className="mt-0.5 truncate text-[12px] font-medium text-black/35">
                              {
                                product.category
                              }
                            </p>
                          </div>

                          <span className="shrink-0 text-[12px] font-black text-brand-link">
                            {formatPKR(
                              product.price
                            )}
                          </span>
                        </button>
                      )
                    )}

                    {suggestions.length >
                    0 ? (
                      <button
                        type="button"
                        onClick={
                          submitSearch
                        }
                        className="mt-1 flex h-9 w-full items-center justify-center rounded-xl bg-brand-dark text-[12px] font-black text-white transition hover:bg-black"
                      >
                        View All Results
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* =================================================
                  RIGHT ACTIONS
                  Pakistan location removed
              ================================================= */}

              <div className="order-3 ml-auto flex shrink-0 items-center gap-0.5 lg:order-4 lg:ml-0">
                {/* WANTS */}

                <Link
                  href="/wants"
                  className="group relative flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-brand-dark transition hover:bg-brand-soft"
                  aria-label="Wants"
                >
                  <Heart className="h-[19px] w-[19px] transition-transform group-hover:scale-105" />

                  <span className="hidden text-[12px] font-black xl:inline">
                    Wants
                  </span>

                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-primary shadow-[0_0_7px_rgba(183,227,58,0.8)]" />
                </Link>

                {/* ACCOUNT */}

                {!session ? (
                  <button
                    type="button"
                    onClick={() =>
                      openAuthModal(
                        "login"
                      )
                    }
                    className="group flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-brand-dark transition hover:bg-brand-soft"
                    aria-label="Account"
                  >
                    <User className="h-[19px] w-[19px] transition-transform group-hover:scale-105" />

                    <span className="hidden text-[12px] font-black xl:inline">
                      Account
                    </span>
                  </button>
                ) : (
                  <div
                    ref={profileRef}
                    className="relative"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setProfileOpen(
                          (value) =>
                            !value
                        )
                      }
                      className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-brand-dark transition hover:bg-brand-soft"
                      aria-label="Account menu"
                    >
                      {session.user
                        ?.image ? (
                        <Image
                          src={
                            session
                              .user
                              .image
                          }
                          alt={
                            session.user
                              ?.name ||
                            "Profile"
                          }
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded-full object-cover ring-2 ring-brand-primary/30"
                        />
                      ) : (
                        <User className="h-[19px] w-[19px]" />
                      )}

                      <span className="hidden max-w-[68px] truncate text-[12px] font-black xl:inline">
                        {session.user
                          ?.name ||
                          "Account"}
                      </span>
                    </button>

                    {profileOpen ? (
                      <div className="absolute right-0 top-[calc(100%+7px)] z-50 min-w-[175px] rounded-xl border border-black/[0.08] bg-white p-2 text-brand-dark shadow-[0_18px_45px_rgba(0,0,0,0.14)]">
                        {session.user
                          ?.role !==
                        "admin" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileOpen(
                                false
                              );

                              openProfileModal();
                            }}
                            className="w-full rounded-lg px-3 py-2.5 text-left text-[12px] font-bold transition hover:bg-brand-soft"
                          >
                            My Profile
                          </button>
                        ) : null}

                        <Link
                          href="/track-order"
                          onClick={() =>
                            setProfileOpen(
                              false
                            )
                          }
                          className="block rounded-lg px-3 py-2.5 text-[12px] font-bold transition hover:bg-brand-soft"
                        >
                          My Orders
                        </Link>

                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(
                              false
                            );

                            void signOut({
                              callbackUrl:
                                "/",
                            });
                          }}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-[12px] font-bold text-red-600 transition hover:bg-red-50"
                        >
                          Logout
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* CART */}

                <button
                  type="button"
                  onClick={() =>
                    setCartOpen(true)
                  }
                  className="group relative flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-brand-dark transition hover:bg-brand-soft"
                  aria-label="Open cart"
                >
                  <ShoppingCart className="h-[20px] w-[20px] transition-transform group-hover:scale-105" />

                  <span className="hidden text-[12px] font-black xl:inline">
                    Cart
                  </span>

                  {totalQty > 0 ? (
                    <span className="absolute right-0 top-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brand-primary px-1 text-[12px] font-black text-brand-dark ring-2 ring-white">
                      {totalQty > 99
                        ? "99+"
                        : totalQty}
                    </span>
                  ) : null}
                </button>

                {/* SELLER CTA */}

                <Link
                  href="/vendor/register"
                  className="ml-1 hidden h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-[12px] font-black text-brand-dark shadow-[0_6px_18px_rgba(183,227,58,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-brand-hover md:flex"
                >
                  Seller Bano
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            CATEGORY / SECOND NAV
        ================================================= */}

        <div className="border-b border-black/[0.055] bg-[#fafbf7]">
          <div className="mx-auto flex max-w-7xl items-center px-4 sm:px-6">
            <Link
              href="/products"
              className="flex h-9 shrink-0 items-center gap-2 border-r border-black/[0.08] pr-4 text-[12px] font-black text-brand-dark transition hover:text-brand-link"
            >
              <Menu className="h-3.5 w-3.5" />

              Categories

              <ChevronDown className="h-3 w-3 text-black/35" />
            </Link>

            <nav className="hide-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pl-2">
              {navCategories.map(
                (category) => (
                  <Link
                    key={
                      category
                    }
                    href={`/products?category=${encodeURIComponent(
                      category
                    )}`}
                    className="shrink-0 rounded-lg px-3 py-2 text-[12px] font-bold text-black/58 transition hover:bg-brand-soft hover:text-brand-link"
                  >
                    {category}
                  </Link>
                )
              )}
            </nav>

            <Link
              href="/wants/trending"
              className="ml-2 hidden shrink-0 items-center rounded-lg bg-brand-soft px-3 py-1.5 text-[12px] font-black text-brand-link transition hover:bg-brand-primary hover:text-brand-dark lg:inline-flex"
            >
              Trending Wants
            </Link>
          </div>
        </div>
      </header><MarketplaceNav />

      {/* ===================================================
          MOBILE MENU
      =================================================== */}

      {mobileOpen ? (
        <div className="fixed inset-0 z-[90] bg-white text-brand-dark lg:hidden">
          {/* HEADER */}

          <div className="flex items-center justify-between border-b border-black/[0.08] px-5 py-4">
            <div>
              <LogoMark compact />

              <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.08em] text-black/35">
                People • Products • Vendors • Together
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setMobileOpen(false)
              }
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-brand-dark"
              aria-label="Close menu"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* MENU BODY */}

          <div className="h-[calc(100vh-78px)] overflow-y-auto p-5">
            <p className="mb-3 text-[12px] font-black uppercase tracking-[0.15em] text-brand-link">
              JORO Marketplace
            </p>

            <div className="space-y-2">
              <Link
                href="/products"
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="flex items-center gap-3 rounded-xl bg-brand-background px-4 py-3.5 text-[12px] font-black"
              >
                <ShoppingCart className="h-4 w-4 text-brand-link" />

                Shop Products
              </Link>

              <Link
                href="/wants"
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="flex items-center justify-between rounded-xl bg-brand-primary px-4 py-3.5 text-[12px] font-black text-brand-dark"
              >
                <span className="flex items-center gap-3">
                  <Heart className="h-4 w-4" />

                  Want Post Karo
                </span>

                <span className="rounded-full bg-brand-dark px-2 py-1 text-[12px] font-black uppercase tracking-wider text-brand-primary">
                  Hot
                </span>
              </Link>

              <Link
                href="/wants/trending"
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="block rounded-xl bg-brand-soft px-4 py-3.5 text-[12px] font-black text-brand-link"
              >
                Trending Wants
              </Link>

              <Link
                href="/vendor/register"
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="flex items-center gap-3 rounded-xl bg-brand-dark px-4 py-3.5 text-[12px] font-black text-white"
              >
                <Store className="h-4 w-4 text-brand-primary" />

                Seller Bano
              </Link>
            </div>

            {/* CATEGORIES */}

            <div className="my-5 h-px bg-black/[0.07]" />

            <p className="mb-3 text-[12px] font-black uppercase tracking-[0.15em] text-black/35">
              Categories
            </p>

            <div className="grid grid-cols-2 gap-2">
              {navCategories.map(
                (category) => (
                  <Link
                    key={
                      category
                    }
                    href={`/products?category=${encodeURIComponent(
                      category
                    )}`}
                    onClick={() =>
                      setMobileOpen(
                        false
                      )
                    }
                    className="rounded-xl border border-black/[0.06] bg-white px-3 py-3 text-[12px] font-bold shadow-sm transition hover:bg-brand-soft"
                  >
                    {category}
                  </Link>
                )
              )}
            </div>

            {/* HELP */}

            <div className="my-5 h-px bg-black/[0.07]" />

            <div className="space-y-1">
              <Link
                href="/track-order"
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="block rounded-xl px-3 py-3 text-[12px] font-bold text-black/60 transition hover:bg-brand-background"
              >
                Track Order
              </Link>

              <a
                href={`https://wa.me/${whatsappNumber.replace(
                  /\D/g,
                  ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="block rounded-xl px-3 py-3 text-[12px] font-bold text-black/60 transition hover:bg-brand-background"
              >
                WhatsApp Support
              </a>
            </div>

            {/* ACCOUNT */}

            <div className="my-5 h-px bg-black/[0.07]" />

            {!session ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(
                      false
                    );

                    openAuthModal(
                      "login"
                    );
                  }}
                  className="rounded-xl border border-black/[0.1] px-4 py-3 text-[12px] font-black text-brand-dark"
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(
                      false
                    );

                    openAuthModal(
                      "signup"
                    );
                  }}
                  className="rounded-xl bg-brand-primary px-4 py-3 text-[12px] font-black text-brand-dark"
                >
                  Sign Up
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {session.user
                  ?.role !==
                "admin" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(
                        false
                      );

                      openProfileModal();
                    }}
                    className="w-full rounded-xl bg-brand-background px-4 py-3 text-left text-[12px] font-black text-brand-dark"
                  >
                    My Profile
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(
                      false
                    );

                    void signOut({
                      callbackUrl:
                        "/",
                    });
                  }}
                  className="w-full rounded-xl px-4 py-3 text-left text-[12px] font-black text-red-600"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ===================================================
          CART SIDEBAR
      =================================================== */}

      <CartSidebar
        open={cartOpen}
        onClose={() =>
          setCartOpen(false)
        }
      />
    </>
  );
}