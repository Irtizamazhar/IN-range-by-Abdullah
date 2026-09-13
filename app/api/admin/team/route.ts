export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ROLE_PERMISSIONS } from "@/lib/admin-permissions";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

const roles = Object.keys(ADMIN_ROLE_PERMISSIONS) as [string, ...string[]];
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  role: z.enum(roles),
});

export async function GET() {
  const auth = await requireAdminPermission("admin_users.manage");
  if ("response" in auth) return auth.response;
  const rows = await prisma.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, email: true, name: true, role: true, permissions: true,
      isActive: true, lastLoginAt: true, createdAt: true,
    },
  });
  return NextResponse.json({ admins: rows, roles: ADMIN_ROLE_PERMISSIONS });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminPermission("admin_users.manage");
  if ("response" in auth) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid staff account" },
      { status: 400 }
    );
  }
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: parsed.data.role,
          permissions: ADMIN_ROLE_PERMISSIONS[parsed.data.role as keyof typeof ADMIN_ROLE_PERMISSIONS],
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      });
      await writeAdminAudit(tx, {
        adminId: auth.admin.id,
        action: "admin_user_created",
        entityType: "AdminUser",
        entityId: created.id,
        details: { email: created.email, role: created.role },
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        userAgent: req.headers.get("user-agent"),
      });
      return created;
    });
    return NextResponse.json({ admin: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An admin with this email already exists" }, { status: 409 });
    }
    console.error("POST /api/admin/team", error);
    return NextResponse.json({ error: "Could not create staff account" }, { status: 500 });
  }
}
