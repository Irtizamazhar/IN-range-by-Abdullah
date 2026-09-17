/** Canonical public origin. Never trust request Host headers for emailed links. */
export function appOrigin(): string {
  const value=process.env.NEXT_PUBLIC_APP_URL?.trim()||process.env.NEXTAUTH_URL?.trim()||process.env.CANONICAL_HOST?.trim()||process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) {
    if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
    throw new Error("NEXT_PUBLIC_APP_URL or NEXTAUTH_URL is required.");
  }
  const url=new URL(value);
  if (!["https:","http:"].includes(url.protocol)||url.username||url.password||url.pathname!=="/"||url.search||url.hash) throw new Error("Configure an application origin without a path or credentials.");
  if (process.env.NODE_ENV==="production"&&url.protocol!=="https:"&&!["localhost","127.0.0.1","[::1]"].includes(url.hostname)) throw new Error("Public production origin requires HTTPS.");
  return url.origin;
}
