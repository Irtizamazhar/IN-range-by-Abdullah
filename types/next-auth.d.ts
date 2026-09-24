import "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: "admin" | "customer";
      /** Customer phone; empty string for admin. */
      phone?: string;
      adminRole?: string;
      permissions?: string[];
    };
  }

  interface User {
    role?: "admin" | "customer";
    phone?: string;
    adminRole?: string;
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: "admin" | "customer";
    phone?: string;
    sessionVersion?: number;
    googleAuthenticatedAt?: number;
    invalidated?: boolean;
    adminRole?: string;
    permissions?: string[];
  }
}
