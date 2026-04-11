export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { getOrCreateSettings, updateSettingsFromBody } from "@/lib/settings-db";
import type { ISettings } from "@/types/settings";

export async function GET() {
  const settings = await getOrCreateSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as ISettings;
  const updated = await updateSettingsFromBody(body);
  return NextResponse.json(updated);
}
