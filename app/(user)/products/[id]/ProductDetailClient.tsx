"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ProductServices } from "@/components/user/ProductServices";
import { SaveProductButton } from "@/components/user/SaveProductButton";

import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import toast from "react-hot-toast";
import {
  Banknote,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Maximize2,
  Truck,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Minus,
  Plus,
  X,
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
import { lockPageScroll } from "@/lib/scroll-lock";

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

/** Shop-wide delivery settings (the same flat charge checkout applies). */
export type ProductDeliveryInfo = { fee: number; codCities: string[] };

type SellerInfo = {
  name: string;
  storeSlug: string | null;
  logo?: string | null;
  /** e.g. "Active 2 hours ago", from the seller's last sign-in. */
  activity?: string | null;
};

const card =
  "min-w-0 rounded-xl border border-[#E5E9E5] bg-white shadow-[0_1px_3px_rgba(16,24,16,0.05)]";

/** Common colour names → swatch colours, so colour variants render as chips like the catalog. */
const SWATCHES: Record<string, string> = {
  black: "#1F2328", white: "#FFFFFF", grey: "#9CA3AF", gray: "#9CA3AF", silver: "#C9CDD2",
  red: "#E53935", maroon: "#7B1E28", pink: "#F06BAA", "light pink": "#F5B8D2", rose: "#E8798F",
  orange: "#F57C1F", yellow: "#F5D21F", gold: "#D4AF37", beige: "#E8D9B5", cream: "#F5EEDC",
  brown: "#7A4E2D", green: "#2E9E4F", "dark green": "#1E5C3A", olive: "#7A7F2C", lime: "#A8E52E",
  mint: "#9EE6C8", teal: "#139A8F", blue: "#1E88E5", "sky blue": "#7CC4F2", "light blue": "#9CCCF2",
  navy: "#1F2F5C", "navy blue": "#1F2F5C", "dark blue": "#1D3A8A", purple: "#7E3FBF",
  violet: "#8B5CF6", lavender: "#C7B5E8", magenta: "#D63AAF", multicolor: "", "multi-color": "",
  "multi color": "", transparent: "",
};

function swatchFor(variant: string): string | undefined {
  const key = variant.trim().toLowerCase();
  return key in SWATCHES ? SWATCHES[key] : undefined;
}

const SPEC_LINE = /^\s*[-•*]?\s*([A-Za-z][A-Za-z /&()-]{1,28}?)\s*[:：]\s*(.{1,140})\s*$/;

/** Pulls "Label: value" lines out of the description into spec rows; the rest stays as prose. */
function splitDescription(text: string) {
  const specs: { label: string; value: string }[] = [];
  const prose: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = SPEC_LINE.exec(line);
    if (match && specs.length < 12) specs.push({ label: match[1].trim(), value: match[2].trim() });
    else prose.push(line);
  }
  return { specs, prose: prose.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

function StarRating({ rating, className = "h-4 w-4" }: { rating: number; className?: string }) {
  const r = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={`${className} ${i < r ? "fill-[#F5B301] text-[#F5B301]" : "fill-none text-[#C3C8CF]"}`}
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

function InfoCard({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${card} p-4 ${className}`}>
      <h2 className="flex items-center gap-2.5 text-[16px] font-bold text-[#172033] sm:text-[17px]">
        <Icon className="h-[22px] w-[22px] shrink-0 text-[#00543D]" strokeWidth={2} aria-hidden />
        {title}
      </h2>
      <div className="mt-2 divide-y divide-[#EEF1EC]">{children}</div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  title,
  subtitle,
  aside,
  href,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3F6F1] text-[#00543D]">
        <Icon className="h-[17px] w-[17px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-[#172033]">{title}</span>
        {subtitle ? <span className="mt-0.5 block text-[12px] leading-snug text-[#6B7280]">{subtitle}</span> : null}
      </span>
      {aside ? <span className="shrink-0 text-[13.5px] font-bold text-[#172033]">{aside}</span> : null}
      {href ? <ChevronRight className="h-4 w-4 shrink-0 text-[#374151]" aria-hidden /> : null}
    </>
  );
  const rowClass = "flex min-w-0 items-center gap-3 py-2.5 first:pt-1 last:pb-0";
  return href ? (
    <Link href={href} className={`${rowClass} rounded-md transition-colors hover:text-[#00543D]`}>
      {body}
    </Link>
  ) : (
    <div className={rowClass}>{body}</div>
  );
}

function ImageViewer({
  images,
  name,
  index,
  onIndex,
  onClose,
}: {
  images: string[];
  name: string;
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = images.length;
  const go = useCallback((next: number) => onIndex((next + count) % count), [count, onIndex]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockPageScroll();
    closeRef.current?.focus();
    return () => {
      unlock();
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (count > 1 && event.key === "ArrowRight") go(index + 1);
      if (count > 1 && event.key === "ArrowLeft") go(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count, go, index, onClose]);

  const src = images[index];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} images`}
      className="fixed inset-0 z-[120] flex flex-col bg-[#0B1410]/95 text-white"
    >
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <p className="text-[13px] tabular-nums text-white/75">
          {index + 1} / {count}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 px-2 sm:px-16" onClick={onClose}>
        {src ? (
          <Image
            src={src}
            alt={`${name} — image ${index + 1}`}
            fill
            unoptimized={isLocalProductImageSrc(src)}
            className="object-contain"
            sizes="100vw"
            onClick={(event) => event.stopPropagation()}
          />
        ) : null}
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); go(index - 1); }}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-white sm:left-4"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); go(index + 1); }}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-white sm:right-4"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4">
          {images.map((im, i) => (
            <button
              key={`${im}-${i}`}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === index}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-white/5 ${
                i === index ? "border-[#A8E52E]" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={im} alt="" fill unoptimized={isLocalProductImageSrc(im)} className="object-cover" sizes="56px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductDetailClient({
  product,
  related,
  seller,
  delivery,
  soldCount,
  reviewsPostField,
}: {
  product: ProductDetailProduct;
  related: ProductCardData[];
  seller?: SellerInfo | null;
  /** Shop delivery settings; omitted where the caller has none (charges then show at checkout). */
  delivery?: ProductDeliveryInfo | null;
  /** Units sold, when the listing tracks it (seller listings). */
  soldCount?: number | null;
  /** Default: DB `productId`. Use `{ newArrivalId }` for JSON new-arrival detail. */
  reviewsPostField?: ReviewDisplayField;
}) {
  const [idx, setIdx] = useState(0);
  const [liveReviewStats, setLiveReviewStats] = useState<{ productId: string; averageRating: number; totalCount: number } | null>(null);
  const updateReviewStats = useCallback((stats: { averageRating: number; totalCount: number }) => {
    setLiveReviewStats({ productId: product._id, ...stats });
  }, [product._id]);
  const [viewerOpen, setViewerOpen] = useState(false);
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

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Product link copied");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.error("Could not share this product");
    }
  }

  const currentReviewStats = liveReviewStats?.productId === product._id ? liveReviewStats : null;
  const reviewsCount = currentReviewStats?.totalCount ?? Number(product.reviewCount || 0);
  const ratingAvg = currentReviewStats?.averageRating ?? Number(product.ratingAvg || 0);
  const detailDescription = (product.description ?? "").trim();
  const { specs: descriptionSpecs, prose: descriptionProse } = splitDescription(detailDescription);

  const imageCount = product.images.length;
  const showImage = (next: number) => {
    if (imageCount < 2) return;
    setIdx((next + imageCount) % imageCount);
  };
  const touchStartX = useRef<number | null>(null);
  const stockLabel = product.stock > 500 ? "500+" : String(product.stock);
  const actionsDisabled =
    product.stock < 1 || quantityClamped < 1 || quantityClamped > product.stock;
  const sellerName = seller?.name || "Marketplace listing";
  const storeHref = seller?.storeSlug
    ? `/stores/${encodeURIComponent(seller.storeSlug)}`
    : null;

  /** On tablet/desktop the thumbnail rail shows 4 images and a "+N" tile; phones scroll them all. */
  const railOverflow = imageCount > 5;
  const railShown = railOverflow ? 4 : imageCount;

  const variantsAreColours =
    needsVariant && product.variants.every((v) => swatchFor(v) !== undefined);
  const variantLabel = variantsAreColours ? "Color Family" : "Options";

  const knownLabels = new Set(["product name", "name", "category"]);
  const specRows: { label: string; value: string }[] = [
    { label: "Product Name", value: product.name },
    ...(product.category ? [{ label: "Category", value: product.category }] : []),
    ...descriptionSpecs.filter((row) => !knownLabels.has(row.label.toLowerCase())),
    ...(needsVariant && !descriptionSpecs.some((row) => /colou?r|variant|option/i.test(row.label))
      ? [{ label: variantLabel, value: product.variants.join(", ") }]
      : []),
    ...(product.warrantyMonths
      ? [{ label: "Warranty", value: `${product.warrantyMonths} ${product.warrantyMonths === 1 ? "month" : "months"}` }]
      : []),
  ];
  const supportingImage = product.images[1] || product.images[0];

  return (
    <div className="min-h-screen bg-[#F7F8F2]">
      <div className="mx-auto max-w-site px-4 pb-8 pt-4 sm:px-5 sm:pt-5">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] text-[#6B7280] sm:gap-2 sm:text-[14px]">
            <li className="shrink-0">
              <Link href="/" className="hover:text-[#00543D]">Home</Link>
            </li>
            <BreadcrumbChevron />
            <li className="shrink-0">
              <Link href="/products" className="hover:text-[#00543D]">Products</Link>
            </li>
            {product.category ? (
              <>
                <BreadcrumbChevron />
                <li className="min-w-0 max-w-[40%] truncate sm:max-w-none">
                  <Link
                    href={`/products?category=${encodeURIComponent(product.category)}`}
                    className="hover:text-[#00543D]"
                  >
                    {product.category}
                  </Link>
                </li>
              </>
            ) : null}
            <BreadcrumbChevron />
            <li aria-current="page" className="min-w-0 truncate font-medium text-[#172033]">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:items-start xl:grid-cols-[minmax(0,1.38fr)_minmax(0,1fr)_minmax(0,0.86fr)]">
          {/* LEFT — gallery */}
          <section aria-label="Product images" className={`${card} p-3 sm:p-3.5`}>
            <div className="flex min-w-0 flex-col-reverse gap-3 sm:flex-row">
              {imageCount > 1 ? (
                <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] sm:w-[68px] sm:flex-col sm:gap-3 sm:overflow-visible sm:pb-0 xl:w-[80px]">
                  {product.images.map((im, i) => (
                    <button
                      key={`${im}-${i}`}
                      type="button"
                      onClick={() => setIdx(i)}
                      aria-label={`Show image ${i + 1}`}
                      aria-current={idx === i}
                      className={`relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-[#F3F4F1] transition-colors sm:w-full ${
                        i >= railShown ? "sm:hidden" : ""
                      } ${idx === i ? "border-[#00543D]" : "border-[#E5E9E5] hover:border-[#9DB8A6]"}`}
                    >
                      <Image
                        src={im}
                        alt=""
                        fill
                        unoptimized={isLocalProductImageSrc(im)}
                        className="object-cover"
                        sizes="80px"
                      />
                    </button>
                  ))}
                  {railOverflow ? (
                    <button
                      type="button"
                      onClick={() => { setIdx(railShown); setViewerOpen(true); }}
                      aria-label={`View all ${imageCount} images`}
                      className="relative hidden aspect-square w-full shrink-0 overflow-hidden rounded-lg border-2 border-[#E5E9E5] bg-[#172033] sm:block"
                    >
                      <Image
                        src={product.images[railShown]}
                        alt=""
                        fill
                        unoptimized={isLocalProductImageSrc(product.images[railShown])}
                        className="object-cover opacity-45"
                        sizes="80px"
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[20px] font-bold text-white">
                        +{imageCount - railShown}
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div
                className="relative aspect-square w-full min-w-0 overflow-hidden rounded-xl bg-[#F3F4F1] sm:aspect-[16/15]"
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
                    className="cursor-zoom-in object-cover object-center"
                    priority
                    sizes="(max-width:767px) 100vw, (max-width:1279px) 50vw, 560px"
                    onClick={() => setViewerOpen(true)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">
                    No image
                  </div>
                )}
                {imageCount > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => showImage(idx - 1)}
                      aria-label="Previous image"
                      className="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center sm:hidden"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#00543D] shadow-md">
                        <ChevronLeft className="h-4 w-4" />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => showImage(idx + 1)}
                      aria-label="Next image"
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center sm:hidden"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#00543D] shadow-md">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  </>
                ) : null}
                {mainImg ? (
                  <button
                    type="button"
                    onClick={() => setViewerOpen(true)}
                    aria-label="View images full screen"
                    className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#172033]/55 text-white backdrop-blur-sm transition hover:bg-[#172033]/75"
                  >
                    <Maximize2 className="h-[18px] w-[18px]" />
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          {/* MIDDLE — purchase card */}
          <section aria-label="Purchase options" className={`${card} p-4 sm:p-5 xl:p-6`}>
            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 break-words text-[22px] font-bold leading-tight text-[#172033] sm:text-[26px]">
                {product.name}
              </h1>
              <div className="-mr-1.5 -mt-1 flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  aria-label="Share this product"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[#172033] transition hover:bg-[#F3F6F1]"
                >
                  <Share2 className="h-5 w-5" />
                </button>
                <SaveProductButton
                  productId={product._id}
                  name={product.name}
                  variant="icon"
                  className="bg-transparent text-[#172033] shadow-none hover:bg-[#F3F6F1]"
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[#6B7280] sm:text-[14px]">
              <StarRating rating={ratingAvg} />
              {reviewsCount > 0 ? (
                <span className="font-semibold text-[#172033]">
                  {(Math.round(ratingAvg * 10) / 10).toFixed(1)}
                </span>
              ) : null}
              <a href="#review" className="hover:text-[#00543D]">
                ({reviewsCount} {reviewsCount === 1 ? "review" : "reviews"})
              </a>
              {soldCount != null ? (
                <>
                  <span aria-hidden className="h-4 w-px bg-[#D9DDD8]" />
                  <span>{soldCount.toLocaleString("en-PK")} sold</span>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-[28px] font-bold leading-none text-[#00543D] sm:text-[32px]">
                {formatPKR(displayPrice)}
              </span>
              {displayOriginal != null ? (
                <span className="text-[15px] text-[#9CA3AF] line-through sm:text-[16px]">
                  {formatPKR(displayOriginal)}
                </span>
              ) : null}
              {displayedDiscount ? (
                <span className="rounded-full bg-[#ECF7D4] px-2.5 py-1 text-[12px] font-bold text-[#2F7A12]">
                  {displayedDiscount.percent}% OFF
                </span>
              ) : null}
            </div>

            {product.variants?.length ? (
              <fieldset className="mt-5">
                <legend className="mb-2 text-[14px] font-medium text-[#172033]">
                  {variantLabel}
                  {variant && !variantsAreColours ? <span className="font-normal text-[#6B7280]">: {variant}</span> : null}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const swatch = swatchFor(v);
                    const selected = variant === v;
                    if (variantsAreColours) {
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setVariant(v)}
                          aria-pressed={selected}
                          aria-label={v}
                          title={v}
                          className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 bg-white p-[3px] transition-colors ${
                            selected ? "border-[#00543D]" : "border-[#E5E9E5] hover:border-[#9DB8A6]"
                          }`}
                        >
                          <span
                            aria-hidden
                            className="h-full w-full rounded-[5px] border border-black/10"
                            style={{
                              background:
                                swatch ||
                                "conic-gradient(#E53935, #F5D21F, #2E9E4F, #1E88E5, #7E3FBF, #E53935)",
                            }}
                          />
                        </button>
                      );
                    }
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVariant(v)}
                        aria-pressed={selected}
                        title={v}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-lg border-2 px-3 text-[13px] font-medium transition-colors ${
                          selected
                            ? "border-[#00543D] bg-[#F4FAEA] text-[#003F2E]"
                            : "border-[#E5E9E5] bg-white text-[#172033] hover:border-[#9DB8A6]"
                        }`}
                      >
                        {swatch !== undefined ? (
                          <span
                            aria-hidden
                            className="h-5 w-5 shrink-0 rounded-[5px] border border-black/10"
                            style={{
                              background:
                                swatch ||
                                "conic-gradient(#E53935, #F5D21F, #2E9E4F, #1E88E5, #7E3FBF, #E53935)",
                            }}
                          />
                        ) : null}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <div className="mt-5">
              <p id="quantity-label" className="mb-2 text-[14px] font-medium text-[#172033]">Quantity</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="inline-flex h-11 w-[140px] items-stretch overflow-hidden rounded-lg border border-[#D9DDD8] bg-white">
                  <button
                    type="button"
                    disabled={product.stock < 1 || quantityClamped <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex w-11 shrink-0 items-center justify-center border-r border-[#D9DDD8] text-[#172033] hover:bg-[#F7F8F6] disabled:opacity-40"
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
                    className="w-0 min-w-0 flex-1 border-0 bg-transparent text-center text-[15px] font-semibold text-[#172033] tabular-nums outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-labelledby="quantity-label"
                  />
                  <button
                    type="button"
                    disabled={product.stock < 1 || quantityClamped >= product.stock}
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="flex w-11 shrink-0 items-center justify-center border-l border-[#D9DDD8] text-[#172033] hover:bg-[#F7F8F6] disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {product.stock > 0 ? (
                  <span className="inline-flex items-center gap-2 text-[13px] text-[#6B7280] sm:text-[14px]">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#3DB54A]" />
                    In stock ({stockLabel} available)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-[14px] font-medium text-red-700">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-red-600" />
                    Out of stock
                  </span>
                )}
              </div>
            </div>

            <fieldset className="mt-5">
              <legend className="mb-2 text-[14px] font-medium text-[#172033]">Buy More &amp; Save</legend>
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {([1, 3, 5] as const).map((t) => {
                  const key: BuyTierKey = t === 1 ? "buy1" : t === 3 ? "buy3" : "buy5";
                  const disabled = !tierAvailable(t);
                  const selected = selectedTierKey === key;
                  return (
                    <label
                      key={t}
                      className={`relative flex min-h-[60px] min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border-2 px-2 py-2 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#00543D] sm:px-2.5 xl:px-2 ${
                        selected
                          ? "border-[#7DBB2C] bg-[#F4FBE6]"
                          : "border-[#E5E9E5] bg-white hover:border-[#9DB8A6]"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name="volume-tier"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => setQuantity(t)}
                        className="sr-only"
                      />
                      {selected ? (
                        <CheckCircle2
                          aria-hidden
                          className="hidden h-4 w-4 shrink-0 fill-[#2F8F3A] text-white min-[400px]:block md:hidden lg:block"
                        />
                      ) : null}
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-[#172033]">Buy {t}</span>
                        <span className="block text-[12px] leading-tight text-[#374151] sm:text-[13px] xl:text-[12px]">
                          <span className="whitespace-nowrap">{formatPKR(effectiveUnitPrice(t))}</span> each
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              <LoadingButton
                type="button"
                onClick={handleBuyNow}
                disabled={actionsDisabled}
                className="inline-flex min-h-[50px] min-w-0 items-center justify-center gap-2 rounded-lg bg-[#A8E52E] px-3 text-[15px] font-bold text-[#003F2E] transition hover:bg-[#9AD62A] disabled:opacity-45"
              >
                <Zap className="h-[18px] w-[18px] shrink-0 fill-current" aria-hidden />
                Buy Now
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={handleAddCart}
                disabled={actionsDisabled}
                className="inline-flex min-h-[50px] min-w-0 items-center justify-center gap-2 rounded-lg bg-[#00543D] px-3 text-[15px] font-bold text-white transition hover:bg-[#003F2E] disabled:opacity-45"
              >
                <ShoppingCart className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {added ? "Added ✓" : "Add to Cart"}
              </LoadingButton>
            </div>
          </section>

          {/* RIGHT — delivery, returns and seller */}
          <div className="grid min-w-0 gap-4 md:col-span-2 md:grid-cols-2 lg:grid-cols-3 xl:col-span-1 xl:grid-cols-1">
            <InfoCard icon={Truck} title="Delivery Options">
              <InfoRow icon={MapPin} title="Delivering across Pakistan" />
              <InfoRow
                icon={Truck}
                title="Standard Delivery"
                subtitle={delivery ? "Flat delivery charge per order" : "Charges are confirmed at checkout"}
                aside={delivery ? (delivery.fee > 0 ? formatPKR(delivery.fee) : "FREE") : undefined}
              />
              {delivery?.codCities.length ? (
                <InfoRow
                  icon={Banknote}
                  title="Cash on Delivery"
                  subtitle={
                    delivery.codCities.length > 2
                      ? `${delivery.codCities.slice(0, 2).join(", ")} + ${delivery.codCities.length - 2} more cities`
                      : `Available in ${delivery.codCities.join(", ")}`
                  }
                />
              ) : null}
            </InfoCard>

            <InfoCard icon={ShieldCheck} title="Returns & Warranty">
              <InfoRow
                icon={RotateCcw}
                title="7 Days Return"
                subtitle="For wrong or damaged items"
                href="/return-policy"
              />
              <InfoRow
                icon={ShieldCheck}
                title="Seller Warranty"
                subtitle={
                  product.warrantyMonths
                    ? `${product.warrantyMonths}-month seller warranty`
                    : "Not available"
                }
              />
            </InfoCard>

            <InfoCard icon={Store} title="Sold by" className="md:col-span-2 lg:col-span-1">
              {(() => {
                const body = (
                  <>
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F3F6F1] text-[#00543D]">
                      {seller?.logo ? (
                        <Image src={seller.logo} alt="" fill unoptimized className="object-cover" sizes="44px" />
                      ) : (
                        <Store className="h-5 w-5" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-[#172033]">{sellerName}</span>
                      {seller?.activity ? (
                        <span className="mt-0.5 block text-[12px] text-[#6B7280]">{seller.activity}</span>
                      ) : seller ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-[#2F7A12]">
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                          Verified Seller
                        </span>
                      ) : null}
                    </span>
                    {storeHref ? <ChevronRight className="h-5 w-5 shrink-0 text-[#374151]" aria-hidden /> : null}
                  </>
                );
                return storeHref ? (
                  <Link
                    href={storeHref}
                    aria-label={`Visit ${sellerName} store`}
                    className="flex min-w-0 items-center gap-3 rounded-lg pt-1 transition-colors hover:text-[#00543D]"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-w-0 items-center gap-3 pt-1">{body}</div>
                );
              })()}
            </InfoCard>
          </div>
        </div>

        <ProductServices line={{ productId: product._id, name: product.name, price: unitPriceForCart, image: product.images[0] || "", quantity: totalUnits, maxStock: product.stock, variant }} />

        <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
          {/* Product details: spec table + supporting image, then the full description */}
          <section aria-labelledby="product-details-title" className={`${card} p-4 sm:p-5`}>
            <h2 id="product-details-title" className="text-[18px] font-bold text-[#172033] sm:text-[20px]">
              Product Details
            </h2>
            <div className={`mt-4 grid min-w-0 gap-4 ${supportingImage ? "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : ""}`}>
              <dl className="min-w-0 self-start overflow-hidden rounded-lg border border-[#EEF1EC]">
                {specRows.map((row, i) => (
                  <div
                    key={`${row.label}-${i}`}
                    className={`grid grid-cols-[minmax(96px,40%)_minmax(0,1fr)] gap-3 px-4 py-2.5 text-[13px] ${
                      i > 0 ? "border-t border-[#EEF1EC]" : ""
                    } ${i % 2 === 0 ? "bg-[#FAFBF8]" : "bg-white"}`}
                  >
                    <dt className="text-[#374151]">{row.label}</dt>
                    <dd className="min-w-0 break-words text-[#4B5563]">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {supportingImage ? (
                <button
                  type="button"
                  onClick={() => { setIdx(product.images.indexOf(supportingImage)); setViewerOpen(true); }}
                  aria-label="View product image full screen"
                  className="relative aspect-[4/3] w-full min-w-0 overflow-hidden rounded-xl bg-[#F3F4F1] sm:aspect-auto sm:min-h-[200px] sm:self-stretch"
                >
                  <Image
                    src={supportingImage}
                    alt=""
                    fill
                    unoptimized={isLocalProductImageSrc(supportingImage)}
                    className="object-cover"
                    sizes="(max-width:639px) 100vw, (max-width:1023px) 50vw, 400px"
                  />
                </button>
              ) : null}
            </div>
            {descriptionProse ? (
              <div className="mt-5 border-t border-[#EEF1EC] pt-4">
                <h3 className="text-[15px] font-semibold text-[#172033]">Description</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#4B5563]">
                  {descriptionProse}
                </p>
              </div>
            ) : null}
          </section>

          <div id="review" className="min-w-0 scroll-mt-40">
            <ProductApprovedReviewsList
              onStats={updateReviewStats}
              postField={reviewsPostField ?? { productId: product._id }}
            />
          </div>
        </div>

        <div className="mt-4">
          <VerifiedOrderReviewSection productId={product._id} />
        </div>

        {related.length > 0 ? (
          <section className={`${card} mt-1 p-4 sm:p-5`}>
            <h2 className="mb-4 text-[18px] font-bold text-[#172033] sm:text-[20px]">
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

      {viewerOpen && imageCount > 0 ? (
        <ImageViewer
          images={product.images}
          name={product.name}
          index={Math.min(idx, imageCount - 1)}
          onIndex={setIdx}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </div>
  );
}
