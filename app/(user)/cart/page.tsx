"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";
import { Minus, Plus, Trash2 } from "lucide-react";

export default function CartPage() {
  const router = useRouter();
  const { items, subtotal, setQuantity, removeItem } = useCart();
  const { requireCustomer, openAuthModal } = useCustomerAuth();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-darkText mb-8">
        Shopping Cart
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.length === 0 ? (
            <p className="text-darkText/60 py-12 text-center rounded-card border border-borderGray bg-white">
              Your cart is empty.{" "}
              <Link href="/products" className="text-primaryBlue font-semibold">
                Start shopping
              </Link>
            </p>
          ) : (
            items.map((line) => (
              <div
                key={`${line.productId}-${line.variant || ""}`}
                className="flex gap-4 rounded-card border border-borderGray bg-white p-4 shadow-card"
              >
                <div className="relative h-24 w-24 shrink-0 rounded-lg overflow-hidden bg-lightGray">
                  {line.image ? (
                    <Image
                      src={line.image}
                      alt={line.name}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${line.productId}`}
                    className="font-semibold text-darkText hover:text-primaryBlue line-clamp-2"
                  >
                    {line.name}
                  </Link>
                  {line.variant ? (
                    <p className="text-sm text-darkText/50">{line.variant}</p>
                  ) : null}
                  <p className="text-primaryBlue font-bold mt-1">
                    {formatPKR(line.price)}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      className="rounded-lg border border-borderGray p-1.5"
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
                    <span className="w-8 text-center text-sm font-medium">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-borderGray p-1.5"
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
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <aside className="rounded-card border border-borderGray bg-white p-6 shadow-card h-fit lg:sticky lg:top-24">
          <h2 className="font-bold text-lg text-darkText mb-4">Order Summary</h2>
          <div className="flex justify-between text-darkText mb-2">
            <span>Subtotal</span>
            <span className="font-semibold">{formatPKR(subtotal)}</span>
          </div>
          <p className="text-xs text-darkText/50 mb-6">
            Shipping and COD fees may be added at checkout.
          </p>
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() =>
              requireCustomer(() => router.push("/checkout"), "signup")
            }
            className={`block w-full rounded-xl py-3.5 text-center font-bold text-white transition-colors ${
              items.length === 0
                ? "bg-darkText/30 cursor-not-allowed"
                : "bg-primaryBlue hover:bg-darkBlue"
            }`}
          >
            Proceed to Checkout
          </button>
          <p className="text-xs text-darkText/50 text-center mt-2">
            An{" "}
            <button
              type="button"
              className="text-primaryBlue font-semibold underline"
              onClick={() => openAuthModal("signup")}
            >
              account
            </button>{" "}
            is required for checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}
