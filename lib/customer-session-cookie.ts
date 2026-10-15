import { CUSTOMER_SESSION_COOKIE } from "@/lib/auth-cookies";
import { decode as decodeJwt } from "next-auth/jwt";

/** NextAuth can split large encrypted JWTs into numbered cookie chunks. */
export function sessionTokenFromSetCookies(setCookies: string[]): string | null {
  const parts = setCookies.map(header => {
    const [pair] = header.split(";");
    const separator = pair.indexOf("=");
    if (separator < 0) return null;
    const name = pair.slice(0, separator);
    if (name !== CUSTOMER_SESSION_COOKIE && !(name.startsWith(`${CUSTOMER_SESSION_COOKIE}.`) && /^\d+$/.test(name.slice(CUSTOMER_SESSION_COOKIE.length + 1)))) return null;
    const value = pair.slice(separator + 1);
    if (!value) return null;
    return { name, value };
  }).filter((part): part is { name: string; value: string } => part !== null);
  const whole = parts.find(part => part.name === CUSTOMER_SESSION_COOKIE);
  if (whole) return whole.value;
  if (!parts.length) return null;
  return parts.sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop())).map(part => part.value).join("");
}

export function browserSessionCookies(setCookies: string[]): string[] {
  return setCookies.map(header => {
    const [pair] = header.split(";");
    const name = pair.slice(0, pair.indexOf("="));
    if (name !== CUSTOMER_SESSION_COOKIE && !name.startsWith(`${CUSTOMER_SESSION_COOKIE}.`)) return header;
    if (!pair.slice(pair.indexOf("=") + 1)) return header; // Keep logout/deletion cookies.
    return header.replace(/;\s*(?:Expires|Max-Age)=[^;]*/gi, "");
  });
}

/** NextAuth sets a 30-day Expires value; unchecked logins must stay in browser memory. */
export async function applyCustomerCookiePersistence(response: Response, secret: string | undefined): Promise<Response> {
  if (!secret) return response;
  const setCookies = response.headers.getSetCookie();
  const encoded = sessionTokenFromSetCookies(setCookies);
  if (!encoded) return response;
  const token = await decodeJwt({ token: encoded, secret }).catch(() => null);
  if (token?.rememberMe !== false) return response;
  response.headers.delete("set-cookie");
  for (const cookie of browserSessionCookies(setCookies)) response.headers.append("set-cookie", cookie);
  return response;
}
