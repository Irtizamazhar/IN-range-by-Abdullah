import Link from "next/link";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { syncVendorProductStorefront } from "@/lib/sync-vendor-product-storefront";
import { parseImagesJson } from "@/lib/vendor-product-schemas";
import { isProductInNewArrivalsWindow } from "@/lib/product-new-arrival-window";

export const dynamic = "force-dynamic";

function firstImage(images: unknown): string | null {
  const arr = parseImagesJson(images);
  return arr[0] ?? null;
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
            const showNewArrivalBadge =
              p.status === "active" &&
              storefrontCreatedAt != null &&
              isProductInNewArrivalsWindow(storefrontCreatedAt);
            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
              >
                <div className="flex shrink-0 items-center gap-3">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="h-16 w-16 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-500">
                      No img
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-neutral-900">{p.productName}</p>
                    <p className="text-sm text-neutral-600">
                      Rs. {p.price.toString()} · Stock {p.stock} ·{" "}
                      <span
                        className={
                          p.status === "active"
                            ? "text-green-700"
                            : "text-neutral-500"
                        }
                      >
                        {p.status}
                      </span>
                      {showNewArrivalBadge ? (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">
                          New on store (14d)
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="flex flex-1 justify-end gap-2">
                  <Link
                    href={`/vendor/dashboard/products/${p.id}/edit`}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
