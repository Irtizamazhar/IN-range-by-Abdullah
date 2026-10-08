"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { memo, type CSSProperties } from "react";
import { ArrowRight, Heart, ShoppingCart, Star } from "lucide-react";

import { useCart } from "@/context/CartContext";
import { useSavedProducts } from "@/lib/use-saved-products";
import { formatPKR } from "@/lib/format";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import styles from "./ProductCard.module.css";

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
  available?: boolean;
  variants?: string[];
};

function ProductRating({ rating, count }: { rating: number; count: number }) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const label = `${safeRating.toFixed(1)} out of 5 from ${count.toLocaleString("en-PK")} reviews`;

  return (
    <span className={styles.rating} aria-label={label} title={label}>
      <Star aria-hidden="true" className={styles.star} />
      <span>{safeRating.toFixed(1)}</span>
      <span className={styles.reviewCount}>
        ({count.toLocaleString("en-PK", { notation: "compact", maximumFractionDigits: 1 })})
      </span>
    </span>
  );
}

function MarketplaceRating({ rating, count }: { rating: number; count: number }) {
  const safeRating = count > 0 ? Math.max(0, Math.min(5, Number(rating) || 0)) : 0;
  const label = `${safeRating.toFixed(1)} out of 5 from ${count.toLocaleString("en-PK")} reviews`;

  return (
    <div className={styles.marketplaceRating} role="img" aria-label={label} title={label}>
      <span className={styles.ratingStars} aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={styles.ratingStar}>
            <Star className={styles.emptyStar} />
            <span className={styles.starFill} style={{ width: `${Math.max(0, Math.min(1, safeRating - index)) * 100}%` }}>
              <Star />
            </span>
          </span>
        ))}
      </span>
      <span className={styles.marketplaceReviewCount} aria-hidden="true">({count.toLocaleString("en-PK")})</span>
    </div>
  );
}

export const ProductCard = memo(function ProductCard({
  product,
  ribbon,
  variant: presentation = "marketplace",
}: {
  product: ProductCardData;
  ribbon?: string;
  badgePosition?: "left" | "right";
  variant?: "default" | "featured" | "compact" | "marketplace";
}) {
  const { items, addItem } = useCart();
  const { ids, toggle, saving, loading: savedLoading } = useSavedProducts();
  const saved = ids.includes(String(product._id));
  const image = product.images?.[0];
  const available = product.available !== false;
  const detailHref = product.href || `/products/${product._id}`;
  const hasDiscount = Boolean(product.originalPrice && product.originalPrice > product.price);
  const discountPercent = product.discountPercent ??
    (hasDiscount && product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0);
  const reviews = Math.max(0, Math.floor(Number(product.reviewCount) || 0));
  const rating = Number(product.ratingAvg) || 0;
  const marketplace = presentation === "marketplace";
  const marketplaceDiscount = Math.max(0, Math.round(Number(discountPercent) || 0));
  const marketplaceDiscountLabel = marketplaceDiscount > 0 ? `-${marketplaceDiscount}%` : "0%";

  const stockKnown = typeof product.stock === "number" && Number.isFinite(product.stock);
  const maxStock = stockKnown ? Math.max(0, Number(product.stock)) : 99;
  const canAdd = available && (stockKnown ? maxStock > 0 : product.inStock !== false);
  const availability = !canAdd ? "out" : stockKnown || product.inStock === true ? "in" : "unknown";
  const stockLabel = availability === "out" ? "Out of stock" : availability === "in" ? "In stock" : "Check availability";
  const variants = Array.isArray(product.variants) ? product.variants.filter(Boolean) : [];
  const requiresVariant = variants.length > 1;
  const variant = variants.length === 1 ? variants[0] : undefined;
  const existing = items.find((line) =>
    line.productId === String(product._id) && (line.variant || "") === (variant || "")
  );
  const currentPrice = formatPKR(product.price);
  // Keep the full amount readable in narrow cards, including the catalog's largest prices.
  const priceStyle = { "--price-fit": Math.max(8, currentPrice.length * 0.62) } as CSSProperties;
  const imageContent = image ? (
    <Image
      src={image}
      alt={product.name}
      fill
      unoptimized={shouldUnoptimizeImageSrc(image)}
      sizes={presentation === "featured"
        ? "(max-width: 359px) 90vw, (max-width: 639px) 46vw, 280px"
        : presentation === "compact"
        ? "(max-width: 639px) 47vw, (max-width: 1023px) 31vw, (max-width: 1279px) 21vw, 240px"
        : marketplace
        ? "(max-width: 639px) 47vw, (max-width: 1023px) 31vw, 17vw"
        : "(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc((100vw - 64px) / 2), 280px"}
      className={styles.image}
    />
  ) : (
    <span className={styles.imagePlaceholder}>Product image</span>
  );

  function handleAddToCart() {
    if (!canAdd || requiresVariant) return;
    addItem({
      productId: String(product._id),
      name: product.name,
      price: product.price,
      image: image || "/branding/joro-logo.png",
      maxStock,
      variant,
      quantity: Math.min((existing?.quantity || 0) + 1, maxStock),
    });
  }

  return (
    <article
      data-product-card={product._id}
      data-variant={presentation}
      className={`${styles.card}${presentation === "default" ? "" : ` ${styles[presentation]}`}`}
    >
      <div data-product-image className={styles.media}>
        {available ? (
          <Link
            href={detailHref}
            className={styles.imageLink}
            aria-label={`View ${product.name}`}
            aria-hidden={marketplace || undefined}
            tabIndex={marketplace ? -1 : undefined}
          >
            {imageContent}
            <span data-product-view className={styles.viewHint} aria-hidden="true">View</span>
          </Link>
        ) : (
          <div className={styles.imageLink}>{imageContent}</div>
        )}
        {marketplace || discountPercent > 0 ? (
          <span className={styles.badge}>{marketplace ? marketplaceDiscountLabel : `-${discountPercent}%`}</span>
        ) : ribbon ? (
          <span className={styles.badge}>{ribbon}</span>
        ) : null}
        <LoadingButton
          type="button"
          onClick={() => toggle(String(product._id))}
          loading={saving} loadingLabel="Saving…" disabled={savedLoading}
          aria-label={saved ? `Remove ${product.name} from saved products` : `Save ${product.name}`}
          title={saved ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={saved}
          className={styles.wishlist}
        >
          <Heart aria-hidden="true" className={saved ? styles.savedHeart : undefined} />
        </LoadingButton>
      </div>

      <div className={styles.body}>
        {!marketplace && (
          <div data-product-category className={styles.categoryRow}>
            <p className={styles.category} title={product.category || "Marketplace"}>
              {product.category || "Marketplace"}
            </p>
            {reviews > 0 && <ProductRating rating={rating} count={reviews} />}
          </div>
        )}
        {available ? (
          <Link
            href={detailHref}
            className={styles.titleLink}
            title={product.name}
            aria-label={marketplace ? `${product.name}, ${stockLabel}` : undefined}
          >
            <h3 data-product-title className={styles.title}>{product.name}</h3>
          </Link>
        ) : (
          <div className={styles.titleLink} title={product.name}>
            <h3 data-product-title className={styles.title}>{product.name}</h3>
          </div>
        )}

        <div data-product-price className={styles.price}>
          <span data-product-current-price className={styles.currentPrice} style={priceStyle}>
            {currentPrice}
          </span>
          {marketplace ? (
            <span className={styles.marketplaceDiscount}>{marketplaceDiscountLabel}</span>
          ) : (
            <span data-product-original-price className={styles.originalPrice} aria-hidden={!hasDiscount}>
              {hasDiscount && product.originalPrice ? <del>{formatPKR(product.originalPrice)}</del> : null}
            </span>
          )}
        </div>

        {!available ? (
          <p className={styles.unavailable}>Currently unavailable.</p>
        ) : marketplace ? (
          <MarketplaceRating rating={rating} count={reviews} />
        ) : (
          <p data-product-stock data-availability={availability} className={styles.stock}>
            <span aria-hidden="true" className={styles.stockDot} />
            {stockLabel}
          </p>
        )}

        <div data-product-actions className={styles.actions}>
          {!available ? (
            <LoadingButton
              type="button"
              loading={saving} loadingLabel="Saving…" disabled={savedLoading || !saved}
              onClick={() => toggle(String(product._id))}
              className={styles.action}
            >
              Unsave product
            </LoadingButton>
          ) : requiresVariant && canAdd ? (
            <Link href={detailHref} className={styles.action}>
              View Options <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <LoadingButton type="button" disabled={!canAdd} onClick={handleAddToCart} className={styles.action}>
              <ShoppingCart aria-hidden="true" />
              {canAdd ? "Add to Cart" : "Out of Stock"}
            </LoadingButton>
          )}
        </div>
      </div>
    </article>
  );
});

export function ProductCardSkeleton({ variant = "marketplace" }: { variant?: "default" | "featured" | "compact" | "marketplace" } = {}) {
  const marketplace = variant === "marketplace";
  return (
    <div
      className={`${styles.card} ${styles.skeleton}${variant === "default" ? "" : ` ${styles[variant]}`}`}
      data-variant={variant}
      aria-hidden="true"
    >
      <div className={styles.media}>
        <div className={`${styles.imageLink} ${styles.placeholder}`} />
      </div>
      <div className={styles.body}>
        {!marketplace && <div className={styles.categoryRow}><span className={styles.placeholder} style={{ width: "42%", height: 12 }} /></div>}
        <div className={styles.titleLink}>
          <div className={styles.title}>
            <span className={styles.placeholder} style={{ width: "92%", height: 12, marginTop: 4 }} />
            <span className={styles.placeholder} style={{ width: "70%", height: 12, marginTop: 8 }} />
          </div>
        </div>
        <div className={styles.price}>
          <div className={styles.currentPrice}><span className={styles.placeholder} style={{ width: marketplace ? "100%" : "55%", height: marketplace ? 16 : 21 }} /></div>
          {marketplace
            ? <span className={styles.placeholder} style={{ width: "20%", height: 12 }} />
            : <div className={styles.originalPrice}><span className={styles.placeholder} style={{ width: "35%", height: 12, marginTop: 4 }} /></div>}
        </div>
        {marketplace
          ? <div className={styles.marketplaceRating}><span className={styles.placeholder} style={{ width: "65%", height: 12 }} /></div>
          : <div className={styles.stock}><span className={styles.placeholder} style={{ width: "40%", height: 11 }} /></div>}
        <div className={styles.actions}><span className={`${styles.action} ${styles.placeholder}`} /></div>
      </div>
    </div>
  );
}
