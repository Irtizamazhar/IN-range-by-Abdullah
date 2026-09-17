import Link from "next/link";

export function NeedHelpButton({
  role, resourceType, resourceId, className = "",
}: {
  role: "customer" | "vendor";
  resourceType: string;
  resourceId: string;
  className?: string;
}) {
  const base = role === "customer" ? "/account/help/new" : "/vendor/dashboard/help/new";
  const href = `${base}?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}`;
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-xl border border-brand-primary/40 bg-brand-soft px-4 py-2 text-sm font-bold text-brand-link ${className}`}>
      Need Help?
    </Link>
  );
}
