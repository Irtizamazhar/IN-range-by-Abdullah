export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth-options";

export const authOptions = customerAuthOptions;
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
