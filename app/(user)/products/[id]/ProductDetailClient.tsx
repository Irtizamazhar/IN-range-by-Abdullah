"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ProductServices } from "@/components/user/ProductServices";
import { SaveProductButton } from "@/components/user/SaveProductButton";

import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { useEffect, useRef, useState } from "react";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import toast from "react-hot-toast";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  MapPin,
  Truck,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Minus,
  Plus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ProductCard, ProductCardData } from "@/components/user/ProductCard";
import { displayDiscount } from "@/lib/product-discount";
import gridStyles from "@/components/user/ProductGrid.module.css";
import {
  ProductApprovedReviewsList,
  type ReviewDisplayField,
} from "@/components/user/ProductApprovedReviewsList";
import { VerifiedOrderReviewSection } from "@/components/user/VerifiedOrderReviewSection";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";
import { showCartSuccessToast } from "@/lib/cart-success-toast";

function isLocalProductImageSrc(src: string) {
  return src.startsWith("/api/") || src.startsWith("/uploads/");
}
export type ProductDetailProduct = {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  images: string[];
  category: string;
  stock: number;
  variants: string[];
  ratingAvg?: number;
  reviewCount?: number;
  warrantyMonths?: number | null;
};

function StarRating({ rating }: { rating: number }) {
  const r = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={`h-4 w-4 ${i < r ? "fill-[#F5B301] text-[#F5B301]" : "fill-[#E5E7EB] text-[#E5E7EB]"}`}
        />
      ))}
    </span>
  );
}

function BreadcrumbChevron() {
  return (
    <li aria-hidden className="shrink-0 text-[#9CA3AF]">
      <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
    </li>
  );
}

function SideCard({
  icon: Icon,
  title,
  className = "",
  children,
}: {
  icon: LucideIcon;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-[#EEF0EC] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,16,0.04)] sm:p-5 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-[#111827]">
        <Icon className="h-5 w-5 shrink-0 text-[#0B3D20]" aria-hidden />
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SideItem({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F1] text-[#0B3D20]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[#111827]">{title}</p>
        <p className="text-[13px] leading-snug text-[#6B7280]">{subtitle}</p>
      </div>
    </div>
  );
}

export function ProductDetailClient({
  product,
  related,
  seller,
  reviewsPostField,
}: {
  product: ProductDetailProduct;
  related: ProductCardData[];
  seller?: { name: string; storeSlug: string | null; logo?: string | null } | null;
  /** Default: DB `productId`. Use `{ newArrivalId }` for JSON new-arrival detail. */
  reviewsPostField?: ReviewDisplayField;
}) {
  const [idx, setIdx] = useState(0);
  const [variant, setVariant] = useState<string | undefined>(
    product.variants?.[0]
  );
  type VolumeTier = 1 | 3 | 5;
  type BuyTierKey = "buy1" | "buy3" | "buy5";

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);

  const { addItem, clear } = useCart();
  const { requireCustomer } = useCustomerAuth();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#review") return;
    const t = window.setTimeout(() => {
      document.getElementById("review")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 200);
    return () => window.clearTimeout(t);
  }, []);

  const mainImg = product.images[idx] || product.images[0];
  const mainLocal = mainImg ? isLocalProductImageSrc(mainImg) : false;
  const hasDiscount =
    Boolean(product.originalPrice && product.originalPrice > product.price);
  const needsVariant = product.variants?.length > 0;

  const basePrice = product.price;

  const tierMeta = {
    1: {
      count: 1 as const,
      unitMultiplier: 1,
      badge: "Standard Price",
      strikeTotal: null as number | null,
    },
    3: {
      count: 3 as const,
      unitMultiplier: 0.9,
      badge: "10% OFF",
      strikeTotal: basePrice * 3,
    },
    5: {
      count: 5 as const,
      unitMultiplier: 0.88,
      badge: "12% OFF",
      strikeTotal: basePrice * 5,
    },
  } as const;

  const effectiveUnitPrice = (t: VolumeTier) =>
    Math.round(basePrice * tierMeta[t].unitMultiplier * 100) / 100;
  const lineTotal = (t: VolumeTier) =>
    Math.round(effectiveUnitPrice(t) * tierMeta[t].count * 100) / 100;

  const tierAvailable = (t: VolumeTier) => product.stock >= tierMeta[t].count;

  const selectedTierKey: BuyTierKey =
    quantity === 3 ? "buy3" : quantity === 5 ? "buy5" : "buy1";

  const tierNum: VolumeTier =
    selectedTierKey === "buy3" ? 3 : selectedTierKey === "buy5" ? 5 : 1;

  useEffect(() => {
    setQuantity((q) => {
      if (product.stock < 1) return q;
      return Math.min(Math.max(1, q), product.stock);
    });
  }, [product.stock]);

  const quantityClamped =
    product.stock < 1 ? 0 : Math.min(Math.max(1, quantity), product.stock);

  const unitPriceForCart = effectiveUnitPrice(tierNum);
  const totalUnits = quantityClamped;

  /** Headline totals: exact 3 / 5 use bundle line; any other qty uses standard × qty */
  const displayPrice =
    tierNum === 1
      ? basePrice * quantityClamped
      : lineTotal(tierNum);
  const displayOriginal =
    tierNum === 1
      ? hasDiscount
        ? product.originalPrice! * quantityClamped
        : null
      : hasDiscount
        ? product.originalPrice! * tierNum
        : tierMeta[tierNum].strikeTotal;
  const displayedDiscount = displayDiscount(displayPrice, displayOriginal);

  function validateAdd() {
    if (needsVariant && !variant) {
      toast.error("Please select a variant");
      return false;
    }
    if (product.stock < 1) {
      toast.error("Out of stock");
      return false;
    }
    if (totalUnits < 1 || quantityClamped < 1) {
      toast.error("Not enough stock for this selection");
      return false;
    }
    if (product.stock < totalUnits) {
      toast.error("Not enough stock for this selection");
      return false;
    }
    return true;
  }

  function handleAddCart() {
    if (!validateAdd()) return;
    return requireCustomer(() => {
      addItem({
        productId: product._id,
        name: product.name,
        price: unitPriceForCart,
        image: product.images[0] || "",
        maxStock: product.stock,
        variant,
        quantity: totalUnits,
      });
      setAdded(true);
      showCartSuccessToast();
      if (addedTimer.current) clearTimeout(addedTimer.current);
      addedTimer.current = setTimeout(() => setAdded(false), 1400);
    }, "signup");
  }

  function handleBuyNow() {
    if (!validateAdd()) return;
    return requireCustomer(() => {
      clear();
      addItem({
        productId: product._id,
        name: product.name,
        price: unitPriceForCart,
        image: product.images[0] || "",
        maxStock: product.stock,
        variant,
        quantity: totalUnits,
      });
      return router.push("/checkout");
    }, "signup");
  }

  const reviewsCount = Number(product.reviewCount || 0);
  const ratingAvg = Number(product.ratingAvg || 0);
  const detailDescription = (product.description ?? "").trim();
  const showDarazDetailBlock =
    detailDescription.length > 0 && product.images.length > 0;

  const imageCount = product.images.length;
  const showImage = (next: number) => {
    if (imageCount < 2) return;
    setIdx((next + imageCount) % imageCount);
  };
  const touchStartX = useRef<number | null>(null);
  const stockLabel = product.stock > 50 ? "50+" : String(product.stock);
  const shortDescription = detailDescription.replace(/\s+/g, " ");
  const buy1Discount = displayDiscount(basePrice, product.originalPrice);
  const actionsDisabled =
    product.stock < 1 || quantityClamped < 1 || quantityClamped > product.stock;
  const sellerName = seller?.name || "Marketplace listing";
  const storeHref = seller?.storeSlug
    ? `/stores/${encodeURIComponent(seller.storeSlug)}`
    : null;

  return (
    <div className="min-h-screen bg-[#F7F8F2]">
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-4 sm:mb-5">
          <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] text-[#6B7280] sm:text-[14px]">
            <li className="shrink-0">
              <Link href="/" className="hover:text-[#0B3D20]">Home</Link>
            </li>
            <BreadcrumbChevron />
            <li className="shrink-0">
              <Link href="/products" className="hover:text-[#0B3D20]">Shop Products</Link>
            </li>
            {product.category ? (
              <>
                <BreadcrumbChevron />
                <li className="min-w-0 max-w-[45%] truncate sm:max-w-none">
                  <Link
                    href={`/products?category=${encodeURIComponent(product.category)}`}
                    className="hover:text-[#0B3D20]"
                  >
                    {product.category}
                  </Link>
                </li>
              </>
            ) : null}
            <BreadcrumbChevron />
            <li aria-current="page" className="min-w-0 truncate font-medium text-[#111827]">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start md:gap-5 xl:grid-cols-[minmax(0,38fr)_minmax(0,35fr)_minmax(0,27fr)] xl:gap-5 2xl:gap-6">
          {/* LEFT — gallery */}
          <div className="min-w-0 rounded-2xl border border-[#EEF0EC] bg-white p-3 shadow-[0_1px_3px_rgba(16,24,16,0.04)] sm:p-4">
            <div
              className="relative aspect-[8/7] w-full overflow-hidden rounded-lg bg-[#F3F4F1]"
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => {
                const start = touchStartX.current;
                touchStartX.current = null;
                const end = e.changedTouches[0]?.clientX;
                if (start == null || end == null || Math.abs(end - start) < 40) return;
                showImage(end < start ? idx + 1 : idx - 1);
              }}
            >
              {mainImg ? (
                <Image
                  src={mainImg}
                  alt={product.name}
                  fill
                  unoptimized={!!mainLocal}
                  className="object-cover object-center"
                  priority
                  sizes="(max-width:767px) 100vw, (max-width:1279px) 50vw, 520px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">
                  No image
                </div>
              )}
              <SaveProductButton
                productId={product._id}
                name={product.name}
                variant="icon"
                className="absolute right-3 top-3"
              />
              {imageCount > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => showImage(idx - 1)}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center sm:left-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0B3D20] shadow-md sm:h-10 sm:w-10">
                      <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => showImage(idx + 1)}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center sm:right-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0B3D20] shadow-md sm:h-10 sm:w-10">
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                  </button>
                </>
              ) : null}
            </div>
            {imageCount > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {product.images.map((im, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`Show image ${i + 1}`}
                    aria-current={idx === i}
                    className={`relative aspect-square min-w-[60px] shrink-0 basis-[calc((100%-2rem)/5)] overflow-hidden rounded-md border-2 bg-[#F3F4F1] transition-colors ${
                      idx === i ? "border-[#0B3D20]" : "border-transparent hover:border-[#C9D3C4]"
                    }`}
                  >
                    <Image
                      src={im}
                      alt=""
                      fill
                      unoptimized={isLocalProductImageSrc(im)}
                      className="object-cover"
                      sizes="96px"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* MIDDLE — product info */}
          <div className="min-w-0 rounded-2xl border border-[#EEF0EC] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,16,0.04)] sm:p-6">
            {product.stock > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5E0] px-3 py-1 text-[12px] font-semibold text-[#2F7A12]">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                In Stock
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[12px] font-semibold text-red-700">
                Out of Stock
              </span>
            )}

            <h1 className="mt-3 break-words text-[22px] font-bold leading-tight text-[#0B3D20] sm:text-[26px] xl:text-[28px]">
              {product.name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
              {reviewsCount > 0 ? (
                <>
                  <StarRating rating={ratingAvg} />
                  <span className="font-semibold text-[#111827]">
                    {(Math.round(ratingAvg * 10) / 10).toFixed(1)}
                  </span>
                  <a href="#review" className="text-[#6B7280] hover:text-[#0B3D20]">
                    ({reviewsCount} {reviewsCount === 1 ? "review" : "reviews"})
                  </a>
                </>
              ) : (
                <span className="text-[#6B7280]">No ratings yet</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-[26px] font-bold leading-none text-[#0B3D20] sm:text-[32px]">
                {formatPKR(displayPrice)}
              </span>
              {displayOriginal != null ? (
                <span className="text-[15px] text-[#9CA3AF] line-through sm:text-[17px]">
                  {formatPKR(displayOriginal)}
                </span>
              ) : null}
              {displayedDiscount ? (
                <span className="rounded-full bg-[#ECF7D4] px-2.5 py-1 text-[12px] font-bold text-[#2F7A12]">
                  {displayedDiscount.percent}% OFF
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-[12px] text-[#6B7280]">Inclusive of all taxes</p>

            {shortDescription ? (
              <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-[#6B7280]">
                {shortDescription}
              </p>
            ) : null}

            {product.variants?.length ? (
              <div className="mt-5">
                <p className="mb-2 text-[14px] font-semibold text-[#111827]">Color Family</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVariant(v)}
                      aria-pressed={variant === v}
                      className={`min-h-11 rounded-md border px-3.5 text-[13px] font-medium transition-colors ${
                        variant === v
                          ? "border-[#A6D63A] bg-[#F3FADF] text-[#0B3D20]"
                          : "border-[#E5E7EB] bg-white text-[#111827] hover:border-[#C9D3C4]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <p className="mb-2 text-[14px] font-semibold text-[#111827]">Quantity</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="inline-flex h-11 w-[140px] items-stretch overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
                  <button
                    type="button"
                    disabled={product.stock < 1 || quantityClamped <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex w-11 shrink-0 items-center justify-center border-r border-[#E5E7EB] text-[#111827] hover:bg-[#F7F8F6] disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, product.stock)}
                    value={product.stock < 1 ? 0 : quantityClamped}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") return;
                      const v = parseInt(raw, 10);
                      if (Number.isNaN(v)) return;
                      const cap = Math.max(1, product.stock);
                      setQuantity(Math.min(Math.max(1, v), cap));
                    }}
                    className="w-0 min-w-0 flex-1 border-0 bg-transparent text-center text-[15px] font-semibold text-[#111827] tabular-nums outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label="Quantity"
                  />
                  <button
                    type="button"
                    disabled={product.stock < 1 || quantityClamped >= product.stock}
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="flex w-11 shrink-0 items-center justify-center border-l border-[#E5E7EB] text-[#111827] hover:bg-[#F7F8F6] disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {product.stock > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#2F7A12]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    In stock ({stockLabel})
                  </span>
                ) : (
                  <span className="text-[14px] font-medium text-red-700">Out of stock</span>
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[14px] font-semibold text-[#111827]">
                Bundle &amp; Save <span className="font-normal text-[#6B7280]">(Optional)</span>
              </p>
              <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                {([1, 3, 5] as const).map((t, i) => {
                  const key: BuyTierKey = t === 1 ? "buy1" : t === 3 ? "buy3" : "buy5";
                  const disabled = !tierAvailable(t);
                  const selected = selectedTierKey === key;
                  const price = t === 1 ? basePrice : lineTotal(t);
                  const strike =
                    t === 1
                      ? buy1Discount ? product.originalPrice! : null
                      : tierMeta[t].strikeTotal;
                  const pill =
                    t === 1
                      ? buy1Discount ? `${buy1Discount.percent}% OFF` : null
                      : tierMeta[t].badge;
                  return (
                    <label
                      key={t}
                      className={`flex min-h-[56px] cursor-pointer items-center gap-3 px-3 py-3 transition-colors sm:px-4 ${
                        i > 0 ? "border-t border-[#E5E7EB]" : ""
                      } ${
                        selected
                          ? "bg-[#F3FADF] shadow-[inset_0_0_0_1.5px_#A6D63A]"
                          : "bg-white hover:bg-[#FAFBF8]"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name="volume-tier"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => setQuantity(t)}
                        className="h-[18px] w-[18px] shrink-0"
                        style={{ accentColor: "#0B3D20" }}
                      />
                      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="text-[14px] font-semibold text-[#111827]">
                          {t === 1 ? "Buy 1 (Standard)" : `Buy ${t}`}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[15px] font-bold text-[#0B3D20]">{formatPKR(price)}</span>
                          {strike != null ? (
                            <span className="text-[13px] text-[#9CA3AF] line-through">{formatPKR(strike)}</span>
                          ) : null}
                          {pill ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                selected ? "bg-[#3F7D14] text-white" : "bg-[#ECF7D4] text-[#2F7A12]"
                              }`}
                            >
                              {pill}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 min-[375px]:grid-cols-2">
              <LoadingButton
                type="button"
                onClick={handleBuyNow}
                disabled={actionsDisabled}
                className="inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-md bg-[#9BD832] px-3 text-[15px] font-bold text-[#0B3D20] transition hover:brightness-95 disabled:opacity-45"
              >
                <Zap className="h-[18px] w-[18px] shrink-0" aria-hidden />
                Buy Now
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={handleAddCart}
                disabled={actionsDisabled}
                className="inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-md bg-[#0B3D20] px-3 text-[15px] font-bold text-white transition hover:bg-[#062A15] disabled:opacity-45"
              >
                <ShoppingCart className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {added ? "Added ✓" : "Add to Cart"}
              </LoadingButton>
            </div>
          </div>

          {/* RIGHT — sidebar cards */}
          <div className="grid min-w-0 gap-4 md:col-span-2 md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:col-span-1 xl:grid-cols-1 xl:gap-4">
            <SideCard icon={Truck} title="Delivery Options">
              <SideItem
                icon={MapPin}
                title="Delivering across Pakistan"
                subtitle="From local sellers to your doorstep"
              />
              <SideItem
                icon={Truck}
                title="Standard Delivery"
                subtitle="Fee and timing are calculated from your address at checkout"
              />
              <SideItem
                icon={CreditCard}
                title="Payment"
                subtitle="Available payment methods are confirmed at checkout"
              />
            </SideCard>

            <SideCard icon={ShieldCheck} title="Returns & Warranty">
              <SideItem
                icon={RotateCcw}
                title="Easy Returns"
                subtitle="Return requests are reviewed after delivery in My Stuff"
              />
              <SideItem
                icon={ShieldCheck}
                title="Seller Warranty"
                subtitle={
                  product.warrantyMonths
                    ? `${product.warrantyMonths}-month seller warranty`
                    : "No warranty specified for this listing"
                }
              />
            </SideCard>

            <SideCard icon={Store} title="Sold by" className="md:col-span-2 lg:col-span-1">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#EEF0EC] bg-[#F3F4F1] text-[22px] font-bold text-[#0B3D20]">
                  {seller?.logo ? (
                    <Image src={seller.logo} alt="" fill unoptimized className="object-cover" sizes="64px" />
                  ) : (
                    <span aria-hidden>{sellerName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-[#111827]">{sellerName}</p>
                  {seller ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-[#2F7A12]">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                      Verified Seller
                    </p>
                  ) : null}
                </div>
              </div>
              {storeHref ? (
                <div className="mt-3 flex justify-end">
                  <Link
                    href={storeHref}
                    className="inline-flex min-h-11 items-center rounded-md border border-[#0B3D20] px-4 text-[13px] font-semibold text-[#0B3D20] transition hover:bg-[#0B3D20] hover:text-white"
                  >
                    View Store
                  </Link>
                </div>
              ) : null}
            </SideCard>
          </div>
        </div>

        <ProductServices line={{ productId: product._id, name: product.name, price: unitPriceForCart, image: product.images[0] || "", quantity: totalUnits, maxStock: product.stock, variant }} />

        {/* Description: text on top, full-width images below (when admin adds details) */}
        <div className="mt-5 rounded-2xl border border-[#DFEDE5] bg-white p-4 shadow-sm sm:p-6">
          {detailDescription.length > 0 ? (
            <>
              <h2 className="mb-3 border-b border-[#f0f0f0] pb-2 text-[16px] font-semibold leading-snug text-[#333]">
                Product details of{" "}
                <span className="font-semibold text-[#212121]">{product.name}</span>
              </h2>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[15px] leading-relaxed text-[#555]">
                {detailDescription}
              </div>
              {showDarazDetailBlock ? (
                <div className="mt-6 space-y-3 border-t border-[#f0f0f0] pt-6">
                  {product.images.map((src, i) => {
                    const local = isLocalProductImageSrc(src);
                    return (
                      <div
                        key={`${src}-${i}`}
                        className="mx-auto w-full max-w-[420px] bg-[#fafafa] sm:max-w-[480px] md:max-w-[560px]"
                      >
                        <Image
                          src={src}
                          alt={`${product.name} — detail ${i + 1}`}
                          width={560}
                          height={560}
                          className="mx-auto h-auto w-full object-contain object-center"
                          sizes="(max-width: 480px) 100vw, 560px"
                          unoptimized={!!local}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div
          id="review"
          className={`scroll-mt-24 ${
            detailDescription.length > 0
              ? "mt-8 border-t border-[#f0f0f0] pt-6"
              : "pt-1"
          }`}
        >
          <h2 className="mb-4 text-[16px] font-semibold text-[#333]">
            Ratings &amp; reviews
          </h2>
          <ProductApprovedReviewsList
            postField={reviewsPostField ?? { productId: product._id }}
          />
          <VerifiedOrderReviewSection productId={product._id} />
        </div>

        {related.length > 0 ? (
          <section className="mt-6 rounded-2xl border border-[#DFEDE5] bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-[18px] font-semibold text-[#333]">
              Related Products
            </h2>
            <div className={gridStyles.grid}>
              {related.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
