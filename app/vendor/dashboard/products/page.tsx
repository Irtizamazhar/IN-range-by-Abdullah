import Link from "next/link";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { syncVendorProductStorefront } from "@/lib/sync-vendor-product-storefront";
import { parseImagesJson } from "@/lib/vendor-product-schemas";
import { isProductInNewArrivalsWindow } from "@/lib/product-new-arrival-window";

export const dynamic = "force-dynamic";

const MS_PER_DAY = 86_400_000;

function firstImage(images: unknown): string | null {
  const arr = parseImagesJson(images);
  return arr[0] ?? null;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-PK");
}

export default async function VendorProductsPage() {
  const row = await getVendorFromSession();
  if (!row) {
    redirect("/vendor/login");
  }
  const v = row.vendor;
  const approved = v.status === "approved";

  const products = approved
    ? await prisma.vendorProduct.findMany({
        where: { vendorId: v.id },
        orderBy: { updatedAt: "desc" },
        include: {
          publishedProduct: { select: { createdAt: true } },
        },
      })
    : [];

  if (approved && products.length > 0) {
    const needsPublish = products.filter(
      (p) => p.status === "active" && !p.publishedProductId
    );
    await Promise.all(
      needsPublish.map((p) =>
        syncVendorProductStorefront(p.id).catch((err) =>
          console.error("vendor storefront backfill", p.id, err)
        )
      )
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-bold text-darkText">
            My products
          </h1>
          <p className="mt-1 text-sm text-darkText/70">
            Add and edit your catalog. Only approved shops can publish.
          </p>
        </div>
        {approved ? (
          <Link
            href="/vendor/dashboard/products/new"
            className="inline-flex items-center justify-center rounded-xl bg-primaryYellow px-5 py-3 text-sm font-extrabold text-neutral-900 shadow-sm hover:brightness-95"
          >
            + Add product
          </Link>
        ) : null}
      </div>

      {!approved ? (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          Your shop is still <strong>{v.status}</strong>. After admin approves
          your account, you can upload products here.
        </div>
      ) : null}

      {approved && products.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">
          <p>No products yet.</p>
          <Link
            href="/vendor/dashboard/products/new"
            className="mt-4 inline-block font-bold text-amber-700 underline"
          >
            Create your first product
          </Link>
        </div>
      ) : null}

      {approved && products.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {products.map((p) => {
            const img = firstImage(p.images);
            const storefrontCreatedAt = p.publishedProduct?.createdAt;
            const uploadedOnLabel = storefrontCreatedAt
              ? formatDateLabel(storefrontCreatedAt)
              : null;
            const featuredAt = storefrontCreatedAt
              ? new Date(storefrontCreatedAt.getTime() + 14 * MS_PER_DAY)
              : null;
            const featuredOnLabel = featuredAt ? formatDateLabel(featuredAt) : null;
            const daysUntilFeatured =
              featuredAt != null
                ? Math.max(
                    0,
                    Math.ceil((featuredAt.getTime() - Date.now()) / MS_PER_DAY)
                  )
                : null;
            const daysElapsed =
              storefrontCreatedAt != null
                ? Math.max(
                    0,
                    Math.min(
                      14,
                      Math.floor(
                        (Date.now() - storefrontCreatedAt.getTime()) / MS_PER_DAY
                      )
                    )
                  )
                : 0;
            const progressPct = Math.round((daysElapsed / 14) * 100);
            const showNewArrivalBadge =
              p.status === "active" &&
              storefrontCreatedAt != null &&
              isProductInNewArrivalsWindow(storefrontCreatedAt);
            const isFeaturedNow =
              p.status === "active" &&
              storefrontCreatedAt != null &&
              !showNewArrivalBadge;
            return (
              <li
                key={p.id}
                className="rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    <span aria-hidden>🏪</span>
                    <span>{v.shopName}</span>
                  </span>
                  {showNewArrivalBadge ? (
                    <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 px-2.5 py-1 text-xs font-bold text-amber-950">
                      New Arrival 🆕
                    </span>
                  ) : null}
                  {isFeaturedNow ? (
                    <span className="rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-2.5 py-1 text-xs font-bold text-white">
                      Featured ⭐
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4">
                  <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl border bg-neutral-50">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-xs text-neutral-500">No image</div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="truncate text-xl font-bold text-neutral-900">
                        {p.productName}
                      </p>
                      <Link
                        href={`/vendor/dashboard/products/${p.id}/edit`}
                        className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-semibold text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-50"
                      >
                        Edit
                      </Link>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-extrabold text-emerald-600">
                        ⭐ Rs. {formatPrice(p.price)}
                      </span>
                      <span className="text-neutral-600">📦 Stock: {p.stock}</span>
                      <span className="inline-flex items-center gap-1 text-neutral-700">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            p.status === "active" ? "bg-emerald-500" : "bg-neutral-400"
                          }`}
                          aria-hidden
                        />
                        {p.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-neutral-600">
                      <p>📅 Listed: {uploadedOnLabel ?? "Not published yet"}</p>
                      <p>🚀 Featured on: {featuredOnLabel ?? "Pending publish"}</p>
                      {storefrontCreatedAt ? (
                        <>
                          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
                            <div
                              className="h-full rounded-full bg-orange-400 transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <p className="font-semibold text-amber-700">
                            ⏳ {Math.max(0, daysUntilFeatured ?? 0)} day
                            {Math.max(0, daysUntilFeatured ?? 0) === 1 ? "" : "s"}{" "}
                            left in New ({progressPct}% elapsed)
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
