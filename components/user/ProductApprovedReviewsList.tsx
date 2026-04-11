"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { PublicReviewPostField } from "@/components/user/PublicReviewsSection";
import { PRODUCT_REVIEWS_UPDATED_EVENT } from "@/lib/product-reviews-events";

type ReviewItem = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  createdAt: string;
};

type Breakdown = { star: number; count: number; percent: number };

type ReviewsPayload = {
  reviews: ReviewItem[];
  averageRating: number;
  totalCount: number;
  breakdown: Breakdown[];
};

function reviewsQuery(postField: PublicReviewPostField) {
  if ("newArrivalId" in postField) {
    return `newArrivalId=${postField.newArrivalId}`;
  }
  return `productId=${encodeURIComponent(postField.productId)}`;
}

/** Daraz-style masked display name */
function maskName(name: string) {
  const t = name.trim();
  if (t.length <= 2) return t;
  if (t.length <= 4) return `${t[0]}**`;
  return `${t[0]}***${t[t.length - 1]}`;
}

function isLocalImg(src: string) {
  return src.startsWith("/api/") || src.startsWith("/uploads/");
}

function formatReviewDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function StarRowStatic({ rating }: { rating: number }) {
  const r = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span className="text-sm font-normal tracking-tight text-[#FFC400]" aria-hidden>
      {"★".repeat(r)}
      <span className="text-[#e0e0e0]">{"★".repeat(5 - r)}</span>
    </span>
  );
}

export function ProductApprovedReviewsList({
  postField,
}: {
  postField: PublicReviewPostField;
}) {
  const queryString = reviewsQuery(postField);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReviewsPayload | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void fetch(`/api/reviews?${queryString}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || typeof d !== "object") {
          setData(null);
          return;
        }
        setData(d as ReviewsPayload);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUpdate = () => load();
    window.addEventListener(PRODUCT_REVIEWS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PRODUCT_REVIEWS_UPDATED_EVENT, onUpdate);
  }, [load]);

  if (loading && !data) {
    return (
      <section className="mb-6 rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-5 sm:p-6">
        <p className="text-sm font-normal text-[#757575]">Loading reviews…</p>
      </section>
    );
  }

  const total = data?.totalCount ?? 0;
  const avg = data?.averageRating ?? 0;
  const breakdown = data?.breakdown ?? [];
  const reviews = data?.reviews ?? [];

  return (
    <section className="mb-6 rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="shrink-0">
          <p className="text-2xl font-bold text-[#333]">Customer reviews</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-5xl font-bold leading-none text-[#333]">
              {total > 0 ? avg.toFixed(1) : "—"}
            </span>
            <span className="text-sm font-normal text-[#757575]">
              / 5
              {total > 0 ? (
                <>
                  {" "}
                  <span className="text-[#333]">· {total}</span>{" "}
                  {total === 1 ? "rating" : "ratings"}
                </>
              ) : null}
            </span>
          </div>
          {total > 0 ? (
            <div className="mt-2">
              <StarRowStatic rating={Math.round(avg)} />
            </div>
          ) : null}
        </div>

        {total > 0 ? (
          <div className="min-w-0 flex-1 space-y-2 sm:max-w-md">
            {breakdown.map((row) => (
              <div
                key={row.star}
                className="flex items-center gap-2 text-xs font-normal text-[#555]"
              >
                <span className="w-8 shrink-0 text-[#757575]">{row.star} ★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f0f0f0]">
                  <div
                    className="h-full rounded-full bg-[#F57224]"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-[#999]">
                  {row.percent}%
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <p className="mt-4 border-t border-[#f0f0f0] pt-4 text-sm font-normal text-[#757575]">
          No reviews yet. After delivery, you can leave a review from your order /
          tracking page (open the product link from there).
        </p>
      ) : (
        <ul className="mt-6 space-y-0 divide-y divide-[#f0f0f0] border-t border-[#f0f0f0] pt-4">
          {reviews.map((r) => (
            <li key={r.id} className="flex gap-3 py-4 first:pt-2">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] text-sm font-bold text-[#757575]"
                aria-hidden
              >
                {maskName(r.name).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-base font-semibold text-[#333]">
                    {maskName(r.name)}
                  </span>
                  <StarRowStatic rating={r.rating} />
                  <span className="text-xs font-normal text-[#999]">
                    {formatReviewDate(r.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-base font-normal leading-relaxed text-[#555]">
                  {r.comment}
                </p>
                {r.imageUrl ? (
                  <div className="relative mt-3 h-24 w-24 overflow-hidden rounded-lg border border-[#eee] bg-[#fafafa]">
                    <Image
                      src={r.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                      unoptimized={isLocalImg(r.imageUrl)}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
