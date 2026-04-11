import { NextResponse } from "next/server";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import type { VendorMe } from "@/lib/vendor-me-type";

type Ok = { vendor: VendorMe };
type Err = { response: NextResponse };

/** Any logged-in vendor (e.g. orders list). */
export async function requireVendorSessionApi(): Promise<Ok | Err> {
  const row = await getVendorFromSession();
  if (!row) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { vendor: row.vendor };
}

/** Approved vendors only (for product CRUD / uploads). */
export async function requireApprovedVendorApi(): Promise<Ok | Err> {
  const row = await getVendorFromSession();
  if (!row) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (row.vendor.status !== "approved") {
    return {
      response: NextResponse.json(
        {
          error:
            "Your shop must be approved by admin before you can add or edit products.",
        },
        { status: 403 }
      ),
    };
  }
  return { vendor: row.vendor };
}
