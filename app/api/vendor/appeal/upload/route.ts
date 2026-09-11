export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { getAppealVendorId } from "@/lib/vendor-appeal-auth";
import { consumeOrReject, createUploadRateLimiter } from "@/lib/security/rate-limit";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const uploadLimiter = createUploadRateLimiter();
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const authenticatedVendorId = await getAppealVendorId();
  if (!authenticatedVendorId) {
    return NextResponse.json({ error: "Please sign in again before uploading." }, { status: 401 });
  }
  const limited = await consumeOrReject(uploadLimiter, authenticatedVendorId);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const emailRaw = String(formData.get("email") || "");
  const email = sanitizePlainText(emailRaw, 255).toLowerCase();
  const file = formData.get("file");
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { email },
    select: { id: true, status: true },
  });
  if (!vendor || vendor.id !== authenticatedVendorId || vendor.status !== "suspended") {
    return NextResponse.json(
      { error: "Appeal screenshot upload is only for suspended vendors." },
      { status: 403 }
    );
  }

  const mime = file.type.toLowerCase();
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, or WebP images allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Max 5MB allowed" }, { status: 400 });
  }

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const random =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const fileName = `appeal-${Date.now()}-${random}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "vendor-appeals", vendor.id);

  try {
    await fs.mkdir(uploadDir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(uploadDir, fileName), buf);
    return NextResponse.json({
      url: `/uploads/vendor-appeals/${vendor.id}/${fileName}`,
    });
  } catch (e) {
    console.error("vendor appeal upload", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
