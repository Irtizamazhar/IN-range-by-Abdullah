"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { PRODUCT_REVIEWS_UPDATED_EVENT } from "@/lib/product-reviews-events";

const REVIEW_UPLOAD_FOLDER = "inrange-reviews";
const MAX_REVIEW_PHOTO_BYTES = 5 * 1024 * 1024;

export function VerifiedOrderReviewSection({ productId }: { productId: string }) {
  const searchParams = useSearchParams();
  const orderId = (searchParams?.get("orderId") || "").trim();
  const { data: session, status } = useSession();
  const { openAuthModal } = useCustomerAuth();
  const router = useRouter();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const isCustomer = session?.user?.role === "customer";

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    if (!orderId || status !== "authenticated" || !isCustomer) {
      setAlreadyReviewed(false);
      setEligible(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(
          `/api/reviews/check/${encodeURIComponent(orderId)}/${encodeURIComponent(productId)}`,
          { credentials: "include" }
        );
        if (cancelled) return;
        if (r.ok) {
          const d = (await r.json()) as { reviewed?: boolean; eligible?: boolean };
          setAlreadyReviewed(!!d.reviewed);
          setEligible(d.eligible !== false);
        } else {
          setEligible(false);
          setAlreadyReviewed(false);
        }
      } catch {
        if (!cancelled) setEligible(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, productId, status, isCustomer]);

  if (!orderId) return null;

  if (status === "loading") {
    return (
      <section className="mb-6 rounded-xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#757575]">Loading…</p>
      </section>
    );
  }

  if (!isCustomer) {
    return (
      <section className="mb-6 rounded-xl border border-[#F57224]/40 bg-orange-50/50 p-5 shadow-sm">
        <h2 className="text-[16px] font-semibold text-[#333]">Review this purchase</h2>
        <p className="mt-2 text-sm text-[#555]">
          Sign in with the account that matches your order email to submit a review.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal("login")}
          className="mt-4 rounded-lg bg-[#F57224] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e06520]"
        >
          Sign in
        </button>
      </section>
    );
  }

  if (alreadyReviewed || done) {
    return (
      <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-center shadow-sm">
        <p className="text-[16px] font-semibold text-emerald-900">
          Thank you for your review! ✅
        </p>
      </section>
    );
  }

  if (eligible === false) {
    return (
      <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
        <p className="text-sm text-amber-900">
          Reviews are only available after your order is marked delivered.
        </p>
      </section>
    );
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image (JPG, PNG, or WebP)");
      return;
    }
    if (file.size > MAX_REVIEW_PHOTO_BYTES) {
      toast.error("Photo must be 5MB or smaller");
      return;
    }
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhotoFile(file);
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        fd.append("folder", REVIEW_UPLOAD_FOLDER);
        const up = await fetch("/api/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const upData = (await up.json()) as { error?: string; url?: string };
        if (!up.ok) {
          toast.error(upData.error || "Photo upload failed");
          return;
        }
        if (!upData.url) {
          toast.error("Photo upload failed");
          return;
        }
        imageUrl = upData.url;
      }

      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId,
          productId,
          rating,
          comment: comment.trim(),
          ...(imageUrl ? { imageUrl } : {}),
        }),
      });
      const data = (await r.json()) as { error?: string; message?: string };
      if (!r.ok) {
        toast.error(data.error || "Could not submit review");
        return;
      }
      toast.success(data.message || "Thank you!");
      clearPhoto();
      setDone(true);
      router.refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(PRODUCT_REVIEWS_UPDATED_EVENT));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-[#e8e8e8] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-[16px] font-semibold text-[#333]">Rate your purchase</h2>
      <p className="mt-1 text-xs text-[#757575]">Your review will appear on this product page.</p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-[#333]">Your rating</p>
          <div
            className="mt-2 flex items-center gap-0.5"
            role="group"
            aria-label={`Star rating: ${rating} of 5`}
          >
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`rounded p-0.5 text-[28px] leading-none transition-colors hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F57224] ${
                  n <= rating ? "text-[#FFC400]" : "text-[#e0e0e0]"
                }`}
                aria-label={`Set rating to ${n} of 5 stars`}
                aria-pressed={n <= rating}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="verified-review-comment" className="text-sm font-medium text-[#333]">
            Share your experience…
          </label>
          <textarea
            id="verified-review-comment"
            rows={4}
            className="mt-1 w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#333] placeholder:text-[#999]"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you like? How was quality and delivery?"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-[#333]">Photo of your delivery (optional)</p>
          <p className="mt-0.5 text-xs text-[#757575]">
            JPG, PNG, or WebP — max 5MB. Shows on the product page with your review.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              ref={photoInputRef}
              id="verified-review-photo"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={onPhotoChange}
              className="max-w-full text-sm text-[#333] file:mr-3 file:rounded-lg file:border-0 file:bg-[#f3f3f3] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#333] hover:file:bg-[#e8e8e8]"
            />
          </div>
          {photoPreview ? (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#e0e0e0] bg-[#fafafa] p-2">
              <Image
                src={photoPreview}
                alt="Selected delivery photo preview"
                width={800}
                height={600}
                unoptimized
                className="mx-auto max-h-48 max-w-full object-contain"
              />
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-[#22c55e] px-8 py-3 text-sm font-bold text-white hover:bg-[#16a34a] disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>
    </section>
  );
}
