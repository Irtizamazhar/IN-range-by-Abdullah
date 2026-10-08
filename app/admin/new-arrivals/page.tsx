"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "@/components/ui/LoadingLink";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
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
    return fetch("/api/new-arrivals")
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not load new arrivals"); return data; })
      .then((d) => setRows((d.products || []).filter((x: Row & { isNew?: boolean }) => x.isNew !== false)))
      .catch((error) => { toast.error(error instanceof Error ? error.message : "Could not load new arrivals"); })
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
    await load();
  }

  if (loading) return <PageSkeleton rows={3} />;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-darkText">New Arrivals</h1>
        <Link
          href="/admin/new-arrivals/add"
          className="rounded-xl bg-primaryYellow px-5 py-2.5 font-semibold text-brand-dark"
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
                  <Image
                    src={p.image}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg object-cover"
                    unoptimized={shouldUnoptimizeImageSrc(p.image)}
                  />
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
                  <LoadingButton loadingLabel="Removing…"
                    type="button"
                    onClick={() => remove(p.id)}
                    className="font-semibold text-red-600"
                  >
                    Delete
                  </LoadingButton>
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
