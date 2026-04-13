export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";

const appealSchema = z.object({
  email: z.string().email(),
  message: z.string().min(10).max(1500),
});

export async function POST(req: NextRequest) {
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

  try {
    const vendor = await prisma.vendor.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
    }
    if (vendor.status !== "suspended") {
      return NextResponse.json(
        { error: "Appeal is available only for suspended accounts." },
        { status: 400 }
      );
    }

    await prisma.vendorAuditLog.create({
      data: {
        vendorId: vendor.id,
        action: "vendor_appeal",
        details: {
          message,
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
