"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";

export function CartSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { items, subtotal, setQuantity, removeItem } = useCart();
  const { requireCustomer } = useCustomerAuth();
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="button"]'
        )
      ).filter((element) => !element.hasAttribute("disabled"));

      if (!focusable.length) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-50 bg-[#062d24]/45 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className={`fixed inset-y-0 right-0 z-[51] flex h-full w-[92vw] max-w-[440px] flex-col border-l border-[#0c2d28]/10 bg-white shadow-[0_28px_80px_rgba(4,18,14,0.24)] transition-transform duration-300 ease-out sm:w-[420px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-[#0d2f2b]/10 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf9d7] text-[#0a3a2d] ring-1 ring-[#bfe364]/40">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h2 id="cart-drawer-title" className="text-lg font-black text-[#0d2e2a]">
                Your Cart
              </h2>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#47645f]">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#102f2a]/10 bg-white text-[#0d2e2a] transition hover:bg-[#edf7eb] hover:text-[#0d2e2a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b3a2d]"
            aria-label="Close cart"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto bg-[#f8faf7] p-4 sm:p-5">
            {items.length === 0 ? (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-[#dfece5] bg-[#f1f9ef] px-6 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#e5f7cf] text-[#0b3d32] shadow-inner shadow-[#d6eeb0]">
                  <ShoppingBag className="h-9 w-9" />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-[#0d2e2a]">
                  Your cart is empty
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[#49635f]">
                  Add a few essentials and come back here to continue shopping.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#bfe364] px-5 py-3 text-sm font-black text-[#072d25] shadow-[0_10px_24px_rgba(191,227,100,0.35)] transition hover:-translate-y-0.5 hover:bg-[#b2dc53] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b3a2d]"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((line) => (
                  <div
                    key={`${line.productId}-${line.variant || ""}`}
                    className="flex gap-3 rounded-2xl border border-[#dfeae4] bg-white p-3 shadow-sm shadow-[#edf2ed] transition hover:border-[#c4dcca] hover:shadow-md"
                  >
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#eef3ee] ring-1 ring-[#dfeae4]">
                      {line.image ? (
                        <Image
                          src={line.image}
                          alt={line.name}
                          fill
                          unoptimized={line.image.startsWith("/api/")}
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-sm font-bold leading-5 text-[#0d2e2a]">
                          {line.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeItem(line.productId, line.variant)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#49635f] transition hover:bg-[#f5f8f4] hover:text-[#bf3a36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b3a2d]"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {line.serviceId ? (
                        <div className="mt-2 rounded-lg bg-[#edf9d7] px-2.5 py-1.5 text-[11px] font-semibold text-[#1d463d]">
                          {line.serviceName} · {formatPKR((line.servicePrice || 0) * line.quantity)}
                        </div>
                      ) : null}

                      {line.quoteId ? (
                        <p className="mt-2 text-[11px] font-medium text-[#49635f]">
                          Accepted offer · Qty {line.quantity}
                        </p>
                      ) : null}

                      {line.variant ? (
                        <p className="mt-2 text-[11px] font-medium text-[#5d706d]">
                          {line.variant}
                        </p>
                      ) : null}

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-base font-black text-[#0d2e2a]">
                          {formatPKR(line.price)}
                        </p>

                        <div className="flex items-center gap-2 rounded-full border border-[#dfeae4] bg-[#f6faf7] p-1">
                          <button
                            type="button"
                            onClick={() => setQuantity(line.productId, line.quantity - 1, line.variant)}
                            aria-label={`Decrease quantity for ${line.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[#0d2e2a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={line.quantity <= 1}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[1.75rem] text-center text-sm font-bold text-[#0d2e2a]">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              requireCustomer(() => {
                                setQuantity(line.productId, line.quantity + 1, line.variant);
                              }, "signup")
                            }
                            aria-label={`Increase quantity for ${line.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[#0d2e2a] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b3a2d] disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={line.quantity >= line.maxStock}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 ? (
            <footer className="border-t border-[#0d2f2b]/10 bg-white px-4 pb-4 pt-4 shadow-[0_-14px_28px_rgba(8,25,19,0.04)] sm:px-5">
              <div className="mb-3 flex items-center justify-between text-sm text-[#49635f]">
                <span>Subtotal</span>
                <span className="text-base font-black text-[#0d2e2a]">{formatPKR(subtotal)}</span>
              </div>

              <p className="mb-4 text-xs font-medium text-[#5d706d]">
                Shipping calculated at checkout
              </p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={() =>
                    requireCustomer(() => {
                      onClose();
                      router.push("/checkout");
                    }, "signup")
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#bfe364] px-4 py-3.5 text-sm font-black text-[#082d25] shadow-[0_10px_24px_rgba(191,227,100,0.32)] transition hover:-translate-y-0.5 hover:bg-[#a7d844] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b3a2d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Checkout
                  <ArrowRight className="h-4 w-4" />
                </button>

                <Link
                  href="/cart"
                  onClick={onClose}
                  className="flex w-full items-center justify-center rounded-xl border border-[#dfeae4] bg-[#f6faf7] px-4 py-3 text-sm font-bold text-[#163d35] transition hover:bg-[#edf7eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b3a2d]"
                >
                  View Cart
                </Link>
              </div>
            </footer>
          ) : null}
        </div>
      </aside>
    </>
  );
}
