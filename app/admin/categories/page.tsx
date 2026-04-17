"use client";

import Image from "next/image";
import { ClipboardEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import toast from "react-hot-toast";

type Category = {
  id: number;
  name: string;
  image: string;
  showOnHome?: boolean;
};

type Mode = "add" | "edit";

const CATEGORY_UPLOAD_FOLDER = "categories-local";
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("add");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [showOnHome, setShowOnHome] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const editingCategory = useMemo(
    () => categories.find((c) => c.id === editingId) || null,
    [categories, editingId]
  );

  async function loadCategories() {
    try {
      const res = await fetch("/api/categories", { credentials: "same-origin" });
      const data = (await res.json()) as Category[] | { error?: string };
      if (!res.ok) {
        const msg = "error" in data ? data.error : "Failed to load categories";
        toast.error(msg || "Failed to load categories");
        return;
      }
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setFilePreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setFilePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  function resetForm() {
    setMode("add");
    setEditingId(null);
    setName("");
    setImageUrl("");
    setImageFile(null);
    setFilePreviewUrl("");
    setShowOnHome(false);
  }

  function startEdit(category: Category) {
    setMode("edit");
    setEditingId(category.id);
    setName(category.name);
    setImageUrl(category.image);
    setImageFile(null);
    setShowOnHome(category.showOnHome === true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadCategoryImage(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", CATEGORY_UPLOAD_FOLDER);

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: fd,
      credentials: "same-origin",
    });
    const uploadData = (await uploadRes.json()) as { url?: string; error?: string };
    if (!uploadRes.ok || !uploadData.url) {
      throw new Error(uploadData.error || "Image upload failed");
    }
    return uploadData.url;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }
    if (!imageUrl.trim() && !imageFile) {
      toast.error("Please provide image URL or upload a file");
      return;
    }

    setSaving(true);
    try {
      let finalImage = imageUrl.trim();
      if (imageFile) {
        finalImage = await uploadCategoryImage(imageFile);
      }

      const payload = { name: name.trim(), image: finalImage, showOnHome };
      if (mode === "add") {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as Category | { error?: string };
        if (!res.ok) {
          const msg = "error" in data ? data.error : "Failed to add category";
          throw new Error(msg || "Failed to add category");
        }
        toast.success("Category added");
      } else if (editingId != null) {
        const res = await fetch(`/api/categories/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as Category | { error?: string };
        if (!res.ok) {
          const msg = "error" in data ? data.error : "Failed to update category";
          throw new Error(msg || "Failed to update category");
        }
        toast.success("Category updated");
      }

      await loadCategories();
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function onImagePaste(e: ClipboardEvent<HTMLElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
        toast.error("Only JPG, PNG, or WebP images are supported");
        return;
      }
      setImageFile(file);
      setImageUrl("");
      toast.success("Image pasted from clipboard");
      e.preventDefault();
      return;
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this category?")) return;
    const res = await fetch(`/api/categories/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      toast.error(data.error || "Delete failed");
      return;
    }
    toast.success("Category deleted");
    if (editingId === id) resetForm();
    await loadCategories();
  }

  return (
    <div className="max-w-6xl p-6 md:p-8">
      <h1 className="mb-6 text-2xl font-bold text-darkText">Categories</h1>

      <form
        onSubmit={onSubmit}
        onPaste={onImagePaste}
        className="mb-8 space-y-4 rounded-card border border-borderGray bg-white p-6 shadow-card"
      >
        <h2 className="text-lg font-bold text-darkText">
          {mode === "add" ? "Add New Category" : "Edit Category"}
        </h2>

        <div>
          <label className="mb-1 block text-sm font-semibold text-darkText">
            Category name
          </label>
          <input
            type="text"
            className="w-full rounded-xl border border-borderGray px-4 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kitchen Accessories"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-darkText">
            Image upload
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
          <p className="mt-1 text-xs text-darkText/60">
            Upload goes to `/public/uploads/categories/`
          </p>
          <div
            className="mt-3 rounded-xl border border-dashed border-borderGray bg-lightGray/30 px-4 py-3 text-sm text-darkText/70"
            tabIndex={0}
          >
            Tip: yahan click karke <span className="font-semibold">Ctrl + V</span> se image paste
            kar sakte hain.
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-darkText">
            OR image URL
          </label>
          <input
            type="text"
            className="w-full rounded-xl border border-borderGray px-4 py-2"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="/uploads/categories/kitchen.jpg or https://..."
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-darkText">
          <input
            type="checkbox"
            checked={showOnHome}
            onChange={(e) => setShowOnHome(e.target.checked)}
          />
          Show this category on homepage
        </label>

        {(imageUrl || imageFile) && (
          <div>
            <p className="mb-2 text-sm font-semibold text-darkText">Preview</p>
            <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-borderGray bg-lightGray">
              {imageFile ? (
                <Image
                  src={filePreviewUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                  sizes="80px"
                  unoptimized={shouldUnoptimizeImageSrc(filePreviewUrl)}
                />
              ) : (
                <Image
                  src={imageUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                  sizes="80px"
                  unoptimized={shouldUnoptimizeImageSrc(imageUrl)}
                />
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primaryBlue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving
              ? mode === "add"
                ? "Adding..."
                : "Saving..."
              : mode === "add"
                ? "Submit"
                : "Save changes"}
          </button>
          {mode === "edit" && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-borderGray px-5 py-2.5 text-sm font-semibold text-darkText"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-card border border-borderGray bg-white p-4 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-darkText">All Categories</h2>

        {loading ? (
          <p className="p-4 text-darkText/60">Loading...</p>
        ) : categories.length === 0 ? (
          <p className="p-4 text-darkText/60">No categories yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[700px] w-full text-left text-sm">
              <thead className="border-b border-borderGray bg-lightGray">
                <tr>
                  <th className="p-3">Image</th>
                  <th className="p-3">Category Name</th>
                  <th className="p-3">Show on Home</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr
                    key={category.id}
                    className="border-b border-borderGray hover:bg-lightGray/40"
                  >
                    <td className="p-3">
                      <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-lightGray">
                        <Image
                          src={category.image}
                          alt={category.name}
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized={shouldUnoptimizeImageSrc(category.image)}
                        />
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-darkText">{category.name}</td>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={category.showOnHome === true}
                        disabled={togglingId === category.id}
                        className="h-4 w-4 cursor-pointer accent-primaryBlue"
                        onChange={async (e) => {
                          const nextChecked = e.target.checked;
                          const prev = categories;
                          setCategories((list) =>
                            list.map((x) =>
                              x.id === category.id ? { ...x, showOnHome: nextChecked } : x
                            )
                          );
                          setTogglingId(category.id);
                          try {
                            const res = await fetch(`/api/categories/${category.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              credentials: "same-origin",
                              body: JSON.stringify({
                                showOnHome: nextChecked,
                              }),
                            });
                            if (!res.ok) {
                              setCategories(prev);
                              toast.error("Could not update selector");
                              return;
                            }
                            toast.success("Homepage visibility updated");
                          } catch {
                            setCategories(prev);
                            toast.error("Could not update selector");
                          }
                          setTogglingId(null);
                        }}
                      />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => startEdit(category)}
                        className="mr-4 font-semibold text-primaryBlue"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(category.id)}
                        className="font-semibold text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mode === "edit" && editingCategory ? (
        <p className="mt-3 text-sm text-darkText/60">
          Editing category: <span className="font-semibold">{editingCategory.name}</span>
        </p>
      ) : null}
    </div>
  );
}
