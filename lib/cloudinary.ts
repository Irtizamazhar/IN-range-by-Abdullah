export function getCloudinaryCloudName(): string {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  if (!name) throw new Error("CLOUDINARY_CLOUD_NAME is not set");
  return name;
}

/** Server-side upload (optional). Client uses unsigned preset with this cloud name. */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<{ secure_url: string }> {
  const cloudinary = (await import("cloudinary")).v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (err, result) => {
        if (err || !result) reject(err);
        else resolve({ secure_url: result.secure_url });
      }
    );
    uploadStream.end(buffer);
  });
}
