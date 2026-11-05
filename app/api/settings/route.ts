export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { readPublicSettings, updateSettingsFromBody } from "@/lib/settings-db";
import type { ISettings } from "@/types/settings";

export async function GET() {
  const settings = await readPublicSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminPermission("settings.manage");
  if ("response" in auth) return auth.response;
  const body = (await req.json()) as ISettings;
  const updated = await updateSettingsFromBody(body);
  return NextResponse.json(updated);
}
