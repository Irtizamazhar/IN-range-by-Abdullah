export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";

const patchSchema = z.object({
  bankName: z.string().min(1).max(120),
  accountTitle: z.string().min(1).max(200),
  accountNumber: z.string().min(1).max(64),
  iban: z.string().max(34).optional().nullable(),
});

export async function GET() {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const v = await prisma.vendor.findUnique({
    where: { id: auth.vendor.id },
    select: {
      bankName: true,
      accountTitle: true,
      accountNumber: true,
      iban: true,
    },
  });

  return NextResponse.json(v ?? {});
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const first =
      Object.values(parsed.error.flatten().fieldErrors).flat()[0] ||
      parsed.error.message;
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const iban = parsed.data.iban?.trim() || null;

  await prisma.vendor.update({
    where: { id: auth.vendor.id },
    data: {
      bankName: sanitizePlainText(parsed.data.bankName, 120),
      accountTitle: sanitizePlainText(parsed.data.accountTitle, 200),
      accountNumber: sanitizePlainText(parsed.data.accountNumber, 64),
      iban: iban ? sanitizePlainText(iban, 34) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
