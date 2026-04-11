"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  MapPin,
  Truck,
  Package,
  Banknote,
  RotateCcw,
  ShieldOff,
  Minus,
  Plus,
} from "lucide-react";
import { ProductCard, ProductCardData } from "@/components/user/ProductCard";
import { ProductApprovedReviewsList } from "@/components/user/ProductApprovedReviewsList";
import type { PublicReviewPostField } from "@/components/user/PublicReviewsSection";
import { VerifiedOrderReviewSection } from "@/components/user/VerifiedOrderReviewSection";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";

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
};

type SiteSettings = {
  shopName?: string;
  codCharges?: number;
};

const DARAZ_ORANGE = "#F57224";
const BUY_NOW_BLUE = "#40C4FF";

function StarRowDaraz({ rating, count }: { rating: number; count: number }) {
  const r = Math.min(5, Math.max(0, Math.round(rating)));
  const avg =
    count > 0 ? (Math.round(rating * 10) / 10).toFixed(1) : "0";
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <span aria-hidden className="text-[#FFC400]">
        ⭐
      </span>
      <span className="text-[#FFC400] tracking-tight" aria-hidden>
        {"★".repeat(r)}
        <span className="text-[#e0e0e0]">{"★".repeat(5 - r)}</span>
      </span>
      <span className="font-medium text-[#333]">{avg}</span>
      <span className="text-[#757575]">
        ({count} {count === 1 ? "review" : "reviews"})
      </span>
    </div>
  );
}

export function ProductDetailClient({
  product,
  related,
  reviewsPostField,
}: {
  product: ProductDetailProduct;
  related: ProductCardData[];
  /** Default: DB `productId`. Use `{ newArrivalId }` for JSON new-arrival detail. */
  reviewsPostField?: PublicReviewPostField;
}) {
  const [idx, setIdx] = useState(0);
  const [variant, setVariant] = useState<string | undefined>(
    product.variants?.[0]
  );
  type VolumeTier = 1 | 3 | 5;
  type BuyTierKey = "buy1" | "buy3" | "buy5";

  const [quantity, setQuantity] = useState(1);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  const { addItem, clear } = useCart();
  const { requireCustomer } = useCustomerAuth();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d === "object") setSettings(d as SiteSettings);
      })
      .catch(() => {});
  }, []);

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

  const shopName = settings?.shopName?.trim() || "In Range By Abdullah";
  const codFee = Number(settings?.codCharges);
  const deliveryFee = Number.isFinite(codFee) ? codFee : 150;

  const mainImg = product.images[idx] || product.images[0];
  const mainLocal = mainImg ? isLocalProductImageSrc(mainImg) : false;
  const hasDiscount =
    Boolean(product.originalPrice && product.originalPrice > product.price);
  const discountPct =
    product.discountPercent ??
    (hasDiscount && product.originalPrice
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0);
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
    requireCustomer(() => {
      addItem({
        productId: product._id,
        name: product.name,
        price: unitPriceForCart,
        image: product.images[0] || "",
        maxStock: product.stock,
        variant,
        quantity: totalUnits,
      });
      toast.success("Added to cart");
    }, "signup");
  }

  function handleBuyNow() {
    if (!validateAdd()) return;
    requireCustomer(() => {
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
      router.push("/checkout");
    }, "signup");
  }

  const reviewsCount = Number(product.reviewCount || 0);
  const ratingAvg = Number(product.ratingAvg || 0);
  const detailDescription = (product.description ?? "").trim();
  const showDarazDetailBlock =
    detailDescription.length > 0 && product.images.length > 0;

  const thumbRing = (active: boolean) =>
    active
      ? "ring-2 ring-[#F57224] ring-offset-2 ring-offset-white"
      : "ring-1 ring-[#e8e8e8] hover:ring-[#ccc]";

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto mt-8 max-w-[1200px] px-4 py-4 sm:mt-10">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-5">
          {/* LEFT — gallery ~40% */}
          <div className="order-1 lg:order-none lg:col-span-5">
            <div className="overflow-hidden border border-[#f0f0f0] bg-white">
              <div className="relative aspect-square w-full bg-white p-1 sm:p-2">
                {mainImg ? (
                  <Image
                    src={mainImg}
                    alt={product.name}
                    fill
                    unoptimized={!!mainLocal}
                    className="object-contain object-center"
                    priority
                    sizes="(max-width:1024px) 100vw, (max-width:1280px) 50vw, 560px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#999]">
                    No image
                  </div>
                )}
              </div>
              {product.images.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto border-t border-[#f0f0f0] p-2 sm:p-3">
                  {product.images.map((im, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIdx(i)}
                      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded bg-white sm:h-[72px] sm:w-[72px] ${thumbRing(idx === i)}`}
                    >
                      <Image
                        src={im}
                        alt=""
                        fill
                        unoptimized={isLocalProductImageSrc(im)}
                        className="object-cover"
                        sizes="72px"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* MIDDLE ~35% */}
          <div className="order-2 lg:order-none lg:col-span-4 lg:col-start-6">
            <div className="border border-[#e8e8e8] bg-white p-4 lg:border-0 lg:bg-transparent lg:p-0">
              <nav className="mb-2 text-[12px] text-[#757575]">
                <Link href="/" className="hover:text-[#0F6AB0]">
                  Home
                </Link>
                <span className="mx-1.5">/</span>
                <Link
                  href={`/products?category=${encodeURIComponent(product.category)}`}
                  className="hover:text-[#0F6AB0]"
                >
                  {product.category}
                </Link>
                <span className="mx-1.5">/</span>
                <span className="line-clamp-1 text-[#999]">{product.name}</span>
              </nav>

              <h1 className="line-clamp-3 text-lg font-semibold leading-snug text-[#333]">
                {product.name}
              </h1>

              {reviewsCount > 0 ? (
                <div className="mt-2">
                  <StarRowDaraz rating={ratingAvg} count={reviewsCount} />
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[#757575]">No ratings yet</p>
              )}

              <p className="mt-3 text-[13px] text-[#757575]">
                Brand:{" "}
                <Link href="/" className="text-[#0F6AB0] hover:underline">
                  {shopName}
                </Link>
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-2 gap-y-1">
                <span
                  className="text-[28px] font-semibold leading-none"
                  style={{ color: DARAZ_ORANGE }}
                >
                  {formatPKR(displayPrice)}
                </span>
                {hasDiscount || displayOriginal != null ? (
                  <>
                    {displayOriginal != null ? (
                      <span className="text-sm text-[#757575] line-through">
                        {formatPKR(displayOriginal)}
                      </span>
                    ) : null}
                    {discountPct > 0 ? (
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: DARAZ_ORANGE }}
                      >
                        -{discountPct}%
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>

              {product.stock > 0 ? (
                <span className="mt-3 inline-block rounded bg-[#e8f5e9] px-2.5 py-1 text-[12px] font-medium text-[#2e7d32]">
                  In stock
                </span>
              ) : (
                <span className="mt-3 inline-block rounded bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-700">
                  Out of stock
                </span>
              )}

              <div className="my-5 border-t border-[#e8e8e8]" />

              {product.variants?.length ? (
                <div className="mb-5">
                  <p className="mb-2 text-[13px] font-medium text-[#333]">
                    Color Family
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVariant(v)}
                        className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                          variant === v
                            ? "border-[#F57224] bg-[#fff8f3] text-[#333]"
                            : "border-[#e0e0e0] bg-white text-[#333] hover:border-[#ccc]"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mb-5">
                <p className="mb-2 text-[13px] font-medium text-[#333]">
                  Quantity
                </p>
                <div className="inline-flex items-stretch rounded border border-[#e0e0e0] bg-white">
                  <button
                    type="button"
                    disabled={product.stock < 1 || quantityClamped <= 1}
                    onClick={() =>
                      setQuantity((q) => Math.max(1, q - 1))
                    }
                    className="flex w-10 items-center justify-center border-r border-[#e0e0e0] text-[#333] hover:bg-[#f5f5f5] disabled:opacity-40"
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
                    className="w-14 min-w-[3rem] border-0 bg-transparent py-2 text-center text-[15px] font-semibold text-[#333] tabular-nums outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label="Quantity"
                  />
                  <button
                    type="button"
                    disabled={
                      product.stock < 1 || quantityClamped >= product.stock
                    }
                    onClick={() =>
                      setQuantity((q) =>
                        Math.min(product.stock, q + 1)
                      )
                    }
                    className="flex w-10 items-center justify-center border-l border-[#e0e0e0] text-[#333] hover:bg-[#f5f5f5] disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-[#757575]">
                  {quantityClamped} unit{quantityClamped !== 1 ? "s" : ""} per pack
                  · {quantityClamped} unit{quantityClamped !== 1 ? "s" : ""}{" "}
                  total
                </p>
              </div>

              <div className="mb-5 mt-2 border border-[#e8e8e8] bg-white p-4 lg:border-0 lg:bg-transparent lg:p-0">
                <div className="border-b border-[#e0e0e0] pb-2 text-center text-[14px] font-semibold text-[#333] lg:text-left">
                  Buy More Save More
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  {([1, 3, 5] as const).map((t) => {
                    const key: BuyTierKey =
                      t === 1 ? "buy1" : t === 3 ? "buy3" : "buy5";
                    const disabled = !tierAvailable(t);
                    const selected = selectedTierKey === key;
                    return (
                      <label
                        key={t}
                        className={`flex cursor-pointer items-stretch gap-3 rounded-xl p-4 transition-[border-color,background-color,box-shadow] duration-200 ease-in-out sm:px-4 ${
                          selected
                            ? "border-2 border-[#3B82F6] bg-[#EFF6FF] shadow-sm"
                            : "border border-[#E5E7EB] bg-white hover:border-[#d1d5db]"
                        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        <input
                          type="radio"
                          name="volume-tier"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => setQuantity(t)}
                          className="mt-1 h-4 w-4 shrink-0"
                          style={{ accentColor: "#3B82F6" }}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-[14px] font-semibold text-[#333]">
                              Buy {t}
                            </span>
                            {t === 1 ? (
                              <span className="text-[12px] font-medium text-[#6B7280]">
                                {tierMeta[t].badge}
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                {tierMeta[t].badge}
                              </span>
                            )}
                          </div>
                          <div className="text-left sm:text-right">
                            {t === 1 ? (
                              <span
                                className="text-[16px] font-bold"
                                style={{ color: DARAZ_ORANGE }}
                              >
                                {formatPKR(basePrice)}
                              </span>
                            ) : (
                              <>
                                <div
                                  className="text-[16px] font-bold"
                                  style={{ color: DARAZ_ORANGE }}
                                >
                                  {formatPKR(lineTotal(t))}
                                </div>
                                {tierMeta[t].strikeTotal != null ? (
                                  <div className="text-[13px] text-[#757575] line-through">
                                    {formatPKR(tierMeta[t].strikeTotal)}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={
                    product.stock < 1 ||
                    quantityClamped < 1 ||
                    quantityClamped > product.stock
                  }
                  className="h-11 flex-1 rounded text-[15px] font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-45"
                  style={{ backgroundColor: BUY_NOW_BLUE }}
                >
                  Buy Now
                </button>
                <button
                  type="button"
                  onClick={handleAddCart}
                  disabled={
                    product.stock < 1 ||
                    quantityClamped < 1 ||
                    quantityClamped > product.stock
                  }
                  className="h-11 flex-1 rounded text-[15px] font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-45"
                  style={{ backgroundColor: DARAZ_ORANGE }}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT ~25% */}
          <div className="order-3 lg:order-none lg:col-span-3 lg:col-start-10">
            <div className="space-y-3">
              <div className="border border-[#e8e8e8] bg-white p-4">
                <p className="mb-3 text-[13px] font-semibold text-[#333]">
                  Delivery Options
                </p>
                <div className="flex gap-2 text-[13px] text-[#333]">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#757575]" />
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug">
                      Pakistan{" "}
                      <button
                        type="button"
                        className="text-[#0F6AB0] hover:underline"
                        onClick={() =>
                          toast("Update delivery location from checkout.")
                        }
                      >
                        CHANGE
                      </button>
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 border-t border-[#f0f0f0] pt-3 text-[12px]">
                  <div className="flex gap-2">
                    <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[#757575]" />
                    <div>
                      <p className="font-medium text-[#333]">Standard Delivery</p>
                      <p className="text-[#757575]">
                        {formatPKR(deliveryFee)} · Est. 2–4 business days
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-[#757575]" />
                    <div>
                      <p className="font-medium text-[#333]">
                        Standard Collection Point
                      </p>
                      <p className="text-[#757575]">
                        {formatPKR(35)} · Pickup in 3–5 days
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pt-1">
                    <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-[#2e7d32]" />
                    <p className="text-[#333]">Cash on Delivery Available</p>
                  </div>
                </div>
              </div>

              <div className="border border-[#e8e8e8] bg-white p-4">
                <p className="mb-2 text-[13px] font-semibold text-[#333]">
                  Return &amp; Warranty
                </p>
                <div className="flex gap-2 text-[12px] text-[#333]">
                  <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-[#757575]" />
                  <span>14 days easy return</span>
                </div>
                <div className="mt-2 flex gap-2 text-[12px] text-[#757575]">
                  <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Warranty not available</span>
                </div>
              </div>

              <div className="border border-[#e8e8e8] bg-white p-4">
                <p className="text-[12px] text-[#757575]">Sold by</p>
                <div className="mt-1">
                  <span className="text-[14px] font-semibold text-[#333]">
                    {shopName}
                  </span>
                </div>
                <span className="mt-2 inline-block rounded bg-[#e3f2fd] px-2 py-0.5 text-[11px] font-semibold text-[#0F6AB0]">
                  Flagship Store
                </span>
                <ul className="mt-3 space-y-1.5 text-[11px] text-[#757575]">
                  <li>Positive Seller Ratings: —</li>
                  <li>Ship on Time: —</li>
                  <li>Chat Response: Fast</li>
                </ul>
                <Link
                  href="/products"
                  className="mt-3 inline-block text-[12px] font-semibold text-[#0F6AB0] hover:underline"
                >
                  GO TO STORE
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Description: text on top, full-width images below (when admin adds details) */}
        <div className="mt-4 border border-[#e8e8e8] bg-white p-4 sm:p-6">
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
          <section className="mt-6 border border-[#e8e8e8] bg-white p-4 sm:p-6">
            <h2 className="mb-4 text-[18px] font-semibold text-[#333]">
              Related Products
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
