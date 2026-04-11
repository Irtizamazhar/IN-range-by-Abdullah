export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
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

  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const random =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const fileName = `vp-${Date.now()}-${random}.${ext}`;
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "vendor-products",
    auth.vendor.id
  );

  try {
    await fs.mkdir(uploadDir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(uploadDir, fileName), buf);
    const url = `/uploads/vendor-products/${auth.vendor.id}/${fileName}`;
    return NextResponse.json({ url });
  } catch (e) {
    console.error("vendor upload", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
