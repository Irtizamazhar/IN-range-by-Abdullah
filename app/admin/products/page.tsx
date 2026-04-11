"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((product) =>
    String(product.name ?? "")
      .toLowerCase()
      .includes(q)
  );

  function reload() {
    fetch("/api/products?admin=1&limit=500")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function toggleActive(p: Record<string, unknown>) {
    const id = String(p._id);
    const next = !p.isActive;
    setProducts((list) =>
      list.map((x) => (String(x._id) === id ? { ...x, isActive: next } : x))
    );
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    if (!res.ok) {
      toast.error("Failed");
      reload();
      return;
    }
  }

  async function toggleBestSeller(p: Record<string, unknown>) {
    const id = String(p._id);
    const prev = Boolean(p.isBestSeller);
    const next = !prev;
    setProducts((list) =>
      list.map((x) =>
        String(x._id) === id ? { ...x, isBestSeller: next } : x
      )
    );
    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/bestseller`, {
      method: "PATCH",
      credentials: "same-origin",
    });
    if (!res.ok) {
      toast.error("Could not update best seller");
      reload();
      return;
    }
    toast.success(next ? "Marked best seller" : "Removed from best sellers");
  }

  async function del(id: string) {
    if (!confirm("Delete this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Delete failed");
    else {
      toast.success("Deleted");
      reload();
    }
  }

  if (loading) {
    return <div className="p-8 text-darkText/50">Loading…</div>;
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-darkText shrink-0">Products</h1>
        <div className="flex w-full min-w-0 flex-col gap-3 sm:ml-auto sm:w-auto sm:max-w-full sm:flex-row sm:items-center sm:justify-end">
          <label className="relative block w-full shrink-0 sm:w-80">
            <span className="sr-only">Search products</span>
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-base text-darkText/50"
              aria-hidden
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-borderGray bg-white py-2.5 pl-10 pr-4 text-sm text-darkText shadow-sm placeholder:text-darkText/40 focus:border-primaryBlue focus:outline-none focus:ring-2 focus:ring-primaryBlue/20"
            />
          </label>
          <Link
            href="/admin/products/add"
            className="shrink-0 rounded-xl bg-primaryYellow px-5 py-2.5 text-center font-semibold text-white"
          >
            Add Product
          </Link>
        </div>
      </div>
      {!loading && filteredProducts.length === 0 ? (
        <p className="mb-4 text-sm text-darkText/70">
          {searchQuery.trim()
            ? `No products found for "${searchQuery}"`
            : "No products yet."}
        </p>
      ) : null}
      <div className="rounded-card border border-borderGray bg-white overflow-x-auto shadow-card">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-borderGray bg-lightGray">
            <tr>
              <th className="p-3">Image</th>
              <th className="p-3">Name</th>
              <th className="p-3">Price</th>
              <th className="p-3">Original</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Active</th>
              <th className="p-3">Best Seller</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr
                key={String(p._id)}
                className="border-b border-borderGray hover:bg-lightGray/40"
              >
                <td className="p-3">
                  <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-lightGray">
                    {Array.isArray(p.images) && p.images[0] ? (
                      <Image
                        src={String((p.images as string[])[0])}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : null}
                  </div>
                </td>
                <td className="p-3 font-medium max-w-[180px] truncate">
                  {String(p.name)}
                </td>
                <td className="p-3">{formatPKR(Number(p.price))}</td>
                <td className="p-3">
                  {p.originalPrice
                    ? formatPKR(Number(p.originalPrice))
                    : "—"}
                </td>
                <td className="p-3">{String(p.stock)}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      p.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-darkText/10 text-darkText/60"
                    }`}
                  >
                    {p.isActive ? "ON" : "OFF"}
                  </button>
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => void toggleBestSeller(p)}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      p.isBestSeller
                        ? "bg-green-100 text-green-800"
                        : "bg-darkText/10 text-darkText/60"
                    }`}
                  >
                    {p.isBestSeller ? "ON" : "OFF"}
                  </button>
                </td>
                <td className="p-3 space-x-2">
                  <Link
                    href={`/admin/products/${p._id}/edit`}
                    className="text-primaryBlue font-semibold"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => del(String(p._id))}
                    className="text-red-600 font-semibold"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
