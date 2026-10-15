export const dynamic = "force-dynamic";

import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { passwordChangedEmail } from "@/lib/joro-email-templates";

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
    return NextResponse.json(
      { error: "Use a password with at least 8 characters." },
      { status: 400 }
    );
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    const changedCustomer = await prisma.$transaction(
      async (tx) => {
        const token = await tx.customerPasswordResetToken.findFirst({
          where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        });
        if (!token) throw new Error("RESET_TOKEN_INVALID");
        const gate = await tx.customerPasswordResetToken.updateMany({
          where: { id: token.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (gate.count !== 1) throw new Error("RESET_TOKEN_INVALID");
        const customer = await tx.customer.update({
          where: { id: token.customerId },
          data: {
            passwordHash,
            sessionVersion: { increment: 1 },
          },
          select: { email: true, name: true },
        });
        await tx.customerPasswordResetToken.updateMany({
          where: { customerId: token.customerId, usedAt: null },
          data: { usedAt: new Date() },
        });
        return customer;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    try { await sendMail({ to: changedCustomer.email, ...passwordChangedEmail(changedCustomer.name) }); }
    catch { console.error("customer password notification unavailable"); }
  } catch (error) {
    if (error instanceof Error && error.message === "RESET_TOKEN_INVALID") {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 }
      );
    }
    console.error("customer password reset", error);
    return NextResponse.json({ error: "Could not reset password" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
