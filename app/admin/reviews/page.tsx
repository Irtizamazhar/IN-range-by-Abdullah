"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type AdminReview = {
  id: number;
  scope?: "product" | "newArrival";
  name: string;
  email: string;
  rating: number;
  comment: string;
  imageUrl?: string | null;
  createdAt: string;
  approved: boolean;
  withdrawn: boolean;
  verifiedPurchase: boolean;
  productId: string;
  productName: string;
};

function formatShort(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/reviews", { credentials: "same-origin" });
      const data = (await r.json()) as { reviews?: AdminReview[]; error?: string };
      if (!r.ok) {
        toast.error(data.error || "Could not load reviews");
        setReviews([]);
        return;
      }
      setReviews(data.reviews || []);
    } catch {
      toast.error("Failed to load reviews");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleApproved(review: AdminReview, next: boolean) {
    const key = `${review.scope ?? "product"}-${review.id}`;
    setBusyKey(key);
    try {
      const scope = review.scope === "newArrival" ? "newArrival" : "product";
      const r = await fetch(
        `/api/admin/reviews/${review.id}?scope=${encodeURIComponent(scope)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ approved: next }),
        }
      );
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        toast.error(data.error || "Update failed");
        return;
      }
      setReviews((prev) =>
        prev.map((item) =>
          item.id === review.id && item.scope === review.scope
            ? { ...item, approved: next }
            : item
        )
      );
      toast.success(next ? "Review approved" : "Review hidden");
    } catch {
      toast.error("Network error");
    } finally {
      setBusyKey(null);
    }
  }

  async function remove(review: AdminReview) {
    if (!window.confirm("Remove this review from public view? The original record will be preserved.")) return;
    const key = `${review.scope ?? "product"}-${review.id}`;
    setBusyKey(key);
    try {
      const scope = review.scope === "newArrival" ? "newArrival" : "product";
      const r = await fetch(
        `/api/admin/reviews/${review.id}?scope=${encodeURIComponent(scope)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        }
      );
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        toast.error(data.error || "Could not remove review");
        return;
      }
      setReviews((prev) =>
        prev.map((x) =>
          x.id === review.id && x.scope === review.scope
            ? { ...x, approved: false, withdrawn: x.scope !== "newArrival" }
            : x
        )
      );
      toast.success("Review removed; its history was preserved");
    } catch {
      toast.error("Network error");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-darkText mb-2">Reviews</h1>
      <p className="text-sm text-darkText/60 mb-8">
        Moderate purchase-backed reviews. Legacy guest rows remain available as
        history but cannot be published as verified reviews.
      </p>

      {loading ? (
        <div className="rounded-xl border border-borderGray bg-white p-12 text-center text-darkText/50">
          Loading reviews…
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-borderGray bg-lightGray/40 p-12 text-center text-darkText/60">
          No reviews yet.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div
              key={`${rev.scope ?? "product"}-${rev.id}`}
              className="rounded-xl border border-borderGray bg-white p-4 shadow-sm md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-darkText">{rev.name}</span>
                    {rev.approved ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                        Approved
                      </span>
                    ) : rev.withdrawn ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">
                        Removed
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                        Pending
                      </span>
                    )}
                    {rev.verifiedPurchase ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                        Verified Purchase
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                        Unverified legacy
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-darkText/50">{rev.email}</p>
                  <p className="mt-2 text-sm font-semibold text-primaryBlue">
                    {rev.productName}
                    {rev.scope === "newArrival" ? (
                      <span className="ml-2 rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-dark">
                        New arrival
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-lg leading-none text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={i < rev.rating ? "text-amber-500" : "text-gray-200"}
                      >
                        ★
                      </span>
                    ))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      busyKey === `${rev.scope ?? "product"}-${rev.id}` ||
                      (!rev.approved && (!rev.verifiedPurchase || rev.withdrawn))
                    }
                    onClick={() => void toggleApproved(rev, !rev.approved)}
                    className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold text-brand-dark hover:bg-brand-hover disabled:opacity-50"
                  >
                    {rev.approved
                      ? "Unapprove"
                      : rev.withdrawn
                        ? "Withdrawn"
                        : rev.verifiedPurchase
                          ? "Approve"
                          : "Not eligible"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      busyKey === `${rev.scope ?? "product"}-${rev.id}` ||
                      rev.withdrawn
                    }
                    onClick={() => void remove(rev)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {rev.scope === "newArrival" ? "Hide legacy" : "Withdraw"}
                  </button>
                </div>
              </div>
              {rev.imageUrl ? (
                <div className="relative mt-3 aspect-video w-full max-w-md overflow-hidden rounded-lg border border-borderGray bg-lightGray">
                  <Image
                    src={rev.imageUrl}
                    alt=""
                    fill
                    className="object-contain"
                    unoptimized
                    sizes="400px"
                  />
                </div>
              ) : null}
              <p className="mt-3 text-sm text-darkText/80 whitespace-pre-wrap">{rev.comment}</p>
              <p className="mt-3 text-xs text-darkText/45">{formatShort(rev.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
