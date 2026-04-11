export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

/** Preview guest-uploaded payment proof before order is placed (checkout preview). */
export async function GET(_req: NextRequest, context: Ctx) {
  const { id } = context.params;
  const row = await prisma.paymentProofStaging.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(row.data), {
    status: 200,
    headers: {
      "Content-Type": row.mimeType,
      "Cache-Control": "private, no-store",
    },
  });
}
