"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import Link from "next/link";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import toast from "react-hot-toast";
import { uploadImageWithId } from "@/lib/cloudinary-client-upload";
import {
  imageFilesFromClipboard,
  isAllowedImageFile,
} from "@/lib/clipboard-image-files";

type ImgEntry = { id: string; url: string };
type ApiCategory = { id: number; name: string };

export default function AddProductPage() {
  const [images, setImages] = useState<ImgEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitLockRef = useRef(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [categories, setCategories] = useState<string[]>([
    "Kitchen Accessories",
    "Home & Wall Decor",
    "Health & Beauty",
    "Makeup & Jewelry Organizer",
    "Ladies Undergarments",
    "Wardrobe and Organizers",
    "Bathroom Accessories",
    "Home & Living",
    "Babies & Toys",
    "Mobile Accessories",
    "Hangers & Hooks",
    "Keychains",
    "Electronics",
    "Fashion",
  ]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [stock, setStock] = useState("0");
  const [variants, setVariants] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function saveCategory(name: string) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(String(err?.error || "Could not save category"));
    }
    return res.json() as Promise<{ name: string }>;
  }

  async function deleteCategoryById(id: number) {
    const res = await fetch(`/api/categories/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(String(err?.error || "Could not delete category"));
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((data: Array<{ id?: number; name?: string }>) => {
        if (cancelled) return;
        const normalized = Array.isArray(data)
          ? data
              .map((x) => ({
                id: Number(x?.id),
                name: String(x?.name || "").trim(),
              }))
              .filter((x) => Number.isFinite(x.id) && !!x.name)
          : [];
        const apiNames = normalized.map((x) => x.name);
        if (!apiNames.length) return;
        setApiCategories(normalized as ApiCategory[]);
        setCategories((prev) => {
          const merged = [...prev];
          for (const nameFromApi of apiNames) {
            if (!merged.includes(nameFromApi)) merged.push(nameFromApi);
          }
          return merged;
        });
        setCategory((current) =>
          !apiNames.includes(current) ? apiNames[0] : current
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onDeleteCurrentCategory() {
    const current = apiCategories.find((c) => c.name === category);
    if (!current) {
      toast.error("Only saved categories can be deleted");
      return;
    }
    if (!window.confirm(`Delete category "${current.name}"?`)) return;
    try {
      await deleteCategoryById(current.id);
      const nextApi = apiCategories.filter((c) => c.id !== current.id);
      setApiCategories(nextApi);
      setCategories((prev) => prev.filter((c) => c !== current.name));
      if (category === current.name) {
        const fallback = nextApi[0]?.name || "";
        setCategory(fallback);
      }
      toast.success("Category deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete category");
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitLockRef.current) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (!category.trim()) {
      toast.error("Category is required");
      return;
    }
    if (!stock.trim()) {
      toast.error("Stock is required");
      return;
    }
    if (!variants.trim()) {
      toast.error("Variants are required");
      return;
    }
    if (!price.trim()) {
      toast.error("Price is required");
      return;
    }
    const priceN = parseFloat(price);
    if (Number.isNaN(priceN) || priceN < 0) {
      toast.error("Enter a valid price");
      return;
    }
    if (!images.length) {
      toast.error("At least one image is required");
      return;
    }
    submitLockRef.current = true;
    setSaving(true);
    try {
      const finalImages = [...images];

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          price: priceN,
          originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
          category,
          stock: parseInt(stock, 10) || 0,
          imageIds: finalImages.map((x) => x.id),
          variants: variants
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(String(err.error || "Could not create product"));
        return;
      }
      const data = await res.json().catch(() => ({}));
      const newId = String(data.id || data._id || "");
      toast.success("Product created");
      if (newId) {
        window.location.href = `/admin/products/${newId}/edit`;
        return;
      }
      window.location.href = "/admin/products";
    } catch {
      toast.error("Could not create product");
    } finally {
      submitLockRef.current = false;
      setUploading(false);
      setSaving(false);
    }
  }

  async function uploadAndAppendFiles(files: File[]) {
    const allowed = files.filter(isAllowedImageFile);
    if (!allowed.length) {
      toast.error("Use JPG, PNG, or WebP images");
      return;
    }
    setUploading(true);
    try {
      const next: ImgEntry[] = [...images];
      for (const f of allowed) {
        const entry = await uploadImageWithId(f, "inrange-products");
        next.push(entry);
      }
      setImages(next);
      toast.success(
        allowed.length > 1 ? `${allowed.length} images added` : "Image added"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload error");
    } finally {
      setUploading(false);
    }
  }

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    void uploadAndAppendFiles(Array.from(files));
  }

  function onPasteImages(e: ClipboardEvent) {
    const pasted = imageFilesFromClipboard(e);
    if (!pasted.length) {
      toast.error(
        "No image in clipboard — copy a picture first (e.g. right-click → Copy image)"
      );
      return;
    }
    e.preventDefault();
    void uploadAndAppendFiles(pasted);
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <Link href="/admin/products" className="text-primaryBlue text-sm">
        ← Products
      </Link>
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-darkText">Add Product</h1>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-card border border-borderGray bg-white p-6 shadow-card">
        <input
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="w-full rounded-xl border border-borderGray px-4 py-2 min-h-[100px]"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input
            type="number"
            min={0}
            step="0.01"
            className="rounded-xl border border-borderGray px-4 py-2"
            placeholder="Price PKR"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <input
            type="number"
            min={0}
            step="0.01"
            className="rounded-xl border border-borderGray px-4 py-2"
            placeholder="Original (optional)"
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex flex-col items-start gap-2 sm:flex-row">
            <div className="relative flex-1">
            <button
              type="button"
              onClick={() => setCategoryOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-xl border border-borderGray px-4 py-2 text-sm"
            >
              <span>{category || "Select category"}</span>
              <span className="text-darkText/60">{categoryOpen ? "▲" : "▼"}</span>
            </button>
            {categoryOpen ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-borderGray bg-white shadow-lg">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setAddingCategory(false);
                      setNewCategory("");
                      setCategory(c);
                      setCategoryOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    {c}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setAddingCategory(true);
                    setCategoryOpen(false);
                  }}
                  className="block w-full border-t border-borderGray px-4 py-2 text-left text-sm font-medium text-primaryBlue hover:bg-gray-100"
                >
                  Add new category
                </button>
              </div>
            ) : null}
            </div>
            <button
              type="button"
              onClick={onDeleteCurrentCategory}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-300 text-red-600 hover:bg-red-50"
              aria-label="Delete current category"
              title="Delete current category"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v8h-2v-8Zm4 0h2v8h-2v-8ZM7 10h2v8H7v-8Zm1 11a2 2 0 0 1-2-2V8h12v11a2 2 0 0 1-2 2H8Z" />
              </svg>
            </button>
          </div>

          {addingCategory ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="flex-1 rounded-xl border border-borderGray px-4 py-2"
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button
                type="button"
                disabled={saving || uploading}
                onClick={async () => {
                  const val = newCategory.trim();
                  if (!val) {
                    toast.error("Category name required");
                    return;
                  }
                  const existing = categories.find(
                    (item) => item.toLowerCase() === val.toLowerCase()
                  );
                  if (existing) {
                    setCategory(existing);
                    setAddingCategory(false);
                    setNewCategory("");
                    toast.success("Category selected");
                    return;
                  }
                  try {
                    const created = await saveCategory(val);
                    const selected = String(created?.name || val).trim() || val;
                    setApiCategories((prev) => {
                      const found = prev.find(
                        (c) => c.name.toLowerCase() === selected.toLowerCase()
                      );
                      if (found) return prev;
                      const c = created as unknown as { id?: unknown };
                      if (typeof c?.id === "number") {
                        return [...prev, { id: c.id, name: selected }];
                      }
                      return prev;
                    });
                    setCategories((prev) =>
                      prev.includes(selected) ? prev : [...prev, selected]
                    );
                    setCategory(selected);
                    setAddingCategory(false);
                    setNewCategory("");
                    toast.success("Category added");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not add category");
                  }
                }}
                className="rounded-xl bg-primaryBlue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                Add
              </button>
            </div>
          ) : null}
        </div>
        <input
          type="number"
          min={0}
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          placeholder="Variants (comma separated)"
          value={variants}
          onChange={(e) => setVariants(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (visible on store)
        </label>

        <div
          tabIndex={0}
          onPaste={onPasteImages}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
          className="rounded-xl border-2 border-dashed border-primaryBlue/40 bg-primaryBlue/5 p-4 text-center outline-none focus:ring-2 focus:ring-primaryBlue/50 sm:p-8"
        >
          <p className="text-sm text-darkText/70 mb-2">
            Drag &amp; drop, choose files, or{" "}
            <strong className="text-darkText">click here and press Ctrl+V</strong>{" "}
            (⌘+V on Mac) to paste from clipboard
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => onFiles(e.target.files)}
            className="text-sm"
          />
          {uploading ? (
            <p className="mt-3 text-xs text-darkText/70">Uploading…</p>
          ) : null}
          {images.length > 0 ? (
            <p className="text-xs mt-2 text-green-700">{images.length} image(s)</p>
          ) : null}
          {images.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {images.map((im) => (
                <div key={im.id} className="relative group">
                  <Image
                    src={im.url}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 object-cover rounded-lg border border-borderGray"
                    unoptimized={shouldUnoptimizeImageSrc(im.url)}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(im.id)}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white text-xs leading-5"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primaryBlue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save product"}
          </button>
        </div>
      </form>
    </div>
  );
}
