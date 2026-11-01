import { randomUUID } from "node:crypto";
import { cloudinaryImageReference } from "@/lib/cloudinary-policy";
export function getCloudinaryCloudName(): string {
  const name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!name) throw new Error("Image storage is not configured.");
  return name;
}
async function configuredCloudinary() {
  const cloudinary = (await import("cloudinary")).v2;
  if (!process.env.CLOUDINARY_API_KEY?.trim() || !process.env.CLOUDINARY_API_SECRET?.trim()) throw new Error("Image storage is not configured.");
  cloudinary.config({ cloud_name: getCloudinaryCloudName(), api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  return cloudinary;
}
/** Signed server upload. Never overwrite an existing asset or fall back to disk. */
export async function uploadBufferToCloudinary(buffer: Buffer, folder: string): Promise<{ secure_url: string; public_id: string }> {
  if (!/^joro\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(folder)) throw new Error("Invalid image folder.");
  const cloudinary = await configuredCloudinary();
  try {
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ public_id: `${folder}/${randomUUID()}`, resource_type: "image", type: "upload", overwrite: false, allowed_formats: ["jpg", "jpeg", "png", "webp"], timeout: 60000 },
        (error, result) => error || !result ? reject(new Error("Image upload failed.")) : resolve(result));
      stream.on("error", () => reject(new Error("Image upload failed.")));
      stream.end(buffer);
    });
    const ref = cloudinaryImageReference(result.secure_url);
    if (!ref || ref.cloud !== getCloudinaryCloudName() || ref.publicId !== result.public_id || !ref.publicId.startsWith(`${folder}/`)) throw new Error();
    return result;
  } catch { throw new Error("Image upload failed. Please try again."); }
}
/** Verify existence in our account and the owner's namespace, without arbitrary URL fetches. */
export async function assertCloudinaryImageStored(url: string, folder: string): Promise<void> {
  const ref = cloudinaryImageReference(url);
  if (!ref || ref.cloud !== getCloudinaryCloudName() || !ref.publicId.startsWith(`${folder}/`) || ref.publicId.slice(folder.length + 1).includes("/")) throw new Error("Invalid image reference.");
  try {
    const cloudinary = await configuredCloudinary();
    const resource = await cloudinary.api.resource(ref.publicId, { resource_type: "image", type: "upload", timeout: 15000 });
    if (resource.secure_url !== url || resource.resource_type !== "image" || resource.type !== "upload") throw new Error();
  } catch { throw new Error("Image could not be verified. Please try again."); }
}
