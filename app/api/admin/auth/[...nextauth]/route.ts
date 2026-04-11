import NextAuth from "next-auth";
import { adminAuthOptions } from "@/lib/admin-auth-options";

const handler = NextAuth(adminAuthOptions);

export { handler as GET, handler as POST };
