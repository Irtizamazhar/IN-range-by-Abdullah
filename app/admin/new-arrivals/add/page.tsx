"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  imageFilesFromClipboard,
  isAllowedImageFile,
} from "@/lib/clipboard-image-files";

export default function AddNewArrivalPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [stock, setStock] = useState("0");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((list: Array<{ name?: string }>) => {
        const names = (list || [])
          .map((x) => String(x.name || "").trim())
          .filter(Boolean);
        setCategories(names);
        setCategory(names[0] || "");
      });
  }, []);

  async function onUpload(files: File[]) {
    setUploading(true);
    const urls: string[] = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "products-local");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          throw new Error(String(data.error || "Upload failed"));
        }
        urls.push(String(data.url));
      }
      return urls;
    } finally {
      setUploading(false);
    }
  }

  async function uploadAndAppendFiles(files: File[]) {
    const allowed = files.filter(isAllowedImageFile);
    if (!allowed.length) {
      toast.error("Use JPG, PNG, or WebP images");
      return;
    }
    try {
      const uploaded = await onUpload(allowed);
      setImages((prev) => [...prev, ...uploaded]);
      toast.success(
        uploaded.length > 1 ? `${uploaded.length} images added` : "Image added"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitLockRef.current) return;
    if (!name.trim() || !category.trim() || !price.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    if (images.length === 0) {
      toast.error("Add at least one image");
      return;
    }
    submitLockRef.current = true;
    setSaving(true);
    try {
      const res = await fetch("/api/new-arrivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: Number(price),
          originalPrice: originalPrice ? Number(originalPrice) : undefined,
          category,
          image: images[0],
          images,
          description: description.trim() || undefined,
          isFeatured,
          stock: Math.max(0, Number(stock || 0)),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(String(err.error || "Failed to add"));
        return;
      }
      toast.success("New arrival added");
      router.push("/admin/new-arrivals");
    } finally {
      submitLockRef.current = false;
      setSaving(false);
    }
  }

  function onPasteInZone(e: ClipboardEvent<HTMLDivElement>) {
    const pasted = imageFilesFromClipboard(e);
    const allowed = pasted.filter(isAllowedImageFile);
    if (!allowed.length) {
      toast.error(
        "No image in clipboard — copy a picture first (e.g. right-click → Copy image)"
      );
      return;
    }
    e.preventDefault();
    void uploadAndAppendFiles(allowed);
  }

  return (
    <div className="max-w-2xl p-6 md:p-8">
      <Link href="/admin/new-arrivals" className="text-sm text-primaryBlue">
        ← New Arrivals
      </Link>
      <h1 className="mb-6 mt-4 text-2xl font-bold text-darkText">Add New Arrival</h1>

      <form onSubmit={onSubmit} className="space-y-4 rounded-card border border-borderGray bg-white p-6 shadow-card">
        <input
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          placeholder="Product Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            type="number"
            className="rounded-xl border border-borderGray px-4 py-2"
            placeholder="Price (Rs.)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <input
            type="number"
            className="rounded-xl border border-borderGray px-4 py-2"
            placeholder="Original Price (optional)"
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
          />
        </div>
        <input
          type="number"
          min={0}
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          placeholder="Stock Quantity"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <select
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div>
          <label className="mb-1 block text-sm font-medium text-darkText">
            Product details (storefront)
          </label>
          <textarea
            className="min-h-[140px] w-full rounded-xl border border-borderGray px-4 py-2 text-sm"
            placeholder="Specifications, bullets, long description — shows above detail images on the product page (Daraz-style)."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="mt-1 text-xs text-darkText/60">
            Optional. Text appears first; product images appear below this block on the public page.
          </p>
        </div>

        <div
          tabIndex={0}
          onPaste={onPasteInZone}
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={(ev) => {
            ev.preventDefault();
            const picked = Array.from(ev.dataTransfer.files || []);
            if (!picked.length) return;
            void uploadAndAppendFiles(picked);
          }}
          className="space-y-2 rounded-xl border-2 border-dashed border-primaryBlue/40 bg-primaryBlue/5 p-4 text-center outline-none focus:ring-2 focus:ring-primaryBlue/50"
        >
          <p className="text-sm text-darkText/70">
            Drag &amp; drop, choose files, or{" "}
            <strong className="text-darkText">click here and press Ctrl+V</strong> (⌘+V on Mac).
            Images upload automatically — no extra button.
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              e.target.value = "";
              if (!picked.length) return;
              void uploadAndAppendFiles(picked);
            }}
            className="text-sm"
          />
          {images.length > 0 ? (
            <p className="text-xs text-green-700">{images.length} image(s) on product</p>
          ) : null}
          {uploading ? <p className="text-xs text-darkText/60">Uploading…</p> : null}
          {images.length ? (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={`${img}-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-20 w-20 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-red-600 text-xs text-white"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
          />
          Is Featured?
        </label>
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-xl bg-primaryBlue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
