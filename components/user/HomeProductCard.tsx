"use client";

import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { ArrowRight, Heart, ImageOff, ShoppingCart, Star } from "lucide-react";
import Link from "@/components/ui/LoadingLink";
import { useCart } from "@/context/CartContext";
import { useSavedProducts } from "@/lib/use-saved-products";
import { formatPKR } from "@/lib/format";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import { displayDiscount } from "@/lib/product-discount";
import { showCartSuccessToast } from "@/lib/cart-success-toast";
import type { ProductCardData } from "./ProductCard";

/** Grid shared by every home product row: two columns on mobile. */
export const HOME_PRODUCT_GRID = "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
/** "View all products" / "View more" pill used in every home product row header. */
export const HOME_VIEW_BUTTON = "shrink-0 whitespace-nowrap rounded-lg bg-lime-100 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-lime-200 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm";
const SIZES = "(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw";
// Lift and green border only where a real pointer can hover; touch gets a press effect instead.
const hoverLift = "[@media(hover:hover)]:hover:-translate-y-[3px] [@media(hover:hover)]:hover:border-emerald-400 [@media(hover:hover)]:hover:shadow-[0_10px_24px_rgba(17,17,17,.08)]";

const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;
const card = "relative isolate flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E3EBDB] bg-white shadow-[0_2px_8px_rgba(17,17,17,.04)]";

/**
 * Compact product card shared by the home product rows (Featured Products, New Arrivals). Other pages keep
 * the original ProductCard; this one reuses the same cart and wishlist hooks so behaviour stays identical.
 * `showNewTag` adds a "New" tag for products created in the last 14 days.
 */
export const HomeProductCard = memo(function HomeProductCard({ product, showNewTag = false }: { product: ProductCardData & { createdAt?: string | Date }; showNewTag?: boolean }) {
  const { items, addItem } = useCart();
  const { ids, toggle, saving, loading: savedLoading } = useSavedProducts();
  const [imageFailed, setImageFailed] = useState(false);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);
  const id = String(product._id);
  const saved = ids.includes(id);
  const image = !imageFailed ? product.images?.[0] : undefined;
  const href = product.href || `/products/${id}`;

  // Worked out from the prices, never the stored discountPercent (which produced "0%" and "-100%" badges).
  const discount = displayDiscount(product.price, product.originalPrice);
  const isNew = showNewTag && !!product.createdAt && Date.now() - new Date(product.createdAt).getTime() < NEW_FOR_MS;
  const reviews = Math.max(0, Math.floor(Number(product.reviewCount) || 0));
  const rating = Math.max(0, Math.min(5, Number(product.ratingAvg) || 0));

  const available = product.available !== false;
  const stockKnown = typeof product.stock === "number" && Number.isFinite(product.stock);
  const maxStock = stockKnown ? Math.max(0, Number(product.stock)) : 99;
  const canAdd = available && (stockKnown ? maxStock > 0 : product.inStock !== false);
  const variants = Array.isArray(product.variants) ? product.variants.filter(Boolean) : [];
  const requiresVariant = variants.length > 1;
  const variant = variants.length === 1 ? variants[0] : undefined;
  const existing = items.find(line => line.productId === id && (line.variant || "") === (variant || ""));

  function addToCart() {
    if (!canAdd || requiresVariant) return;
    if (existing && existing.quantity >= maxStock) { toast.error("You already have all available stock in your cart."); return; }
    addItem({ productId: id, name: product.name, price: product.price, image: product.images?.[0] || "/logo.png", maxStock, variant, quantity: Math.min((existing?.quantity || 0) + 1, maxStock) });
    setAdded(true);
    showCartSuccessToast();
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1400);
  }

  const button = "flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition active:scale-[0.97] sm:h-9 sm:text-[13px]";
  return <article data-product-card={id} className={`group ${card} transition duration-200 active:scale-[0.99] ${hoverLift}`}>
    <div className="relative p-2 pb-0">
      <Link href={href} tabIndex={-1} aria-hidden="true" className={`relative block aspect-square overflow-hidden rounded-xl bg-neutral-50 ${canAdd ? "" : "opacity-60"}`}>
        <span className="absolute inset-0 flex items-center justify-center p-1.5">
          {/* Keep every product image within the same square frame. */}
          {image
            ? <Image src={image} alt="" fill sizes={SIZES} loading="lazy" unoptimized={shouldUnoptimizeImageSrc(image)} onError={() => setImageFailed(true)} className="object-contain p-2" />
            : <ImageOff className="h-8 w-8 text-neutral-300" aria-hidden="true" />}
        </span>
      </Link>
      {(discount || isNew) && <span className="pointer-events-none absolute left-3.5 top-3.5 flex flex-col items-start gap-1">
        {discount && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold text-red-600 sm:text-[11px]">-{discount.percent}%</span>}
        {isNew && <span className="rounded-full bg-lime-100 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-800 sm:text-[11px]">New</span>}
      </span>}
      <button type="button" onClick={() => void toggle(id)} disabled={savedLoading || saving} aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name} to saved items`} title={saved ? "Remove from saved items" : "Add to saved items"}
        className="absolute right-3.5 top-3.5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-neutral-500 shadow-sm transition hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-60">
        <Heart className={`h-3.5 w-3.5 ${saved ? "fill-red-500 text-red-500" : ""}`} aria-hidden="true" />
      </button>
    </div>

    <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
      <p className="h-4 truncate text-[10.5px] text-neutral-500 sm:text-[11px]">{product.category || "\u00a0"}</p>
      <Link href={href} title={product.name} className="line-clamp-2 min-h-[2.5em] break-words text-xs font-medium leading-[1.25] text-neutral-900 first-letter:uppercase hover:text-emerald-800 after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-emerald-700 sm:text-sm">{product.name}</Link>
      <div className="flex min-h-10 min-w-0 flex-col justify-start leading-5">
        <span className="max-w-full break-words text-[13px] font-bold text-emerald-700 sm:text-base" title={formatPKR(product.price)}>{formatPKR(product.price)}</span>
        {discount && <del className="max-w-full break-words text-[11px] text-neutral-400 sm:text-xs">{formatPKR(discount.original)}</del>}
      </div>
      {/* Same row height with or without reviews keeps every card in a row aligned. */}
      <div className="flex h-4 items-center gap-1 text-[11px]">
        {reviews > 0
          ? <span className="flex items-center gap-1 text-neutral-700" title={`${rating.toFixed(1)} out of 5 from ${reviews} reviews`}><Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />{rating.toFixed(1)}<span className="text-neutral-400">({reviews.toLocaleString("en-PK")})</span></span>
          : <span className="text-neutral-400">No reviews yet</span>}
      </div>
      <div className="mt-auto pt-1.5">
        {requiresVariant && canAdd
          ? <Link href={href} className={`${button} relative z-20 bg-brand-primary text-brand-dark hover:brightness-95`}>Select Options <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          : <button type="button" onClick={addToCart} disabled={!canAdd} className={`${button} relative z-20 ${canAdd ? "bg-brand-primary text-brand-dark hover:brightness-95" : "cursor-not-allowed bg-neutral-100 text-neutral-500"}`}>
              {canAdd ? added ? <span role="status">Added ✓</span> : <><ShoppingCart className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">Add to Cart</span></> : "Out of stock"}
            </button>}
      </div>
    </div>
  </article>;
});

/** Placeholder with the same shape as HomeProductCard, for rows that are still loading. */
export function HomeProductCardSkeleton() {
  return <div className={card} aria-hidden="true">
    <div className="p-2 pb-0"><div className="aspect-square animate-pulse rounded-xl bg-neutral-100" /></div>
    <div className="flex flex-1 flex-col gap-2 p-2.5">
      <span className="h-2.5 w-1/3 animate-pulse rounded bg-neutral-100" />
      <span className="h-3 w-11/12 animate-pulse rounded bg-neutral-100" /><span className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" />
      <span className="h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
      <span className="mt-auto h-10 w-full animate-pulse rounded-lg bg-neutral-100 sm:h-9" />
    </div>
  </div>;
}
