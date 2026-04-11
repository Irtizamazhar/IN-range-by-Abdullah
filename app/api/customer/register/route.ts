export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmail && email === adminEmail) {
      return NextResponse.json(
        { error: "This email is reserved for admin use" },
        { status: 400 }
      );
    }

    const existing = await prisma.customer.findUnique({
      where: { email },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists — please sign in" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.customer.create({
      data: { email, passwordHash, name, phone },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("register", e);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
