import type { NextAuthOptions } from "next-auth";

const useSecureCookies = process.env.NODE_ENV === "production";
const secureCookiePrefix = useSecureCookies ? "__Secure-" : "";

/** Cookie names for middleware / getToken (must match sessionToken.name below). */
export const CUSTOMER_SESSION_COOKIE = `${secureCookiePrefix}next-auth.session-token.customer`;
export const ADMIN_SESSION_COOKIE = `${secureCookiePrefix}next-auth.session-token.admin`;

function customerCookies(): NonNullable<NextAuthOptions["cookies"]> {
  return {
    sessionToken: {
      name: CUSTOMER_SESSION_COOKIE,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${secureCookiePrefix}next-auth.callback-url.customer`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token.customer`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  };
}

function adminCookies(): NonNullable<NextAuthOptions["cookies"]> {
  return {
    sessionToken: {
      name: ADMIN_SESSION_COOKIE,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${secureCookiePrefix}next-auth.callback-url.admin`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token.admin`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  };
}

export const customerCookieOptions = customerCookies();
export const adminCookieOptions = adminCookies();
