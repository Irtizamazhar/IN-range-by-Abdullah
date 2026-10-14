/** Public, route-only copy. Never include customer, product, or order data. */
export function loadingMessageForRoute(input: string | null | undefined): string {
  if (!input) return "Loading JORO...";
  let url: URL;
  try { url = new URL(input, "https://joro.pk"); }
  catch { return "Loading JORO..."; }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);
  const [first, second, third] = segments;

  if (path === "/") return "Preparing your marketplace...";
  if (first === "login" || (first === "vendor" && ["login", "register", "forgot-password", "reset-password", "verify-email"].includes(second)) || (first === "admin" && second === "login")) return "Preparing your account...";
  if (first === "admin") return second === "dashboard" || !second ? "Loading dashboard..." : "Loading management tools...";
  if (first === "vendor") {
    if (second === "dashboard") {
      if (third === "products") return "Loading your products...";
      if (third === "services") return "Loading your services...";
      if (third === "offers") return "Loading seller offers...";
      if (third === "orders") return "Loading your orders...";
      return "Opening seller dashboard...";
    }
    return "Opening seller dashboard...";
  }
  if (first === "account") {
    if (second === "wants" || url.searchParams.get("tab") === "wants") return "Loading your requests...";
    if (second === "offers" || url.searchParams.get("tab") === "offers") return "Preparing your offers...";
    if (second === "orders" || url.searchParams.get("tab") === "orders") return "Loading your orders...";
    return "Opening your account...";
  }
  if (first === "joined-requests") return "Loading joined requests...";
  if (first === "sell") return "Opening seller dashboard...";
  if (first === "products") return second ? "Loading product details..." : url.searchParams.has("category") ? "Exploring categories..." : "Loading products...";
  if (first === "new-arrivals") return second ? "Loading product details..." : "Loading products...";
  if (first === "services") return second ? "Loading service details..." : "Exploring services...";
  if (first === "gifts") return "Finding gifts...";
  if (first === "joro-connect") return "Opening Wants...";
  if (first === "together") return "Opening JORO Connect...";
  if (first === "wants") return "Loading requests...";
  if (first === "stores") return second ? "Opening store..." : "Exploring stores...";
  if (first === "cart") return "Loading your cart...";
  if (first === "checkout") return "Preparing checkout...";
  return "Loading JORO...";
}

export function loadingNeedsOpaqueBackground(input: string | null | undefined): boolean {
  if (!input) return false;
  try {
    const path = new URL(input, "https://joro.pk").pathname;
    return path.startsWith("/account") || path.startsWith("/checkout") || path.startsWith("/vendor/dashboard") || (path.startsWith("/admin") && !path.startsWith("/admin/login"));
  } catch { return false; }
}
