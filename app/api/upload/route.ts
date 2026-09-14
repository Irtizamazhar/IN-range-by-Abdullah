export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCustomerSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

const GUEST_FOLDER = "inrange-payments";
/** Legacy folder token; review photos now require order-scoped `/api/reviews/photo`. */
const REVIEW_GUEST_FOLDER = "inrange-reviews";
/** Customer Want photos → `public/uploads/wants/` */
const WANT_GUEST_FOLDER = "inrange-wants";
const ADMIN_PRODUCT_FOLDER = "inrange-products";
const ADMIN_CATEGORY_FOLDER = "categories-local";
const ADMIN_LOCAL_PRODUCT_FOLDER = "products-local";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_ADMIN = 8 * 1024 * 1024;
const MAX_GUEST = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed" },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const folderRaw = String(formData.get("folder") || ADMIN_PRODUCT_FOLDER).trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const mime = file.type.toLowerCase();
  if (!ALLOWED_TYPES.has(mime)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, or WebP images allowed" },
      { status: 400 }
    );
  }

  const isPayment = folderRaw === GUEST_FOLDER;
  const isReviewPhoto = folderRaw === REVIEW_GUEST_FOLDER;
  const isWantPhoto = folderRaw === WANT_GUEST_FOLDER;
  const isCategoryUpload = folderRaw === ADMIN_CATEGORY_FOLDER;
  const isLocalProductUpload = folderRaw === ADMIN_LOCAL_PRODUCT_FOLDER;
  const customerSession =
    isPayment || isReviewPhoto || isWantPhoto
      ? await getCustomerSession()
      : null;

  if (isReviewPhoto) {
    return NextResponse.json(
      { error: "Use the purchase-verified review photo upload." },
      { status: 400 }
    );
  }

  if (isWantPhoto) {
    if (
      customerSession?.user?.role !== "customer" ||
      !customerSession.user.id
    ) {
      return NextResponse.json(
        { error: "Please sign in to upload a Want photo" },
        { status: 401 }
      );
    }
    if (file.size > MAX_GUEST) {
      return NextResponse.json({ error: "Max 5MB" }, { status: 400 });
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const ext =
      mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : "jpg";
    const random =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    const prefix = "want";
    const folder = "wants";
    const fileName = `${prefix}-${Date.now()}-${random}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, fileName), Buffer.from(buf));
      return NextResponse.json({
        id: fileName,
        url: `/uploads/${folder}/${fileName}`,
      });
    } catch (e) {
      console.error("want upload", e);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

    if (isPayment) {
      if (customerSession?.user?.role !== "customer") {
      return NextResponse.json(
        { error: "Please sign in as a customer to upload payment proof" },
        { status: 401 }
      );
      }
      if (!customerSession?.user.id) {
        return NextResponse.json({ error: "Customer session is invalid" }, { status: 401 });
      }
    if (file.size > MAX_GUEST) {
      return NextResponse.json({ error: "Max 5MB" }, { status: 400 });
    }
  } else {
    const auth = await requireAdminPermission("catalog.manage");
    if ("response" in auth) return auth.response;
    if (file.size > MAX_ADMIN) {
      return NextResponse.json({ error: "Max 8MB" }, { status: 400 });
    }
  }

  const buf = new Uint8Array(await file.arrayBuffer());

  try {
    if (isPayment) {
      const row = await prisma.paymentProofStaging.create({
        data: {
          customerId: customerSession!.user.id,
          data: buf,
          mimeType: mime || "image/jpeg",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return NextResponse.json({
        id: row.id,
        url: `/api/order-payment-staging/${row.id}`,
      });
    }

    if (isCategoryUpload || isLocalProductUpload) {
      const ext =
        mime === "image/png"
          ? "png"
          : mime === "image/webp"
          ? "webp"
          : "jpg";
      const safeBase = file.name
        .toLowerCase()
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "category";
      const fileName = `${Date.now()}-${safeBase}.${ext}`;
      const uploadDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        isCategoryUpload ? "categories" : "products"
      );
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, fileName), Buffer.from(buf));
      return NextResponse.json({
        id: fileName,
        url: `/uploads/${isCategoryUpload ? "categories" : "products"}/${fileName}`,
      });
    }

    const row = await prisma.productImage.create({
      data: {
        productId: null,
        data: buf,
        mimeType: mime || "image/jpeg",
        sortOrder: 0,
      },
    });
    return NextResponse.json({
      id: row.id,
      url: `/api/image/${row.id}`,
    });
  } catch (e) {
    console.error("upload", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
