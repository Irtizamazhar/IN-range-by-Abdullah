import { NextResponse } from "next/server";
import { ApiError, sameOrigin } from "@/lib/marketplace-api";
import { readPublicImage, savePublicImage, validatePublicImage } from "@/lib/public-uploads";
import { serviceImagePath, SERVICE_IMAGE_MAX_BYTES } from "@/lib/service-image-policy";
import { consumeOrReject, createUploadRateLimiter } from "@/lib/security/rate-limit";

const limiter = createUploadRateLimiter();

export async function assertServiceImageStored(value: string | null, owner: string) {
  if (value === null) return;
  const ref = serviceImagePath(value);
  if (!ref || ref.owner !== owner) throw new ApiError(400, "Choose an image uploaded for this service provider.");
  let image;
  try { image = await readPublicImage(ref.relative, false); }
  catch { throw new ApiError(503, "Service image storage is unavailable. Please try again."); }
  if (!image) throw new ApiError(400, "Service image is missing. Please upload it again.");
}

/** Called only after endpoint authentication; owner is resolved by the server, never from a filename. */
export async function uploadServiceImage(request: Request, owner: string) {
  sameOrigin(request);
  if (!/^(?:catalog|vendor-[A-Za-z0-9_-]{1,100})$/.test(owner)) throw new ApiError(400, "Invalid service image owner.");
  const limit = await consumeOrReject(limiter, `service-image:${owner}`);
  if (!limit.ok) throw new ApiError(429, "Too many image uploads. Please try again later.");
  let form;
  try { form = await request.formData(); } catch { throw new ApiError(400, "Invalid image upload."); }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a service image.");
  if (!file.size || file.size > SERVICE_IMAGE_MAX_BYTES) throw new ApiError(400, "Service image must be 5MB or smaller.");
  const bytes = Buffer.from(await file.arrayBuffer());
  try { await validatePublicImage(bytes, file.type); }
  catch { throw new ApiError(400, "Choose a valid JPG, PNG or WebP image."); }
  try {
    return NextResponse.json(await savePublicImage(bytes, file.type, `services/${owner}`, "svc"), { headers: { "Cache-Control": "no-store" } });
  } catch { throw new ApiError(503, "Service image upload failed. Please try again."); }
}
