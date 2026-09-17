export function vendorEntry(status?: string | null) {
  if (status === "approved") return { href: "/vendor/dashboard", label: "Go to Vendor Dashboard" };
  if (status === "onboarding") return { href: "/vendor/onboarding", label: "Continue Seller Setup" };
  if (status === "pending") return { href: "/vendor/status", label: "View Application Status" };
  if (status === "rejected") return {href:"/vendor/onboarding",label:"Correct Seller Application"};
  if (status === "suspended") return { href: "/vendor/status", label: "View Account Status" };
  return { href: "/login?role=vendor&mode=signup", label: "Sell on JORO" };
}