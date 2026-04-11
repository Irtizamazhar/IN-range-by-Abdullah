/** Must match `REVIEW_GUEST_FOLDER` in `app/api/upload/route.ts`. */
export const REVIEW_PHOTO_UPLOAD_FOLDER = "inrange-reviews";

export async function uploadPublicReviewPhoto(
  file: File
): Promise<{ url: string; id: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", REVIEW_PHOTO_UPLOAD_FOLDER);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const data = (await r.json()) as { error?: string; url?: string; id?: string };
  if (!r.ok) {
    throw new Error(data.error || "Upload failed");
  }
  if (!data.url || !data.id) throw new Error("Upload failed");
  return { url: data.url, id: data.id };
}
