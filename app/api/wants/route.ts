export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { getCustomerSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { wantPostSchema } from "@/lib/want-schema";

export async function GET(req: NextRequest) {
  const mine = req.nextUrl.searchParams.get("mine") === "1";
  const session = mine ? await getCustomerSession() : null;
  if (mine && (session?.user?.role !== "customer" || !session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const take = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 20));
  const rows = await prisma.wantPost.findMany({
    where: mine
      ? { customerId: session!.user.id }
      : { status: "open", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      _count: { select: { offers: true } },
      ...(mine ? { offers: { select: { id: true, status: true } } } : {}),
    },
  });
  return NextResponse.json({
    wants: rows.map((row) => ({
      ...row,
      budgetMin: row.budgetMin == null ? null : Number(row.budgetMin),
      budgetMax: row.budgetMax == null ? null : Number(row.budgetMax),
      offerCount: row._count.offers,
      _count: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = wantPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Check your request" },
      { status: 400 }
    );
  }
  const value = parsed.data;
  const want = await prisma.wantPost.create({
    data: {
      customerId: auth.customer.id,
      title: sanitizePlainText(value.title, 200),
      description: sanitizePlainText(value.description, 3000),
      category: sanitizePlainText(value.category, 120),
      city: sanitizePlainText(value.city, 120),
      budgetMin: value.budgetMin == null ? null : new Prisma.Decimal(value.budgetMin.toFixed(2)),
      budgetMax: value.budgetMax == null ? null : new Prisma.Decimal(value.budgetMax.toFixed(2)),
      quantity: value.quantity,
      condition: value.condition || null,
      status: "pending",
    },
  });
  return NextResponse.json(
    { id: want.id, status: want.status, message: "Your Want was submitted for moderation." },
    { status: 201 }
  );
}
