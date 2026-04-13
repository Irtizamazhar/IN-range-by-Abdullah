import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getCustomerSession();
  if (!session?.user?.email || session.user.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const customer = await prisma.customer.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { name: true, email: true, phone: true, createdAt: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { createdAt, ...rest } = customer;
  return NextResponse.json({
    ...rest,
    image: session.user.image ?? null,
    createdAt: createdAt.toISOString(),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session?.user?.email || session.user.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { name?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const updated = await prisma.customer.update({
    where: { email: session.user.email.toLowerCase() },
    data: { name, phone },
    select: { name: true, email: true, phone: true },
  });
  return NextResponse.json(updated);
}
