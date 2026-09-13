export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ROLE_PERMISSIONS } from "@/lib/admin-permissions";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

const roles = Object.keys(ADMIN_ROLE_PERMISSIONS) as [string, ...string[]];
const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(roles).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(12).max(128).optional(),
}).refine((value) => Object.keys(value).length > 0, "No changes supplied");

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminPermission("admin_users.manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid update" }, { status: 400 });
  }
  if (params.id === auth.admin.id && (parsed.data.isActive === false || (parsed.data.role && parsed.data.role !== "super_admin"))) {
    return NextResponse.json({ error: "You cannot deactivate or demote your own account" }, { status: 409 });
  }
  const existing = await prisma.adminUser.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : undefined;
  const role = parsed.data.role;
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.adminUser.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        role,
        permissions: role ? ADMIN_ROLE_PERMISSIONS[role as keyof typeof ADMIN_ROLE_PERMISSIONS] : undefined,
        isActive: parsed.data.isActive,
        passwordHash,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
    });
    await writeAdminAudit(tx, {
      adminId: auth.admin.id,
      action: "admin_user_updated",
      entityType: "AdminUser",
      entityId: existing.id,
      details: {
        nameChanged: parsed.data.name != null,
        role: parsed.data.role ?? existing.role,
        active: parsed.data.isActive ?? existing.isActive,
        passwordChanged: Boolean(passwordHash),
      },
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent"),
    });
    return updated;
  });
  return NextResponse.json({ admin: row });
}
