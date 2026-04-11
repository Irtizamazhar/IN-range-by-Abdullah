"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { uploadPublicReviewPhoto } from "@/lib/review-guest-upload";

export type PublicReviewPostField =
  | { productId: string }
  | { newArrivalId: number };

function isNewArrivalField(
  f: PublicReviewPostField
): f is { newArrivalId: number } {
  return "newArrivalId" in f;
}

export function PublicReviewsSection({
  postField,
}: {
  postField: PublicReviewPostField;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onPickPhoto = useCallback((file: File | null) => {
    setPhoto(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) {
      toast.error("Please add a photo of the product you received");
      return;
    }
    setSubmitting(true);
    try {
      const { url } = await uploadPublicReviewPhoto(photo);
      const body: Record<string, unknown> = {
        name,
        email,
        rating,
        comment: comment.trim(),
        imageUrl: url,
      };
      if (isNewArrivalField(postField)) {
        body.newArrivalId = postField.newArrivalId;
      } else {
        body.productId = postField.productId;
      }
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as { error?: string; message?: string };
      if (!r.ok) {
        toast.error(data.error || "Could not submit review");
        return;
      }
      toast.success(data.message || "Thanks! Your review was submitted.");
      setDone(true);
      setName("");
      setEmail("");
      setRating(5);
      setComment("");
      setPhoto(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="mx-auto mt-12 max-w-lg rounded-2xl border border-borderGray bg-lightGray/30 p-6 text-center md:p-8">
        <p className="font-semibold text-darkText">Thanks — we received your review.</p>
        <p className="mt-2 text-sm text-darkText/70">
          It will appear after the team approves it.
        </p>
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-primaryBlue hover:underline"
          onClick={() => setDone(false)}
        >
          Write another review
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-12 max-w-lg rounded-2xl border border-borderGray bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-lg font-bold text-darkText md:text-xl">Write a review</h2>
      <p className="mt-1 text-sm text-darkText/60">
        Share a photo, your name and email, and a star rating. Comments are optional.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-darkText">Photo</label>
          <p className="mt-1 text-xs text-darkText/50">
            JPG, PNG, or WebP · max 5MB
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 block w-full text-sm text-darkText file:mr-3 file:rounded-lg file:border-0 file:bg-primaryBlue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            <div className="relative mt-3 aspect-video w-full max-h-48 overflow-hidden rounded-xl border border-borderGray bg-lightGray">
              <Image
                src={preview}
                alt="Preview"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-darkText">Name</label>
            <input
              required
              className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-darkText">Email</label>
            <input
              required
              type="email"
              className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-darkText">Rating</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Star rating">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  rating === n
                    ? "bg-primaryYellow text-white"
                    : "border border-borderGray text-darkText hover:border-primaryBlue"
                }`}
              >
                {n} ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-darkText">
            Comment <span className="font-normal text-darkText/50">(optional)</span>
          </label>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2 text-sm"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How was your experience?"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primaryBlue py-3.5 font-bold text-white hover:bg-darkBlue disabled:opacity-50 sm:w-auto sm:px-10"
        >
          {submitting ? "Sending…" : "Submit review"}
        </button>
      </form>
    </section>
  );
}
