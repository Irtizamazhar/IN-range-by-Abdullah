import { NextRequest, NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Generic response — does not reveal whether the email is registered.
 * Extend with token + email when you add a full reset flow.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for that email, you will receive reset instructions shortly.",
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
