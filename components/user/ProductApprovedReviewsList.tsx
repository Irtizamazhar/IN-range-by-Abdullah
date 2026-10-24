"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleMore, Star } from "lucide-react";
import { useReviewRefresh } from "@/hooks/useReviewRefresh";

export type ReviewDisplayField =
  | { productId: string }
  | { newArrivalId: number };

type ReviewItem = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  createdAt: string;
  verifiedPurchase: true;
};

type Breakdown = {
  star: number;
  count: number;
  percent: number;
};

type ReviewsPayload = {
  reviews: ReviewItem[];
  averageRating: number;
  totalCount: number;
  breakdown: Breakdown[];
};

/** Reviews listed before "See All" expands the rest. */
const PREVIEW_COUNT = 3;

function reviewsQuery(postField: ReviewDisplayField) {
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

function Stars({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  const r = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`${size} ${i < r ? "fill-[#F5B301] text-[#F5B301]" : "fill-none text-[#F5B301]"}`}
          strokeWidth={1.8}
        />
      ))}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="customer-reviews-title"
      className="min-w-0 rounded-xl border border-[#E5E9E5] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,16,0.05)] sm:p-5"
    >
      {children}
    </section>
  );
}

export function ProductApprovedReviewsList({
  postField,
  onStats,
}: {
  postField: ReviewDisplayField;
  onStats?: (stats: { averageRating: number; totalCount: number }) => void;
}) {
  const queryString = reviewsQuery(postField);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReviewsPayload | null>(null);
  const [showAll, setShowAll] = useState(false);
  const requestVersion = useRef(0);

  const load = useCallback(() => {
    const version = ++requestVersion.current;
    setLoading(true);
    return fetch(`/api/reviews?${queryString}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("Could not load reviews. Please try again."); return r.json(); })
      .then((d) => {
        if (version !== requestVersion.current) return;
        if (!d || typeof d !== "object") {
          setData(null);
          return;
        }
        setData(d as ReviewsPayload); setError("");
        onStats?.({ averageRating: d.averageRating, totalCount: d.totalCount });
      })
      .catch(() => { if (version === requestVersion.current) setError("Could not load reviews. Please try again."); })
      .finally(() => { if (version === requestVersion.current) setLoading(false); });
  }, [queryString, onStats]);

  useEffect(() => {
    const requests = requestVersion;
    setData(null);
    setError("");
    setShowAll(false);
    load();
    return () => { requests.current++; };
  }, [load]);

  useReviewRefresh(load);

  const heading = (
    <h2 id="customer-reviews-title" className="text-[18px] font-bold text-[#172033] sm:text-[20px]">
      Customer Reviews
    </h2>
  );

  if (loading && !data && !error) {
    return (
      <Card>
        {heading}
        <div className="mt-4">
          <PageSkeleton label="Loading reviews…" rows={2} />
        </div>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card>
        {heading}
        <p role="alert" className="mt-3 text-sm text-[#4B5563]">{error}</p>
        <LoadingButton onClick={load} className="mt-3 rounded-lg bg-brand-soft px-4 py-2 text-sm font-semibold">Try again</LoadingButton>
      </Card>
    );
  }

  const total = data?.totalCount ?? 0;
  const avg = data?.averageRating ?? 0;
  const breakdown = [5, 4, 3, 2, 1].map(
    (star) => data?.breakdown?.find((row) => row.star === star) ?? { star, count: 0, percent: 0 }
  );
  const reviews = data?.reviews ?? [];
  const visible = showAll ? reviews : reviews.slice(0, PREVIEW_COUNT);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        {heading}
        {reviews.length > PREVIEW_COUNT ? (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            aria-expanded={showAll}
            className="min-h-11 shrink-0 rounded-md px-2 text-[13px] font-semibold text-[#00543D] hover:underline"
          >
            {showAll ? "Show Less" : "See All"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-5 min-[420px]:grid-cols-[auto_minmax(0,1fr)] min-[420px]:items-center sm:gap-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[38px] font-bold leading-none text-[#172033] sm:text-[42px]">
              {avg.toFixed(1)}
            </span>
            <Stars rating={avg} size="h-6 w-6" />
          </div>
          <p className="mt-2 text-[13px] text-[#6B7280]">
            Based on {total} {total === 1 ? "review" : "reviews"}
          </p>
          <span className="sr-only">Average rating {avg.toFixed(1)} out of 5</span>
        </div>

        <ul className="min-w-0 space-y-1.5" aria-label="Rating distribution">
          {breakdown.map((row) => (
            <li key={row.star} className="flex items-center gap-2 text-[12px] text-[#4B5563]">
              <span className="w-3 shrink-0 text-right tabular-nums">{row.star}</span>
              <Star aria-hidden className="h-3.5 w-3.5 shrink-0 fill-[#F5B301] text-[#F5B301]" />
              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EEF0EC]">
                <span
                  className="block h-full rounded-full bg-[#F5B301]"
                  style={{ width: `${row.percent}%` }}
                />
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-[#6B7280]">
                {row.percent}%
                <span className="sr-only"> of reviews gave {row.star} stars</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {total === 0 ? (
        <div className="mt-6 flex items-center justify-center gap-4 border-t border-[#EEF1EC] pt-6">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3F4F1] text-[#6B7280]">
            <MessageCircleMore className="h-7 w-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#172033]">No approved reviews yet</p>
            <p className="mt-0.5 text-[13px] text-[#6B7280]">
              Reviews appear here after admin approval.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-[#EEF1EC] border-t border-[#EEF1EC]">
          {visible.map((r) => (
            <li key={r.id} className="flex gap-3 py-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F6F1] text-sm font-bold text-[#00543D]"
                aria-hidden
              >
                {maskName(r.name).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[14px] font-semibold text-[#172033]">
                    {maskName(r.name)}
                  </span>
                  <Stars rating={r.rating} size="h-3.5 w-3.5" />
                  <span className="sr-only">Rated {r.rating} out of 5</span>
                  <span className="text-[12px] text-[#9CA3AF]">
                    {formatReviewDate(r.createdAt)}
                  </span>
                  {r.verifiedPurchase ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      Verified Purchase
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#4B5563]">
                  {r.comment}
                </p>
                {r.imageUrl ? (
                  <div className="relative mt-3 h-20 w-20 overflow-hidden rounded-lg border border-[#EEF1EC] bg-[#FAFBF8]">
                    <Image
                      src={r.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized={isLocalImg(r.imageUrl)}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
