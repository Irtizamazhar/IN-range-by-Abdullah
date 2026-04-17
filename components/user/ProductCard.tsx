"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { formatPKR } from "@/lib/format";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

const DARAZ_ORANGE = "#F57224";

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
  /** For Add to Cart max quantity; omit only when stock is unknown */
  stock?: number;
  /** When stock is 0/unknown, still allow add if true (e.g. legacy new-arrival rows) */
  inStock?: boolean;
  variants?: string[];
};

/** Daraz PLP-style: tight yellow ★ row + (review count) only, under price. */
function DarazStyleRatingRow({
  rating,
  count,
}: {
  rating: number;
  count: number;
}) {
  const avg = Math.min(5, Math.max(0, Number(rating) || 0));
  const filled = Math.min(5, Math.max(0, Math.round(avg)));
  const aria = `Average ${avg.toFixed(1)} of 5 stars, ${count} reviews`;

  return (
    <div className="mt-1 flex items-center gap-1" aria-label={aria}>
      <span
        className="inline-flex shrink-0 items-center text-[13px] leading-none"
        style={{ letterSpacing: "-0.14em" }}
        aria-hidden
      >
        {([0, 1, 2, 3, 4] as const).map((i) => (
          <span
            key={i}
            className={
              i < filled
                ? "text-[#FFC400] drop-shadow-[0_0_0.5px_rgba(255,183,0,0.35)]"
                : "text-[#e5e5e5]"
            }
          >
            ★
          </span>
        ))}
      </span>
      <span className="text-[12px] font-normal leading-none text-[#9e9e9e]">
        ({count})
      </span>
    </div>
  );
}

export const ProductCard = memo(function ProductCard({
  product,
  ribbon,
  badgePosition = "left",
}: {
  product: ProductCardData;
  /** Small label on image, e.g. &quot;NEW&quot; / &quot;Pack of 2&quot; */
  ribbon?: string;
  badgePosition?: "left" | "right";
}) {
  const img = product.images?.[0];
  const imgLocal = Boolean(img && shouldUnoptimizeImageSrc(img));
  const hasDiscount =
    Boolean(product.originalPrice && product.originalPrice > product.price);
  const discountPct =
    product.discountPercent ??
    (hasDiscount && product.originalPrice
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0);
  const detailHref = product.href || `/products/${product._id}`;
  const reviews = Math.max(0, Math.floor(Number(product.reviewCount) || 0));
  const ratingAvg = Number(product.ratingAvg) || 0;
  /** Approved reviews only (API); show Daraz-style row whenever count > 0. */
  const showReviews = reviews > 0;

  const badgeAnchor =
    badgePosition === "right" ? "right-2 top-2" : "left-2 top-2";

  return (
    <Link
      href={detailHref}
      className="flex min-w-0 flex-col overflow-hidden rounded-[4px] border-[0.5px] border-[#e8e8e8] bg-white transition-shadow duration-200 outline-none hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
    >
      <div className="relative aspect-square w-full bg-white">
        {img ? (
          <Image
            src={img}
            alt={product.name || "Product"}
            fill
            unoptimized={imgLocal}
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 16vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-white text-sm text-[#999]">
            No image
          </div>
        )}
        {ribbon ? (
          <span
            className={`absolute ${badgeAnchor} z-10 max-w-[calc(100%-1rem)] truncate rounded-sm bg-[#F57224] px-1.5 py-0.5 text-tiny font-medium leading-tight text-white`}
          >
            {ribbon}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 px-[10px] pb-2 pt-2">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-[#333]">
          {product.name}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className="text-lg font-bold leading-tight"
            style={{ color: DARAZ_ORANGE }}
          >
            {formatPKR(product.price)}
          </span>
          {hasDiscount && discountPct > 0 ? (
            <span
              className="text-[11px] font-bold leading-tight"
              style={{ color: DARAZ_ORANGE }}
            >
              -{discountPct}%
            </span>
          ) : null}
        </div>
        {showReviews ? (
          <DarazStyleRatingRow rating={ratingAvg} count={reviews} />
        ) : null}
      </div>
    </Link>
  );
});

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[4px] border-[0.5px] border-[#e8e8e8] bg-white animate-pulse">
      <div className="aspect-square w-full bg-[#f0f0f0]" />
      <div className="space-y-2 px-[10px] py-2">
        <div className="h-3.5 rounded-sm bg-[#e8e8e8]" />
        <div className="h-3.5 w-4/5 rounded-sm bg-[#e8e8e8]" />
        <div className="h-4 w-1/2 rounded-sm bg-[#e8e8e8]" />
        <div className="h-3 w-1/3 rounded-sm bg-[#e8e8e8]" />
      </div>
    </div>
  );
}
