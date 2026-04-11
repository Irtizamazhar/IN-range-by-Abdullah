import Image from "next/image";
import Link from "next/link";
import { getApprovedPublicReviews } from "@/lib/public-reviews-list";

export const dynamic = "force-dynamic";

function formatDate(iso: Date) {
  try {
    return iso.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default async function CustomerReviewsPage() {
  let error: string | null = null;
  let reviews: Awaited<ReturnType<typeof getApprovedPublicReviews>> = [];

  try {
    reviews = await getApprovedPublicReviews();
  } catch {
    error = "We couldn’t load reviews right now. Please try again later.";
  }

  const totalCount = reviews.length;
  const averageRating =
    totalCount > 0
      ? Math.round(
          (reviews.reduce((s, r) => s + r.rating, 0) / totalCount) * 10
        ) / 10
      : 0;

  const breakdown = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    return {
      star,
      count,
      percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    };
  });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-darkText">Customer Reviews</h1>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <header className="text-center">
        <h1 className="text-3xl font-black text-darkText md:text-4xl">
          Customer Reviews
        </h1>
        <p className="mt-3 text-lg text-darkText/70">
          {totalCount > 0 ? (
            <>
              <span className="font-bold text-darkText">{totalCount}</span>{" "}
              {totalCount === 1 ? "customer has" : "customers have"} rated us{" "}
              <span className="font-bold text-primaryBlue">{averageRating}/5</span>
            </>
          ) : (
            <>Be the first to leave a review on a product or new arrival page.</>
          )}
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-borderGray bg-white p-6 shadow-card md:p-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-darkText/50">
          Overall stats
        </h2>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-5xl font-black text-darkText">
              {totalCount > 0 ? averageRating.toFixed(1) : "—"}
            </p>
            <p className="mt-1 text-sm text-darkText/60">
              {totalCount} approved {totalCount === 1 ? "review" : "reviews"}
            </p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            {breakdown.map((row) => (
              <div key={row.star} className="flex items-center gap-2 text-sm">
                <span className="w-8 font-medium">{row.star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-lightGray">
                  <div
                    className="h-full rounded-full bg-primaryYellow"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-darkText/50">
                  {row.percent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {totalCount === 0 ? (
        <p className="mx-auto mt-12 max-w-lg text-center text-darkText/60">
          No public reviews yet. Purchased something? Open any product and share your thoughts — we
          approve reviews quickly.
        </p>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <article
              key={`${r.scope}-${r.id}`}
              className="flex flex-col rounded-2xl border border-borderGray border-t-4 border-t-primaryYellow bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <p className="text-lg leading-none text-yellow-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={i < r.rating ? "text-yellow-400" : "text-gray-200"}
                  >
                    ★
                  </span>
                ))}
              </p>
              {r.imageUrl ? (
                <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-lg border border-borderGray bg-lightGray">
                  <Image
                    src={r.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width:640px) 100vw, 280px"
                    unoptimized
                  />
                </div>
              ) : null}
              <p className="mt-3 font-semibold text-darkText">{r.name}</p>
              <Link
                href={r.itemHref}
                className="mt-1 text-sm font-medium text-primaryBlue hover:underline"
              >
                {r.itemName}
              </Link>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-darkText/80 whitespace-pre-wrap">
                {r.comment}
              </p>
              <p className="mt-4 text-xs text-darkText/45">{formatDate(r.createdAt)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
