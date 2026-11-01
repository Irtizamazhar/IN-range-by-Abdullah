import {imageExtension} from "@/lib/security/image-signature";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { savePublicImage } from "@/lib/public-uploads";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { consumeOrReject, createUploadRateLimiter } from "@/lib/security/rate-limit";

const VENDOR_MAX = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const uploadLimiter = createUploadRateLimiter();

export async function POST(req: NextRequest) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const limited = await consumeOrReject(
    uploadLimiter,
    `vendor-upload:${auth.vendor.id}`
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Try again later.", retrySecs: limited.retrySecs },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const mime = file.type.toLowerCase();
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, or WebP allowed" },
      { status: 400 }
    );
  }
  if (file.size > VENDOR_MAX) {
    return NextResponse.json({ error: "Max 5MB per image" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (!imageExtension(buf,mime)) return NextResponse.json({error:"Image bytes do not match the declared type."},{status:400});
    const image = await savePublicImage(buf, mime, `vendor-products/${auth.vendor.id}`, "vp");
    return NextResponse.json({ url: image.url });
  } catch {
    console.error("Vendor image upload failed.");
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
