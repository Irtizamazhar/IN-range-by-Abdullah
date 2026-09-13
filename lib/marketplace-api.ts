import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, getAdminSession } from "@/lib/sessions";
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function customerActor() {
  const session = await getCustomerSession();
  if (session?.user?.role !== "customer" || !session.user.email) throw new ApiError(401, "Please sign in as a customer.");
  const customer = await prisma.customer.findUnique({ where: { email: session.user.email.trim().toLowerCase() }, select: { id: true, name: true, email: true } });
  if (!customer) throw new ApiError(401, "Please sign in again.");
  return customer;
}
export async function adminActor() {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") throw new ApiError(403, "Admin access required.");
  return session.user.email || "admin";
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Cross-origin requests are not allowed.");
}
export async function api(work: () => Promise<unknown>) {
  try { return NextResponse.json(await work(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Please check the supplied fields." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return NextResponse.json({ error: "This record changed. Refresh and try again." }, { status: 409 });
    console.error("Marketplace request failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "This feature is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}