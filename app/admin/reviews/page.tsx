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
  const [busyId, setBusyId] = useState<number | null>(null);

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

  async function toggleApproved(id: number, next: boolean) {
    setBusyId(id);
    try {
      const rev = reviews.find((x) => x.id === id);
      const scope = rev?.scope === "newArrival" ? "newArrival" : "product";
      const r = await fetch(
        `/api/admin/reviews/${id}?scope=${encodeURIComponent(scope)}`,
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
        prev.map((x) => (x.id === id ? { ...x, approved: next } : x))
      );
      toast.success(next ? "Review approved" : "Review hidden");
    } catch {
      toast.error("Network error");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this review permanently?")) return;
    setBusyId(id);
    try {
      const rev = reviews.find((x) => x.id === id);
      const scope = rev?.scope === "newArrival" ? "newArrival" : "product";
      const r = await fetch(
        `/api/admin/reviews/${id}?scope=${encodeURIComponent(scope)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        }
      );
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }
      setReviews((prev) => prev.filter((x) => x.id !== id));
      toast.success("Review deleted");
    } catch {
      toast.error("Network error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-darkText mb-2">Reviews</h1>
      <p className="text-sm text-darkText/60 mb-8">
        Approve guest submissions before they appear on product and review pages.
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
              key={rev.id}
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
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-darkText/50">{rev.email}</p>
                  <p className="mt-2 text-sm font-semibold text-primaryBlue">
                    {rev.productName}
                    {rev.scope === "newArrival" ? (
                      <span className="ml-2 rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-800">
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
                    disabled={busyId === rev.id}
                    onClick={() => void toggleApproved(rev.id, !rev.approved)}
                    className="rounded-lg bg-primaryBlue px-3 py-2 text-xs font-bold text-white hover:bg-darkBlue disabled:opacity-50"
                  >
                    {rev.approved ? "Unapprove" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === rev.id}
                    onClick={() => void remove(rev.id)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
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
