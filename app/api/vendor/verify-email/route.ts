export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  const origin = req.nextUrl.origin;

  if (!token || token.length > 256) {
    return NextResponse.redirect(
      new URL("/vendor/verify-email?status=invalid", origin)
    );
  }

  const vendor = await prisma.vendor.findFirst({
    where: { emailVerifyToken: token },
    select: { id: true },
  });

  if (!vendor) {
    return NextResponse.redirect(
      new URL("/vendor/verify-email?status=invalid", origin)
    );
  }

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      isEmailVerified: true,
      emailVerifyToken: null,
    },
  });

  return NextResponse.redirect(
    new URL("/vendor/verify-email?status=verified", origin)
  );
}
