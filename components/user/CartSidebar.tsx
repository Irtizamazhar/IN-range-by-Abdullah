"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Plus, Minus, Trash2 } from "lucide-react";
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

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/40 lg:bg-transparent"
        aria-label="Close cart overlay"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-[51] flex h-full w-full max-w-md flex-col bg-white shadow-xl border-l border-borderGray">
        <div className="flex items-center justify-between border-b border-borderGray px-4 py-3">
          <h2 className="text-lg font-bold text-darkText">Your Cart</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-lightGray"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <p className="text-darkText/60 text-center py-12">Cart is empty</p>
          ) : (
            items.map((line) => (
              <div
                key={`${line.productId}-${line.variant || ""}`}
                className="flex gap-3 border-b border-borderGray pb-4"
              >
                <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-lightGray">
                  {line.image ? (
                    <Image
                      src={line.image}
                      alt={line.name}
                      fill
                      unoptimized={line.image.startsWith("/api/")}
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-darkText line-clamp-2">
                    {line.name}
                  </p>
                  {line.variant ? (
                    <p className="text-xs text-darkText/50">{line.variant}</p>
                  ) : null}
                  <p className="text-primaryBlue font-semibold mt-1">
                    {formatPKR(line.price)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      className="rounded border border-borderGray p-1 hover:bg-lightGray"
                      onClick={() =>
                        setQuantity(
                          line.productId,
                          line.quantity - 1,
                          line.variant
                        )
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm">{line.quantity}</span>
                    <button
                      type="button"
                      className="rounded border border-borderGray p-1 hover:bg-lightGray"
                      onClick={() =>
                        requireCustomer(() => {
                          setQuantity(
                            line.productId,
                            line.quantity + 1,
                            line.variant
                          );
                        }, "signup")
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="ml-auto text-red-600 p-1"
                      onClick={() =>
                        removeItem(line.productId, line.variant)
                      }
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-borderGray p-4 space-y-3 bg-lightGray/50">
          <div className="flex justify-between font-bold text-darkText">
            <span>Subtotal</span>
            <span>{formatPKR(subtotal)}</span>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/cart"
              onClick={onClose}
              className="block w-full rounded-xl border-2 border-primaryBlue py-3 text-center font-semibold text-primaryBlue hover:bg-primaryBlue/5 transition-colors"
            >
              View cart
            </Link>
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() =>
                requireCustomer(() => {
                  onClose();
                  router.push("/checkout");
                }, "signup")
              }
              className="block w-full rounded-xl bg-primaryBlue py-3 text-center font-semibold text-white hover:bg-darkBlue transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Checkout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
