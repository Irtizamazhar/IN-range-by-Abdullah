import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/sessions";
import { hasAdminPermission, normalizePermissions, permissionsForRole } from "@/lib/admin-permissions";

export async function requireAdminPermission(permission: string) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const admin = await prisma.adminUser.findFirst({
    where: {
      isActive: true,
      OR: [
        ...(session.user.id ? [{ id: session.user.id }] : []),
        ...(session.user.email ? [{ email: session.user.email.toLowerCase() }] : []),
      ],
    },
  });

  // Preserve an already-issued environment-admin session during deployment.
  const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!admin && session.user.email?.toLowerCase() === envAdminEmail) {
    return {
      admin: {
        id: session.user.id || "admin",
        email: session.user.email,
        name: session.user.name || "Admin",
        role: "super_admin",
        permissions: ["*"],
      },
    } as const;
  }
  if (!admin) {
    return { response: NextResponse.json({ error: "Admin account is inactive" }, { status: 403 }) } as const;
  }

  const permissions = Array.from(
    new Set([...permissionsForRole(admin.role), ...normalizePermissions(admin.permissions)])
  );
  if (!hasAdminPermission(permissions, permission)) {
    return { response: NextResponse.json({ error: "Insufficient permission" }, { status: 403 }) } as const;
  }
  return {
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, permissions },
  } as const;
}

type AuditDb = Prisma.TransactionClient | typeof prisma;

export async function writeAdminAudit(
  db: AuditDb,
  data: {
    adminId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    details?: Prisma.InputJsonValue;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
) {
  return db.adminAuditLog.create({
    data: {
      adminId: data.adminId && data.adminId !== "admin" ? data.adminId : null,
      action: data.action,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
      details: data.details,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    },
  });
}
