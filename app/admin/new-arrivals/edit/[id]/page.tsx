"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  imageFilesFromClipboard,
  isAllowedImageFile,
} from "@/lib/clipboard-image-files";

type Item = {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  image: string;
  images?: string[];
  description?: string;
  isFeatured: boolean;
  stock: number;
  inStock: boolean;
};

export default function EditNewArrivalPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");

  const [item, setItem] = useState<Item | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/new-arrivals/${id}`)
      .then((r) => r.json())
      .then((p) =>
        setItem({
          ...(p as Item),
          images: Array.isArray((p as Item).images)
            ? (p as Item).images
            : (p as Item).image
              ? [(p as Item).image]
              : [],
        })
      );
    fetch("/api/categories")
      .then((r) => r.json())
      .then((list: Array<{ name?: string }>) => {
        const names = (list || [])
          .map((x) => String(x.name || "").trim())
          .filter(Boolean);
        setCategories(names);
      });
  }, [id]);

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
      setItem((prev) => {
        if (!prev) return prev;
        const imgs = [...(prev.images || []), ...uploaded];
        return { ...prev, images: imgs, image: imgs[0] || prev.image };
      });
      toast.success(
        uploaded.length > 1 ? `${uploaded.length} images added` : "Image added"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item || submitLockRef.current) return;

    const imageList = item.images?.length
      ? item.images
      : item.image
        ? [item.image]
        : [];

    submitLockRef.current = true;
    setSaving(true);
    try {
      const res = await fetch(`/api/new-arrivals/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          image: imageList[0] || item.image,
          images: imageList,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(String(err.error || "Update failed"));
        return;
      }
      toast.success("Updated");
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

  if (!item) return <div className="p-8 text-darkText/50">Loading…</div>;

  return (
    <div className="max-w-2xl p-6 md:p-8">
      <Link href="/admin/new-arrivals" className="text-sm text-primaryBlue">
        ← New Arrivals
      </Link>
      <h1 className="mb-6 mt-4 text-2xl font-bold text-darkText">Edit New Arrival</h1>

      <form onSubmit={onSubmit} className="space-y-4 rounded-card border border-borderGray bg-white p-6 shadow-card">
        <input
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          value={item.name}
          onChange={(e) => setItem({ ...item, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            type="number"
            className="rounded-xl border border-borderGray px-4 py-2"
            value={item.price}
            onChange={(e) => setItem({ ...item, price: Number(e.target.value) })}
          />
          <input
            type="number"
            className="rounded-xl border border-borderGray px-4 py-2"
            value={item.originalPrice ?? ""}
            onChange={(e) =>
              setItem({
                ...item,
                originalPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
        <input
          type="number"
          min={0}
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          value={item.stock ?? 0}
          onChange={(e) => {
            const nextStock = Math.max(0, Number(e.target.value || 0));
            setItem({ ...item, stock: nextStock, inStock: nextStock > 0 });
          }}
        />
        <select
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          value={item.category}
          onChange={(e) => setItem({ ...item, category: e.target.value })}
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
            placeholder="Specifications, bullets, long description — shows above detail images on the product page."
            value={item.description ?? ""}
            onChange={(e) => setItem({ ...item, description: e.target.value })}
          />
          <p className="mt-1 text-xs text-darkText/60">
            Text first; uploaded images render below this block for customers.
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
            Images upload automatically — paste as many times as you like.
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
          {(item.images || []).length > 0 ? (
            <p className="text-xs text-green-700">
              {(item.images || []).length} image(s) on product
            </p>
          ) : null}
          {uploading ? <p className="text-xs text-darkText/60">Uploading…</p> : null}
          {(item.images || []).length ? (
            <div className="flex flex-wrap gap-2">
              {(item.images || []).map((img, i) => (
                <div key={`${img}-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-20 w-20 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setItem((prev) => {
                        if (!prev) return prev;
                        const next = (prev.images || []).filter((_, idx) => idx !== i);
                        return { ...prev, images: next, image: next[0] || "" };
                      });
                    }}
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
            checked={item.isFeatured}
            onChange={(e) => setItem({ ...item, isFeatured: e.target.checked })}
          />
          Is Featured?
        </label>
        <p className="text-sm text-darkText/70">
          In stock status: <span className="font-semibold">{item.stock > 0 ? "Yes" : "No"}</span>
        </p>

        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-xl bg-primaryBlue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
