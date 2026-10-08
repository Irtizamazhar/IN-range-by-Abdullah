"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";

import Image from "next/image";
import { BrandTagline } from "./BrandTagline";
import { CategoryNavigation, useNavCategories } from "./CategoryNavigation";
import { MarketplaceNav } from "./MarketplaceNav";
import { PostWantButton } from "./PostWantButton";
import Link from "@/components/ui/LoadingLink";
import { usePathname,
  useSearchParams } from "next/navigation";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
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



/* =========================================================
   NAVBAR
========================================================= */

export function Navbar({
  whatsappNumber,
}: {
  whatsappNumber: string;
}) {
  const { data: categoryRows = [] } = useNavCategories();
  const navCategories = categoryRows.map(category => category.name);
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

  async function submitSearch() {
    const query =
      searchQuery.trim();

    if (!query) {
      return;
    }

    await router.push(
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
        <header className="sticky top-10 z-40 border-b border-black/[0.06] bg-white shadow-sm">
          <div className="mx-auto flex min-h-[64px] max-w-7xl items-center justify-between px-4 sm:px-6">
            <LogoMark compact />

            <div className="flex items-center gap-3">
              <span className="text-[12px] font-black uppercase tracking-[0.13em] text-black/40">
                Secure Checkout
              </span>

              {session ? (
                <LoadingButton
                  type="button"
                  onClick={() =>
                    openProfileModal()
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-link transition hover:bg-brand-primary hover:text-brand-dark"
                  aria-label="Open profile"
                >
                  <User className="h-4 w-4" />
                </LoadingButton>
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
      <header className="sticky top-10 z-40 w-full bg-white shadow-[0_4px_18px_rgba(11,46,31,0.06)]">
        {/* =================================================
            MAIN ROW
        ================================================= */}

        <div className="border-b border-black/[0.08] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:flex-nowrap lg:gap-6">
              {/* MOBILE MENU */}

              <LoadingButton
                type="button"
                onClick={() =>
                  setMobileOpen(true)
                }
                className="order-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-brand-link transition hover:bg-brand-soft focus-visible:bg-brand-soft focus-visible:outline-brand-link lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-[18px] w-[18px]" />
              </LoadingButton>

              {/* =================================================
                  LOGO
              ================================================= */}

              <div className="order-2 flex shrink-0 flex-col items-center">
                <LogoMark href="/" className="rounded-md focus-visible:outline-brand-link" />

                <BrandTagline />
              </div>

              {/* =================================================
                  SEARCH
              ================================================= */}

              <div
                ref={searchRef}
                className="order-4 relative z-50 w-full lg:order-3 lg:min-w-0 lg:flex-1"
              >
                <LoadingForm
                  action="/products"
                  method="get"
                  role="search"
                  onSubmit={(
                    event
                  ) => {
                    event.preventDefault();
                    return submitSearch();
                  }}
                >
                  <div className="flex h-11 overflow-hidden rounded-xl border border-black/10 bg-white transition duration-200 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/30">
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

                    <LoadingButton
                      type="submit"
                      aria-label="Search products"
                      className="flex w-[50px] shrink-0 items-center justify-center bg-brand-primary text-brand-dark transition hover:bg-brand-hover"
                    >
                      <Search className="h-[19px] w-[19px]" />
                    </LoadingButton>
                  </div>
                </LoadingForm>

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
                        <p className="text-[14px] font-black text-brand-dark">
                          Product nahi mila?
                        </p>

                        <p className="mt-1 text-[12px] font-medium text-black/45">
                          Apni Want post karo aur sellers ko batao kya chahiye.
                        </p>

                        <PostWantButton
                          initialTitle={searchQuery.trim()}
                          onClick={() =>
                            setShowDropdown(
                              false
                            )
                          }
                          className="mt-3 inline-flex h-9 items-center rounded-lg bg-brand-primary px-3 text-[12px] font-black text-brand-dark transition hover:bg-brand-hover"
                        >
                          Want Post Karo
                        </PostWantButton>
                      </div>
                    ) : null}

                    {suggestions.map(
                      (product) => (
                        <LoadingButton
                          key={
                            product.id
                          }
                          type="button"
                          onClick={async () => {
                            await router.push(
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
                        </LoadingButton>
                      )
                    )}

                    {suggestions.length >
                    0 ? (
                      <LoadingButton
                        type="button"
                        onClick={
                          submitSearch
                        }
                        className="mt-1 flex h-9 w-full items-center justify-center rounded-xl bg-brand-dark text-[12px] font-black text-white transition hover:bg-black"
                      >
                        View All Results
                      </LoadingButton>
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
                  className="group relative flex h-11 items-center gap-1.5 rounded-xl px-2 text-brand-link focus-visible:outline-brand-link sm:px-2.5"
                  aria-label="Wants"
                >
                  <Heart className="h-[19px] w-[19px] transition-transform group-hover:scale-105" />

                  <span className="hidden text-[12px] font-black decoration-2 underline-offset-4 group-hover:underline group-focus-visible:underline xl:inline">
                    Wants
                  </span>
                </Link>

                <Link href="/together" aria-label="Together" className="hidden h-11 items-center rounded-xl px-2 text-xs font-semibold text-brand-link decoration-2 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-brand-link md:flex">Together</Link>
                <Link href="/stores" aria-label="Stores" className="hidden h-11 items-center rounded-xl px-2 text-xs font-semibold text-brand-link decoration-2 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-brand-link md:flex">Stores</Link>
                {/* SELLER CTA */}

                <Link
                  href="/sell"
                  className="ml-1 hidden h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-[12px] font-black text-brand-dark shadow-[0_6px_18px_rgba(183,227,58,0.18)] !no-underline hover:!bg-[rgb(var(--brand-primary-rgb))] hover:!no-underline focus-visible:!no-underline focus-visible:outline-brand-link md:flex"
                >
                  Sell on JORO
                </Link>
                {/* CART */}

                <LoadingButton
                  type="button"
                  onClick={() =>
                    setCartOpen(true)
                  }
                  className="group relative flex h-11 items-center gap-1.5 rounded-xl px-2 text-brand-link focus-visible:outline-brand-link sm:px-2.5"
                  aria-label="Open cart"
                >
                  <ShoppingCart className="h-[20px] w-[20px] transition-transform group-hover:scale-105" />

                  <span className="hidden text-[12px] font-black decoration-2 underline-offset-4 group-hover:underline group-focus-visible:underline xl:inline">
                    Cart
                  </span>

                  {totalQty > 0 ? (
                    <span className="absolute right-0 top-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brand-primary px-1 text-[12px] font-black text-brand-dark ring-2 ring-white">
                      {totalQty > 99
                        ? "99+"
                        : totalQty}
                    </span>
                  ) : null}
                </LoadingButton>

                {/* ACCOUNT */}

                {!session ? (
                  <LoadingButton
                    type="button"
                    onClick={() =>
                      openAuthModal(
                        "login"
                      )
                    }
                    className="group flex h-11 items-center gap-1.5 rounded-xl px-2 text-brand-link focus-visible:outline-brand-link sm:px-2.5"
                    aria-label="Account"
                  >
                    <User className="h-[19px] w-[19px] transition-transform group-hover:scale-105" />

                    <span className="hidden text-[12px] font-black decoration-2 underline-offset-4 group-hover:underline group-focus-visible:underline xl:inline">
                      Account
                    </span>
                  </LoadingButton>
                ) : (
                  <div
                    ref={profileRef}
                    className="relative"
                  >
                    <LoadingButton
                      type="button"
                      onClick={() =>
                        setProfileOpen(
                          (value) =>
                            !value
                        )
                      }
                      className="group flex h-11 items-center gap-1.5 rounded-xl px-2 text-brand-link focus-visible:outline-brand-link sm:px-2.5"
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

                      <span className="hidden max-w-[120px] truncate text-[12px] font-semibold decoration-2 underline-offset-4 group-hover:underline group-focus-visible:underline xl:inline">
                        {session.user
                          ?.name ||
                          "Account"}
                      </span>
                    </LoadingButton>

                    {profileOpen ? (
                      <div className="absolute right-0 top-[calc(100%+7px)] z-50 min-w-[175px] rounded-xl border border-black/[0.08] bg-white p-2 text-brand-dark shadow-[0_18px_45px_rgba(0,0,0,0.14)]">
                        {session.user
                          ?.role !==
                        "admin" ? (
                          <LoadingButton
                            type="button"
                            onClick={async () => { await openProfileModal(); setProfileOpen(false); }}
                            className="w-full rounded-lg px-3 py-2.5 text-left text-[12px] font-bold transition hover:bg-brand-soft"
                          >
                            My Profile
                          </LoadingButton>
                        ) : null}

                        <Link
                          href="/account"
                          onNavigateComplete={() =>
                            setProfileOpen(
                              false
                            )
                          }
                          className="block rounded-lg px-3 py-2.5 text-[12px] font-bold transition hover:bg-brand-soft"
                        >
                          My Account
                        </Link>

                        <Link
                          href="/my-stuff"
                          onNavigateComplete={() => setProfileOpen(false)}
                          className="block rounded-lg px-3 py-2.5 text-left text-[12px] font-bold transition hover:bg-brand-soft"
                        >
                          My Stuff
                        </Link>

                        <Link
                          href="/account/notifications"
                          onNavigateComplete={() => setProfileOpen(false)}
                          className="block rounded-lg px-3 py-2.5 text-left text-[12px] font-bold transition hover:bg-brand-soft"
                        >
                          Notifications
                        </Link>

                        <LoadingButton
                          type="button"
                          onClick={async () => { await signOut({ redirect: false }); await router.push("/"); await router.refresh(); setProfileOpen(false); }}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-[12px] font-bold text-red-600 transition hover:bg-red-50"
                        >
                          Logout
                        </LoadingButton>
                      </div>
                    ) : null}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            CATEGORY / SECOND NAV
        ================================================= */}

        <CategoryNavigation />
      </header><MarketplaceNav />

      {/* ===================================================
          MOBILE MENU
      =================================================== */}

      {mobileOpen ? (
        <div className="fixed inset-0 z-[90] bg-white text-brand-dark lg:hidden">
          {/* HEADER */}

          <div className="flex items-center justify-between border-b border-black/[0.08] px-5 py-4">
            <div className="flex flex-col items-center">
              <LogoMark compact />

              <BrandTagline />
            </div>

            <LoadingButton
              type="button"
              onClick={() =>
                setMobileOpen(false)
              }
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-brand-dark"
              aria-label="Close menu"
            >
              <X className="h-[18px] w-[18px]" />
            </LoadingButton>
          </div>

          {/* MENU BODY */}

          <div className="h-[calc(100vh-78px)] overflow-y-auto p-5">
            <p className="mb-3 text-[12px] font-black uppercase tracking-[0.15em] text-brand-link">
              JORO Marketplace
            </p>

            <div className="space-y-2">
              <Link
                href="/products"
                onNavigateComplete={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="flex items-center gap-3 rounded-xl bg-brand-background px-4 py-3.5 text-[14px] font-black"
              >
                <ShoppingCart className="h-4 w-4 text-brand-link" />

                Shop Products
              </Link>

              <PostWantButton
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="flex w-full items-center justify-between rounded-xl bg-brand-primary px-4 py-3.5 text-[14px] font-black text-brand-dark"
              >
                <span className="flex items-center gap-3">
                  <Heart className="h-4 w-4" />

                  Want Post Karo
                </span>
              </PostWantButton>

              <Link
                href="/wants/trending"
                onNavigateComplete={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="block rounded-xl bg-brand-soft px-4 py-3.5 text-[14px] font-black text-brand-link"
              >
                Trending Wants
              </Link>

              <Link
                href="/sell"
                onNavigateComplete={() =>
                  setMobileOpen(
                    false
                  )
                }
                className="flex items-center gap-3 rounded-xl bg-brand-dark px-4 py-3.5 text-[14px] font-black text-white !no-underline hover:!no-underline focus-visible:!no-underline"
              >
                <Store className="h-4 w-4 text-brand-primary" />

                Sell on JORO
              </Link>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link href="/together" onNavigateComplete={() => setMobileOpen(false)} className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand-link">Together</Link>
              <Link href="/stores" onNavigateComplete={() => setMobileOpen(false)} className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand-link">Stores</Link>
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
                    onNavigateComplete={() =>
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
                onNavigateComplete={() =>
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
                <LoadingButton
                  type="button"
                  onClick={async () => { await openAuthModal("login"); setMobileOpen(false); }}
                  className="rounded-xl border border-black/[0.1] px-4 py-3 text-[12px] font-black text-brand-dark"
                >
                  Login
                </LoadingButton>

                <LoadingButton
                  type="button"
                  onClick={async () => { await openAuthModal("signup"); setMobileOpen(false); }}
                  className="rounded-xl bg-brand-primary px-4 py-3 text-[12px] font-black text-brand-dark"
                >
                  Sign Up
                </LoadingButton>
              </div>
            ) : (
              <div className="space-y-2">
                {session.user
                  ?.role !==
                "admin" ? (
                  <LoadingButton
                    type="button"
                    onClick={async () => { await openProfileModal(); setMobileOpen(false); }}
                    className="w-full rounded-xl bg-brand-background px-4 py-3 text-left text-[12px] font-black text-brand-dark"
                  >
                    My Profile
                  </LoadingButton>
                ) : null}

                {session.user?.role !== "admin" ? (
                  <>
                    <Link
                      href="/account"
                      onNavigateComplete={() => setMobileOpen(false)}
                      className="block w-full rounded-xl bg-brand-soft px-4 py-3 text-left text-[13px] font-black text-brand-dark"
                    >
                      My Account
                    </Link>
                    <Link
                      href="/my-stuff"
                      onNavigateComplete={() => setMobileOpen(false)}
                      className="block w-full rounded-xl bg-brand-soft px-4 py-3 text-left text-[13px] font-black text-brand-dark"
                    >
                      My Stuff
                    </Link>
                    <Link
                      href="/account/notifications"
                      onNavigateComplete={() => setMobileOpen(false)}
                      className="block w-full rounded-xl bg-brand-soft px-4 py-3 text-left text-[13px] font-black text-brand-dark"
                    >
                      Notifications
                    </Link>
                  </>
                ) : null}

                <LoadingButton
                  type="button"
                  onClick={async () => { await signOut({ redirect: false }); await router.push("/"); await router.refresh(); setMobileOpen(false); }}
                  className="w-full rounded-xl px-4 py-3 text-left text-[12px] font-black text-red-600"
                >
                  Logout
                </LoadingButton>
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
