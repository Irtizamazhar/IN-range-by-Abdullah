export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/**
 * Retired. This one-step registration created "pending" sellers directly, skipping the onboarding
 * checks (strict CNIC/name/bank validation, document storage checks, CNIC OCR, declaration).
 * Sellers now sign up at POST /api/vendor/signup and complete /vendor/onboarding.
 */
export async function POST() {
  return NextResponse.json(
    { error: "This registration endpoint has been retired. Sign up at /login?role=vendor&mode=signup and complete seller onboarding.", next: "/login?role=vendor&mode=signup" },
    { status: 410 }
  );
}
