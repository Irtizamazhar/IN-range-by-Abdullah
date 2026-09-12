"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import {
  ArrowRight,
  ShoppingCart,
  Star,
} from "lucide-react";

import { useCart } from "@/context/CartContext";
import { formatPKR } from "@/lib/format";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

export type ProductCardData = {
  _id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  images: string[];
  category: string;
  href?: string;
  ratingAvg?: number;
  reviewCount?: number;
  stock?: number;
  inStock?: boolean;
  variants?: string[];
};

function ProductRating({
  rating,
  count,
}: {
  rating: number;
  count: number;
}) {
  const safeRating = Math.max(
    0,
    Math.min(5, Number(rating) || 0)
  );

  return (
    <div className="flex items-center gap-1">
      <Star className="h-3 w-3 fill-[#F5A623] text-[#F5A623]" />

      <span className="text-[10px] font-bold text-brand-dark">
        {safeRating.toFixed(1)}
      </span>

      <span className="text-[9px] font-medium text-black/35">
        ({count})
      </span>
    </div>
  );
}

export const ProductCard = memo(function ProductCard({
  product,
  ribbon,
}: {
  product: ProductCardData;
  ribbon?: string;
  badgePosition?: "left" | "right";
}) {
  const { items, addItem } = useCart();

  const image =
    product.images?.[0];

  const imageLocal =
    Boolean(
      image &&
        shouldUnoptimizeImageSrc(
          image
        )
    );

  const detailHref =
    product.href ||
    `/products/${product._id}`;

  const hasDiscount =
    Boolean(
      product.originalPrice &&
        product.originalPrice >
          product.price
    );

  const discountPercent =
    product.discountPercent ??
    (hasDiscount &&
    product.originalPrice
      ? Math.round(
          (1 -
            product.price /
              product.originalPrice) *
            100
        )
      : 0);

  const reviews = Math.max(
    0,
    Math.floor(
      Number(
        product.reviewCount
      ) || 0
    )
  );

  const rating =
    Number(
      product.ratingAvg
    ) || 0;

  const stockKnown =
    typeof product.stock ===
    "number";

  const maxStock =
    stockKnown
      ? Math.max(
          0,
          Number(
            product.stock
          )
        )
      : 99;

  const canAdd =
    stockKnown
      ? maxStock > 0
      : product.inStock !==
        false;

  const variants =
    Array.isArray(
      product.variants
    )
      ? product.variants.filter(
          Boolean
        )
      : [];

  const requiresVariant =
    variants.length > 1;

  const variant =
    variants.length === 1
      ? variants[0]
      : undefined;

  const existing =
    items.find(
      (line) =>
        line.productId ===
          String(
            product._id
          ) &&
        (line.variant || "") ===
          (variant || "")
    );

  function handleAddToCart() {
    if (
      !canAdd ||
      requiresVariant
    ) {
      return;
    }

    const currentQuantity =
      existing?.quantity ||
      0;

    addItem({
      productId:
        String(
          product._id
        ),

      name:
        product.name,

      price:
        product.price,

      image:
        image ||
        "/logo.png",

      maxStock,

      variant,

      quantity:
        Math.min(
          currentQuantity +
            1,
          maxStock
        ),
    });
  }

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-xs transition-all duration-250 hover:-translate-y-0.5 hover:border-brand-primary/40 hover:shadow-cardHover">
      {/* IMAGE */}

      <Link
        href={detailHref}
        className="block"
      >
        <div className="relative h-[145px] overflow-hidden bg-gradient-to-b from-[#FBFCF9] to-[#F5F7F1] sm:h-[155px]">
          {image ? (
            <Image
              src={image}
              alt={
                product.name
              }
              fill
              unoptimized={
                imageLocal
              }
              sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 18vw"
              className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] font-semibold text-black/25">
              Product image
            </div>
          )}

          {discountPercent >
          0 ? (
            <span className="absolute left-2 top-2 rounded-full bg-brand-primary px-2 py-1 text-[9px] font-black text-brand-dark">
              -
              {
                discountPercent
              }
              %
            </span>
          ) : ribbon ? (
            <span className="absolute left-2 top-2 rounded-full bg-brand-primary px-2 py-1 text-[9px] font-black text-brand-dark">
              {ribbon}
            </span>
          ) : null}
        </div>
      </Link>

      {/* CONTENT */}

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.07em] text-brand-link/70">
          {product.category ||
            "Marketplace"}
        </p>

        <Link
          href={
            detailHref
          }
        >
          <h3 className="mt-1 line-clamp-2 min-h-[34px] text-[12px] font-bold leading-[17px] text-brand-dark transition group-hover:text-brand-link">
            {
              product.name
            }
          </h3>
        </Link>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
          <span className="text-[16px] font-black leading-none text-brand-dark">
            {formatPKR(
              product.price
            )}
          </span>

          {hasDiscount &&
          product.originalPrice ? (
            <span className="text-[9px] font-medium text-black/30 line-through">
              {formatPKR(
                product.originalPrice
              )}
            </span>
          ) : null}
        </div>

        <div className="mt-1.5 min-h-[16px]">
          {reviews > 0 ? (
            <ProductRating
              rating={
                rating
              }
              count={
                reviews
              }
            />
          ) : (
            <span className="text-[9px] font-medium text-black/35">
              Available now
            </span>
          )}
        </div>

        <div className="mt-2">
          {requiresVariant ? (
            <Link
              href={
                detailHref
              }
              className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-brand-dark text-[10px] font-bold text-white transition hover:bg-brand-primary hover:text-brand-dark"
            >
              View Options

              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            <button
              type="button"
              disabled={
                !canAdd
              }
              onClick={
                handleAddToCart
              }
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-primary text-[10px] font-bold text-brand-dark transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-black/[0.06] disabled:text-black/30"
            >
              <ShoppingCart className="h-3.5 w-3.5" />

              {canAdd
                ? "Add to Cart"
                : "Out of Stock"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

/* =========================================================
   COMPACT SKELETON
========================================================= */

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-black/[0.055] bg-white shadow-xs">
      <div className="h-[145px] animate-pulse bg-[#F3F4F0] sm:h-[155px]" />

      <div className="space-y-2 p-3">
        <div className="h-2 w-1/3 animate-pulse rounded-full bg-black/[0.06]" />

        <div className="h-3 animate-pulse rounded-full bg-black/[0.07]" />

        <div className="h-3 w-4/5 animate-pulse rounded-full bg-black/[0.07]" />

        <div className="h-4 w-1/2 animate-pulse rounded-full bg-black/[0.08]" />

        <div className="h-3 w-1/3 animate-pulse rounded-full bg-black/[0.05]" />

        <div className="h-8 animate-pulse rounded-lg bg-black/[0.06]" />
      </div>
    </div>
  );
}