import Link from "next/link";
import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { formatPKR } from "@/lib/format";
import { getVendorShopStats } from "@/lib/vendor-shop-order-stats";

export const dynamic = "force-dynamic";

type RecentRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  status: string;
  dateLabel: string;
};

/** Collapse duplicated halves like "First Last First Last" stored in `ownerName`. */
function vendorWelcomeDisplayName(ownerName: string): string {
  const t = ownerName.trim().replace(/\s+/g, " ");
  const parts = t.split(" ");
  if (parts.length >= 2 && parts.length % 2 === 0) {
    const half = parts.length / 2;
    const a = parts.slice(0, half).join(" ");
    const b = parts.slice(half).join(" ");
    if (a === b) return a;
  }
  return t;
}

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "delivered") return "bg-green-100 text-green-700";
  if (s === "pending") return "bg-amber-100 text-amber-800";
  if (s === "cancelled") return "bg-red-100 text-red-700";
  if (s === "shipped") return "bg-orange-100 text-orange-800";
  if (s === "confirmed") return "bg-blue-100 text-blue-800";
  if (s === "packed") return "bg-purple-100 text-purple-800";
  return "bg-sky-100 text-sky-700";
}

export default async function VendorDashboardPage() {
  const row = await getVendorFromSession();
  if (!row) {
    redirect("/vendor/login");
  }
  const v = row.vendor;
  const approved = v.status === "approved";

  let openShopBundles = 0;
  let revenue = 0;
  let productCount = 0;
  let recent: RecentRow[] = [];
  let shopStats = {
    ordersToday: 0,
    pending: 0,
    shipped: 0,
    cancelled: 0,
  };

  if (approved) {
    const [
      productCountRes,
      deliveredLines,
      recentShops,
      stats,
      openBundles,
    ] = await Promise.all([
      prisma.vendorProduct.count({ where: { vendorId: v.id } }),
      prisma.vendorOrder.findMany({
        where: { vendorId: v.id, status: "delivered" },
        select: { vendorAmount: true },
      }),
      prisma.vendorShopOrder.findMany({
        where: { vendorId: v.id },
        orderBy: { placedAt: "desc" },
        take: 10,
        include: {
          order: { select: { orderNumber: true } },
        },
      }),
      getVendorShopStats(v.id),
      prisma.vendorShopOrder.count({
        where: {
          vendorId: v.id,
          status: {
            in: ["pending", "confirmed", "packed", "shipped"],
          },
        },
      }),
    ]);
    productCount = productCountRes;
    openShopBundles = openBundles;
    revenue = deliveredLines.reduce(
      (s, o) => s + Number(o.vendorAmount),
      0
    );
    shopStats = stats;
    recent = recentShops.map((r) => ({
      id: r.id,
      orderNumber: r.shopOrderNumber,
      customerName: r.customerName,
      amount: Number(r.totalAmount),
      status: r.status,
      dateLabel: r.placedAt.toLocaleDateString("en-PK"),
    }));
  }

  return (
    <div className="max-w-6xl p-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-bold text-darkText">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-darkText/70">
            Welcome,{" "}
            <span className="font-semibold">
              {vendorWelcomeDisplayName(v.ownerName)}
            </span>{" "}
            👋
          </p>
        </div>
        {approved ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/vendor/dashboard/products/new"
              className="rounded-xl bg-primaryBlue px-5 py-2.5 font-semibold text-white hover:bg-darkBlue"
            >
              + Add product
            </Link>
            <Link
              href="/vendor/dashboard/orders"
              className="rounded-xl border border-borderGray bg-white px-5 py-2.5 font-semibold text-darkText hover:bg-lightGray/40"
            >
              My orders
            </Link>
            <Link
              href="/vendor/dashboard/products"
              className="rounded-xl border border-borderGray bg-white px-5 py-2.5 font-semibold text-darkText hover:bg-lightGray/40"
            >
              My products
            </Link>
          </div>
        ) : null}
      </div>

      {!approved ? (
        <div className="mb-8 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your account is <strong>{v.status}</strong>. You can browse this
          panel, but orders and catalog tools unlock after admin approval.
        </div>
      ) : null}

      {approved ? (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-darkText/50">
            Order hub
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/vendor/dashboard/orders"
              className="rounded-card border border-borderGray bg-amber-50 p-4 shadow-card transition hover:ring-2 hover:ring-amber-300"
            >
              <p className="text-xs uppercase text-amber-700">Orders today</p>
              <p className="mt-1 text-3xl font-extrabold text-amber-700">
                {shopStats.ordersToday}
              </p>
              <p className="mt-1 text-xs text-darkText/60">All statuses</p>
            </Link>
            <Link
              href="/vendor/dashboard/orders?status=pending"
              className="rounded-card border border-borderGray bg-amber-50 p-4 shadow-card transition hover:ring-2 hover:ring-amber-300"
            >
              <p className="text-xs uppercase text-amber-700">Pending</p>
              <p className="mt-1 text-3xl font-extrabold text-amber-700">
                {shopStats.pending}
              </p>
              <p className="mt-1 text-xs text-darkText/60">Needs your action</p>
            </Link>
            <Link
              href="/vendor/dashboard/orders?status=shipped"
              className="rounded-card border border-borderGray bg-orange-50 p-4 shadow-card transition hover:ring-2 hover:ring-orange-300"
            >
              <p className="text-xs uppercase text-orange-700">Shipped</p>
              <p className="mt-1 text-3xl font-extrabold text-orange-700">
                {shopStats.shipped}
              </p>
              <p className="mt-1 text-xs text-darkText/60">With courier</p>
            </Link>
            <Link
              href="/vendor/dashboard/orders?status=cancelled"
              className="rounded-card border border-borderGray bg-red-50 p-4 shadow-card transition hover:ring-2 hover:ring-red-200"
            >
              <p className="text-xs uppercase text-red-700">Cancelled</p>
              <p className="mt-1 text-3xl font-extrabold text-red-700">
                {shopStats.cancelled}
              </p>
              <p className="mt-1 text-xs text-darkText/60">Shop bundles</p>
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Open shop orders", String(openShopBundles)],
          ["Your earnings (PKR)", formatPKR(revenue)],
          ["My products", String(productCount)],
        ].map(([label, val], idx) => (
          <div
            key={label}
            className={`rounded-card border border-borderGray p-4 shadow-card ${
              idx === 0 ? "bg-sky-50" : idx === 1 ? "bg-amber-50" : "bg-sky-50"
            }`}
          >
            <p
              className={`text-xs uppercase ${
                idx === 1 ? "text-amber-700" : "text-sky-500"
              }`}
            >
              {label}
            </p>
            <p
              className={`mt-1 text-3xl font-extrabold ${
                idx === 1 ? "text-amber-700" : "text-sky-500"
              }`}
            >
              {val}
            </p>
            <p className="mt-1 text-xs text-darkText/60">
              {idx === 0
                ? "Pending through shipped bundles"
                : idx === 1
                  ? "From delivered line items"
                  : "Active catalog SKUs"}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mb-4 text-lg font-bold text-darkText">
        Recent shop orders
      </h2>
      <div className="overflow-x-auto rounded-card border border-borderGray bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-primaryYellow bg-primaryYellow text-white">
            <tr>
              <th className="p-3">Order#</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-darkText/50"
                >
                  {approved
                    ? "No orders yet containing your products."
                    : "—"}
                </td>
              </tr>
            ) : (
              recent.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-borderGray odd:bg-white even:bg-sky-50 hover:bg-amber-50"
                >
                  <td className="p-3 font-semibold text-sky-500">
                    <Link
                      href={`/vendor/dashboard/orders/${row.id}`}
                      className="hover:underline"
                    >
                      {row.orderNumber}
                    </Link>
                  </td>
                  <td className="p-3">{row.customerName}</td>
                  <td className="p-3">{formatPKR(row.amount)}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 text-darkText/60">{row.dateLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
