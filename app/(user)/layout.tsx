import { getOrCreateSettings } from "@/lib/settings-db";
import { UserRouteShell } from "@/components/user/UserRouteShell";
import { fallbackSettings } from "@/lib/default-settings-public";

export const dynamic = "force-dynamic";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let footerProps = fallbackSettings;
  try {
    footerProps = await getOrCreateSettings();
  } catch {
    /* DATABASE_URL missing or DB down */
  }

  const wa = footerProps.whatsappNumber || fallbackSettings.whatsappNumber;

  return (
    <UserRouteShell whatsappNumber={wa} footerSettings={footerProps}>
      {children}
    </UserRouteShell>
  );
}
