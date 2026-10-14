"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import Image from "next/image";
import { CategoryNavigation, useNavCategories } from "./CategoryNavigation";
import { MarketplaceNav } from "./MarketplaceNav";
import { PostWantButton } from "./PostWantButton";
import Link from "@/components/ui/LoadingLink";
import { usePathname } from "next/navigation";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Heart,
  Menu,
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
import { CustomerNotificationBell } from "./CustomerNotificationBell";
import { LogoMark } from "./LogoMark";

import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

import { SearchBar } from "@/components/SearchBar";


/* =========================================================
   TYPES
========================================================= */


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
     CLOSE DROPDOWNS ON OUTSIDE CLICK
  ======================================================= */

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
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
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:flex-nowrap lg:gap-3 xl:gap-5">
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

              <div className="order-2 flex shrink-0 items-center">
                <LogoMark href="/" className="rounded-md focus-visible:outline-brand-link" />
              </div>

              {/* =================================================
                  SEARCH
              ================================================= */}

              <div className="order-4 relative z-50 w-full min-w-0 lg:order-3 lg:flex-1">
                <SearchBar />
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
                <CustomerNotificationBell />
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
            <div className="flex items-center">
              <LogoMark compact />
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
