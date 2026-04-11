/** Folder key for customer review photos (`public/uploads/reviews`). Requires customer session. */
export const REVIEW_PHOTO_FOLDER = "inrange-reviews";

/**
 * Upload via POST /api/upload — bytes stored in MySQL (ProductImage / PaymentProofStaging),
 * or on disk for categories / review photos.
 */
export async function uploadImageWithId(
  file: File,
  folder: string
): Promise<{ id: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const r = await fetch("/api/upload", {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(data.error || "Upload failed");
  }
  const url = data.url as string | undefined;
  const id = data.id as string | undefined;
  if (!url || !id) throw new Error("Upload failed");
  return { id, url };
}

export async function uploadImageClient(
  file: File,
  folder: string
): Promise<string> {
  const { url } = await uploadImageWithId(file, folder);
  return url;
}
