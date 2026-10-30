"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import { useCart, type CartLine } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useSavedProducts } from "@/lib/use-saved-products";
import { formatPKR } from "@/lib/format";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import { HomeProductCard } from "@/components/user/HomeProductCard";
import type { ProductCardData } from "@/components/user/ProductCard";
import {
  ArrowRight,
  Banknote,
  Heart,
  ImageOff,
  Minus,
  Plus,
  RotateCcw,
  ShoppingCart,
  Trash2,
} from "lucide-react";

function CartItem({ line }: { line: CartLine }) {
  const { setQuantity, removeItem } = useCart();
  const { requireCustomer } = useCustomerAuth();
  const { ids, toggle, isSaving, loading } = useSavedProducts();
  const [imageFailed, setImageFailed] = useState(false);
  const [moving, setMoving] = useState(false);
  const saved = ids.includes(line.productId);
  const atMax = line.quantity >= line.maxStock;
  const lineTotal = (line.price + (line.serviceId ? line.servicePrice || 0 : 0)) * line.quantity;

  // The line leaves the cart only once the server confirms the save (or it was already saved).
  useEffect(() => {
    if (moving && saved) removeItem(line.productId, line.variant);
  }, [moving, saved, removeItem, line.productId, line.variant]);

  async function saveForLater() {
    setMoving(true);
    if (!saved) {
      await toggle(line.productId);
      setMoving(false);
    }
  }

  return (
    <article className="flex gap-3 rounded-card border border-borderGray bg-white p-3 shadow-xs sm:gap-5 sm:p-5">
      <Link
        href={`/products/${line.productId}`}
        className="relative aspect-square w-24 shrink-0 self-start overflow-hidden rounded-xl bg-lightGray sm:w-36"
        aria-label={line.name}
      >
        {line.image && !imageFailed ? (
          <Image
            src={line.image}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 640px) 144px, 96px"
            unoptimized={shouldUnoptimizeImageSrc(line.image)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-darkText/30">
            <ImageOff aria-hidden="true" className="h-7 w-7" />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              href={`/products/${line.productId}`}
              className="line-clamp-2 break-words text-md font-bold text-darkText hover:text-admin-primary sm:text-lg"
            >
              {line.name}
            </Link>
            {line.variant ? (
              <span className="mt-1.5 inline-block max-w-full truncate rounded-full bg-brand-soft px-2.5 py-0.5 text-tiny font-semibold text-admin-primary sm:text-xs">
                {line.variant}
              </span>
            ) : null}
            {line.serviceId && (
              <p className="mt-2 rounded-lg bg-brand-soft p-2 text-xs sm:text-sm">
                {line.serviceName} · {formatPKR((line.servicePrice || 0) * line.quantity)} service add-on
              </p>
            )}
            {line.quoteId && (
              <p className="mt-2 text-xs text-darkText/70 sm:text-sm">
                Accepted offer · Agreed quantity {line.quantity}
              </p>
            )}
            <p className="mt-2 text-lg font-extrabold text-admin-primary sm:text-xl">
              {formatPKR(line.price)}
            </p>
            {line.quantity > 1 && (
              <p className="text-tiny text-darkText/55 sm:text-xs">
                {formatPKR(lineTotal)} for {line.quantity}
              </p>
            )}
          </div>

          <div className="flex h-11 w-fit shrink-0 items-center overflow-hidden rounded-xl border border-borderGray">
              <LoadingButton
                type="button"
                aria-label={`Decrease quantity of ${line.name}`}
                className="flex h-full w-11 items-center justify-center text-darkText hover:bg-lightGray"
                onClick={() => setQuantity(line.productId, line.quantity - 1, line.variant)}
              >
                <Minus aria-hidden="true" className="h-4 w-4" />
              </LoadingButton>
              <span aria-live="polite" className="flex h-full w-11 items-center justify-center border-x border-borderGray text-sm font-semibold">
                {line.quantity}
              </span>
              <LoadingButton
                type="button"
                aria-label={`Increase quantity of ${line.name}`}
                disabled={atMax}
                className="flex h-full w-11 items-center justify-center text-darkText hover:bg-lightGray disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() =>
                  requireCustomer(() => {
                    setQuantity(line.productId, line.quantity + 1, line.variant);
                  }, "signup")
                }
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </LoadingButton>
          </div>
        </div>

        <div className="-ml-2.5 mt-2 flex flex-wrap items-center gap-x-1 sm:ml-0 sm:mt-auto sm:justify-end sm:pt-3">
          <LoadingButton
            type="button"
            disabled={loading || isSaving(line.productId)}
            onClick={() => void saveForLater()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-darkText/75 hover:bg-lightGray disabled:opacity-60 sm:text-sm"
          >
            <Heart aria-hidden="true" className={`h-4 w-4 ${saved ? "fill-current text-rose-600" : ""}`} />
            <span className="sm:hidden">Save</span>
            <span className="hidden sm:inline">Save for later</span>
          </LoadingButton>
          <span aria-hidden="true" className="h-5 w-px bg-borderGray" />
          <LoadingButton
            type="button"
            onClick={() => removeItem(line.productId, line.variant)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 sm:text-sm"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Remove
          </LoadingButton>
        </div>
      </div>
    </article>
  );
}

function Recommendations({ excludeIds }: { excludeIds: string[] }) {
  const [products, setProducts] = useState<ProductCardData[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products?limit=12&inStock=true", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.products)) setProducts(data.products);
      })
      .catch(() => {
        /* Recommendations are optional; the cart works without them. */
      });
    return () => controller.abort();
  }, []);

  const visible = products.filter((product) => !excludeIds.includes(String(product._id))).slice(0, 4);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="cart-recommendations" className="mt-8 sm:mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="cart-recommendations" className="text-xl font-bold text-darkText sm:text-2xl">
          You might also like
        </h2>
        <Link href="/products" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-admin-primary hover:underline">
          View all <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {visible.map((product) => (
          <HomeProductCard key={String(product._id)} product={product} />
        ))}
      </div>
    </section>
  );
}

export default function CartPage() {
  const router = useRouter();
  const { items, subtotal, totalQty } = useCart();
  const { requireCustomer } = useCustomerAuth();
  const empty = items.length === 0;
  const itemLabel = `${totalQty} ${totalQty === 1 ? "item" : "items"}`;

  return (
    <div className="mx-auto max-w-site px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-3xl font-extrabold text-darkText sm:text-4xl">Your Cart</h1>
        <p className="mt-1 text-sm text-darkText/60 sm:text-md">{itemLabel} in your cart</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <div className="min-w-0">
          {empty ? (
            <div className="flex flex-col items-center rounded-card border border-borderGray bg-white px-6 py-14 text-center shadow-xs">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-admin-primary">
                <ShoppingCart aria-hidden="true" className="h-6 w-6" />
              </span>
              <p className="text-lg font-bold text-darkText">Your cart is empty</p>
              <p className="mt-1 text-sm text-darkText/60">Browse products and add something you like.</p>
              <Link
                href="/products"
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-admin-primary px-5 font-semibold text-white hover:bg-admin-dark"
              >
                Start shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {items.map((line) => (
                <CartItem key={`${line.productId}-${line.variant || ""}`} line={line} />
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-card border border-borderGray bg-white p-5 shadow-card sm:p-6 lg:sticky lg:top-28 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <h2 className="mb-4 text-xl font-bold text-darkText sm:text-2xl">Order Summary</h2>
          <dl className="space-y-3 text-sm sm:text-md">
            <div className="flex justify-between gap-4">
              <dt className="text-darkText/70">Subtotal ({itemLabel})</dt>
              <dd className="font-semibold text-darkText">{formatPKR(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-darkText/70">Delivery &amp; fees</dt>
              <dd className="text-right text-darkText/60">Calculated at checkout</dd>
            </div>
          </dl>
          <div className="my-4 border-t border-borderGray" />
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-lg font-bold text-darkText">Total</span>
            <span className="text-xl font-extrabold text-admin-primary sm:text-2xl">{formatPKR(subtotal)}</span>
          </div>
          <LoadingButton
            type="button"
            disabled={empty}
            onClick={() => requireCustomer(() => router.push("/checkout"), "signup")}
            className={`mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-md font-bold transition-colors ${
              empty
                ? "cursor-not-allowed bg-darkText/10 text-darkText/40"
                : "bg-brand-primary text-admin-dark hover:bg-brand-hover"
            }`}
          >
            Proceed to Checkout
            <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </LoadingButton>

          <ul className="mt-5 grid grid-cols-2 divide-x divide-borderGray border-t border-borderGray pt-5 text-center">
            <li className="flex flex-col items-center gap-1.5 px-2">
              <Banknote aria-hidden="true" className="h-6 w-6 text-admin-primary" />
              <span className="text-xs font-semibold text-darkText sm:text-sm">Cash on Delivery</span>
              <span className="text-tiny text-darkText/55">In eligible cities</span>
            </li>
            <li className="px-2">
              <Link href="/return-policy" className="flex flex-col items-center gap-1.5 hover:underline">
                <RotateCcw aria-hidden="true" className="h-6 w-6 text-admin-primary" />
                <span className="text-xs font-semibold text-darkText sm:text-sm">Easy Returns</span>
                <span className="text-tiny text-darkText/55">See return policy</span>
              </Link>
            </li>
          </ul>
        </aside>

        <div className="min-w-0 lg:col-start-1">
          <Recommendations excludeIds={items.map((line) => line.productId)} />
        </div>
      </div>
    </div>
  );
}
