"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";

type Row = {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string;
};

export default function AdminNewArrivalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/new-arrivals")
      .then((r) => r.json())
      .then((d) => setRows((d.products || []).filter((x: Row & { isNew?: boolean }) => x.isNew !== false)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: number) {
    if (!window.confirm("Delete this new arrival product?")) return;
    const res = await fetch(`/api/new-arrivals/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Deleted");
    load();
  }

  if (loading) return <div className="p-8 text-darkText/50">Loading…</div>;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-darkText">New Arrivals</h1>
        <Link
          href="/admin/new-arrivals/add"
          className="rounded-xl bg-primaryYellow px-5 py-2.5 font-semibold text-white"
        >
          Add New Product
        </Link>
      </div>

      <div className="overflow-x-auto rounded-card border border-borderGray bg-white shadow-card">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-borderGray bg-lightGray">
            <tr>
              <th className="p-3">Image</th>
              <th className="p-3">Name</th>
              <th className="p-3">Price</th>
              <th className="p-3">Category</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-borderGray hover:bg-lightGray/40">
                <td className="p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                </td>
                <td className="max-w-[220px] truncate p-3 font-medium">{p.name}</td>
                <td className="p-3">{formatPKR(p.price)}</td>
                <td className="p-3">{p.category}</td>
                <td className="space-x-2 p-3">
                  <Link
                    href={`/admin/new-arrivals/edit/${p.id}`}
                    className="font-semibold text-primaryBlue"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="font-semibold text-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="p-5 text-darkText/60" colSpan={5}>
                  No new arrivals yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
