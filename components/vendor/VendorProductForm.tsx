"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { parseImagesJson } from "@/lib/vendor-product-schemas";

const CATEGORIES = [
  "Clothing",
  "Electronics",
  "Food",
  "Beauty",
  "Other",
] as const;

export type VendorProductFormInitial = {
  productName: string;
  description: string;
  price: string;
  category: string;
  stock: number;
  images: unknown;
  status?: "active" | "inactive";
};

export function VendorProductForm({
  mode,
  productId,
  initial,
}: {
  mode: "create" | "edit";
  productId?: string;
  initial?: VendorProductFormInitial;
}) {
  const router = useRouter();
  const [productName, setProductName] = useState(
    initial?.productName ?? ""
  );
  const [description, setDescription] = useState(
    initial?.description ?? ""
  );
  const [price, setPrice] = useState(initial?.price ?? "");
  const [category, setCategory] = useState(
    initial?.category ?? CATEGORIES[0]
  );
  const categoryOptions = Array.from(
    new Set<string>([category, ...CATEGORIES])
  );
  const [stock, setStock] = useState(String(initial?.stock ?? 0));
  const [images, setImages] = useState<string[]>(() =>
    parseImagesJson(initial?.images)
  );
  const [status, setStatus] = useState<"active" | "inactive">(
    initial?.status ?? "active"
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const next = [...images];
      for (let i = 0; i < files.length; i++) {
        if (next.length >= 8) {
          toast.error("Maximum 8 images");
          break;
        }
        const file = files[i];
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/vendor/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await r.json()) as { url?: string; error?: string };
        if (!r.ok) {
          toast.error(data.error || "Upload failed");
          continue;
        }
        if (data.url) next.push(data.url);
      }
      setImages(next);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = Number(price);
    const stockNum = parseInt(stock, 10);
    if (!productName.trim() || !description.trim()) {
      toast.error("Name and description are required");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      toast.error("Enter a valid stock");
      return;
    }
    if (images.length < 1) {
      toast.error("Add at least one product image");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const r = await fetch("/api/vendor/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            productName: productName.trim(),
            description: description.trim(),
            price: priceNum,
            category,
            stock: stockNum,
            images,
          }),
        });
        const data = (await r.json()) as { error?: string };
        if (!r.ok) {
          toast.error(data.error || "Could not save");
          return;
        }
        toast.success("Product created");
        router.push("/vendor/dashboard/products");
        router.refresh();
        return;
      }

      if (!productId) return;
      const r = await fetch(
        `/api/vendor/products/${encodeURIComponent(productId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            productName: productName.trim(),
            description: description.trim(),
            price: priceNum,
            category,
            stock: stockNum,
            images,
            status,
          }),
        }
      );
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        toast.error(data.error || "Could not update");
        return;
      }
      toast.success("Product updated");
      router.push("/vendor/dashboard/products");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (mode !== "edit" || !productId) return;
    if (!window.confirm("Delete this product permanently?")) return;
    setDeleting(true);
    try {
      const r = await fetch(
        `/api/vendor/products/${encodeURIComponent(productId)}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }
      toast.success("Product removed");
      router.push("/vendor/dashboard/products");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm"
    >
      <h1 className="text-xl font-extrabold text-neutral-900">
        {mode === "create" ? "New product" : "Edit product"}
      </h1>

      <div>
        <label className="text-sm font-bold text-neutral-800">Name</label>
        <input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          required
          maxLength={200}
        />
      </div>

      <div>
        <label className="text-sm font-bold text-neutral-800">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-bold text-neutral-800">Price (PKR)</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="text-sm font-bold text-neutral-800">Stock</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-bold text-neutral-800">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {mode === "edit" ? (
          <div>
            <label className="text-sm font-bold text-neutral-800">
              Listing status
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "active" | "inactive")
              }
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            >
              <option value="active">Active (visible)</option>
              <option value="inactive">Inactive (hidden)</option>
            </select>
          </div>
        ) : null}
      </div>

      <div>
        <label className="text-sm font-bold text-neutral-800">
          Images (1–8, JPG/PNG/WebP, max 5MB each)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading || images.length >= 8}
          onChange={(e) => void onPickFiles(e.target.files)}
          className="mt-2 block w-full text-sm"
        />
        {uploading ? (
          <p className="mt-2 text-sm text-amber-700">Uploading…</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3">
          {images.map((url, idx) => (
            <div key={`${url}-${idx}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-24 w-24 rounded-lg border object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 text-xs font-bold text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-xl bg-primaryYellow px-6 py-3 font-extrabold text-neutral-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Publish product" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/vendor/dashboard/products")}
          className="rounded-xl border border-neutral-300 px-6 py-3 font-bold text-neutral-700"
        >
          Cancel
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            disabled={deleting}
            onClick={() => void onDelete()}
            className="rounded-xl border border-red-300 px-6 py-3 font-bold text-red-700 disabled:opacity-50"
          >
            {deleting ? "…" : "Delete"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
