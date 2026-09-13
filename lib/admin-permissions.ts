export const ADMIN_ROLE_PERMISSIONS = {
  super_admin: ["*"],
  operations: ["dashboard.view", "orders.manage", "customers.manage", "vendors.manage", "returns.manage", "disputes.manage", "moderation.manage"],
  finance: ["dashboard.view", "payments.manage", "refunds.manage", "payouts.manage", "returns.manage", "reconciliation.view", "analytics.view"],
  catalog: ["dashboard.view", "catalog.manage", "homepage.manage", "moderation.manage"],
  support: ["dashboard.view", "customers.manage", "orders.view", "returns.manage", "disputes.manage"],
  analyst: ["dashboard.view", "analytics.view", "reconciliation.view", "audit.view"],
} as const;

export type AdminRole = keyof typeof ADMIN_ROLE_PERMISSIONS;

export function permissionsForRole(role: string): string[] {
  return [...(ADMIN_ROLE_PERMISSIONS[role as AdminRole] ?? [])];
}

export function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function hasAdminPermission(permissions: string[], permission: string) {
  return (
    permissions.includes("*") ||
    permissions.includes(permission) ||
    (permission.endsWith(".view") &&
      permissions.includes(`${permission.slice(0, -5)}.manage`))
  );
}
