export const dynamic = "force-dynamic";

import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Use a password with at least 8 characters" }, { status: 400 });
  }
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    await prisma.$transaction(
      async (tx) => {
        const vendor = await tx.vendor.findFirst({
          where: { passwordResetToken: tokenHash, passwordResetExpires: { gt: new Date() } },
          select: { id: true, passwordResetToken: true },
        });
        if (!vendor) throw new Error("RESET_TOKEN_INVALID");
        const gate = await tx.vendor.updateMany({
          where: { id: vendor.id, passwordResetToken: tokenHash },
          data: {
            passwordHash,
            passwordResetToken: null,
            passwordResetExpires: null,
            loginAttempts: 0,
            lockedUntil: null,
          },
        });
        if (gate.count !== 1) throw new Error("RESET_TOKEN_INVALID");
        await tx.vendorSession.updateMany({
          where: { vendorId: vendor.id, isRevoked: false },
          data: { isRevoked: true },
        });
        await tx.vendorAuditLog.create({
          data: { vendorId: vendor.id, action: "password_reset" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "RESET_TOKEN_INVALID") {
      return NextResponse.json({ error: "This reset link is invalid or has expired" }, { status: 400 });
    }
    console.error("vendor password reset", error);
    return NextResponse.json({ error: "Could not reset password" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
