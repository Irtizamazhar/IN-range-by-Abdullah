import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/sessions";

export async function requireCustomerApi() {
  const session = await getCustomerSession();
  if (session?.user?.role !== "customer" || !session.user.id) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  return {
    customer: {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || "Customer",
    },
  } as const;
}
