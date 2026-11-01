import {imageExtension} from "@/lib/security/image-signature";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { savePublicImage, PUBLIC_UPLOAD_REFERENCE_MIME } from "@/lib/public-uploads";
import { getCustomerSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { ApiError, sameOrigin } from "@/lib/marketplace-api";

const GUEST_FOLDER = "inrange-payments";
/** Legacy folder token; review photos now require order-scoped `/api/reviews/photo`. */
const REVIEW_GUEST_FOLDER = "inrange-reviews";
/** Customer Want photos → `public/uploads/wants/` */
const WANT_GUEST_FOLDER = "inrange-wants";
const ADMIN_PRODUCT_FOLDER = "inrange-products";
const ADMIN_CATEGORY_FOLDER = "categories-local";
const ADMIN_LOCAL_PRODUCT_FOLDER = "products-local";
const ADMIN_PROMOTION_FOLDER = "promotions-local";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_ADMIN = 8 * 1024 * 1024;
const MAX_GUEST = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // In production req.url is the standalone server's own address (for example https://0.0.0.0:<port>),
  // never https://joro.pk, so the browser Origin is checked against the public-origin allowlist instead.
  try {
    sameOrigin(req);
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
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
  const isPromotionUpload = folderRaw === ADMIN_PROMOTION_FOLDER;
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
    if (!imageExtension(buf,mime)) return NextResponse.json({error:"Image bytes do not match the declared type."},{status:400});
    try {
      const image = await savePublicImage(Buffer.from(buf), mime, `wants/${customerSession.user.id}`, "want");
      return NextResponse.json(image);
    } catch {
      return NextResponse.json({ error: "Image upload failed. Please try again." }, { status: 503 });
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
    const auth = await requireAdminPermission(isPromotionUpload ? "homepage.manage" : "catalog.manage");
    if ("response" in auth) return auth.response;
    if (file.size > MAX_ADMIN) {
      return NextResponse.json({ error: "Max 8MB" }, { status: 400 });
    }
  }

  const buf = new Uint8Array(await file.arrayBuffer());
    if (!imageExtension(buf,mime)) return NextResponse.json({error:"Image bytes do not match the declared type."},{status:400});

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

    if (isCategoryUpload || isLocalProductUpload || isPromotionUpload) {
      const folder = isCategoryUpload ? "categories" : isPromotionUpload ? "promotions" : "products";
      const image = await savePublicImage(Buffer.from(buf), mime, folder);
      return NextResponse.json(image);
    }

    const image = await savePublicImage(Buffer.from(buf), mime, "products");
    const row = await prisma.productImage.create({
      data: {
        productId: null,
        data: Buffer.from(image.url, "utf8"),
        mimeType: PUBLIC_UPLOAD_REFERENCE_MIME,
        sortOrder: 0,
      },
    });
    return NextResponse.json({
      id: row.id,
      url: image.url,
    });
  } catch {
    console.error("Public image upload failed.");
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
