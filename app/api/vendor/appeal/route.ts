export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { getAppealVendorId } from "@/lib/vendor-appeal-auth";

const appealSchema = z.object({
  email: z.string().email(),
  message: z.string().min(10).max(1500),
  reasonType: z
    .enum(["general", "payment_pending", "policy_misunderstanding"])
    .optional(),
  paymentProofUrl: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const authenticatedVendorId = await getAppealVendorId();
  if (!authenticatedVendorId) {
    return NextResponse.json({ error: "Please sign in again before submitting an appeal." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = appealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide valid email and appeal message." },
      { status: 400 }
    );
  }

  const email = sanitizePlainText(parsed.data.email, 255).toLowerCase();
  const message = sanitizePlainText(parsed.data.message, 1500);
  const reasonType = parsed.data.reasonType ?? "general";
  const paymentProofUrl =
    parsed.data.paymentProofUrl && parsed.data.paymentProofUrl.trim()
      ? sanitizePlainText(parsed.data.paymentProofUrl, 500)
      : null;

  try {
    const vendor = await prisma.vendor.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    if (!vendor || vendor.id !== authenticatedVendorId) {
      return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
    }
    if (vendor.status !== "suspended") {
      return NextResponse.json(
        { error: "Appeal is available only for suspended accounts." },
        { status: 400 }
      );
    }

    if (
      paymentProofUrl &&
      !paymentProofUrl.startsWith(`/api/private/vendor-appeals/${vendor.id}/appeal-`)
    ) {
      return NextResponse.json({ error: "Invalid payment proof" }, { status: 400 });
    }

    await prisma.vendorAuditLog.create({
      data: {
        vendorId: vendor.id,
        action: "vendor_appeal",
        details: {
          message,
          reasonType,
          paymentProofUrl,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ ok: true, message: "Appeal submitted." });
  } catch (e) {
    console.error("vendor appeal", e);
    return NextResponse.json({ error: "Could not submit appeal." }, { status: 500 });
  }
}
