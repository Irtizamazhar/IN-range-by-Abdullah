import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverOrderConfirmation } from "@/lib/order-confirmation-delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.ORDER_EMAIL_CRON_SECRET;
  const token = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(token);
  const expectedBytes = Buffer.from(expected);
  if (!secret || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await deliverOrderConfirmation()); }
  catch { return NextResponse.json({ error: "Delivery worker failed; inspect queue before retrying." }, { status: 503 }); }
}
