import { getOrCreateSettings } from "@/lib/settings-db";
import { fallbackSettings } from "@/lib/default-settings-public";
import { UserRouteShell } from "@/components/user/UserRouteShell";

export const dynamic = "force-dynamic";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let footerProps = fallbackSettings;

  try {
    footerProps =
      await getOrCreateSettings();
  } catch (error) {
    console.error(
      "Could not load site settings:",
      error
    );

    footerProps =
      fallbackSettings;
  }

  const whatsappNumber =
    footerProps.whatsappNumber ||
    fallbackSettings.whatsappNumber;

  return (
    <UserRouteShell
      whatsappNumber={whatsappNumber}
      footerSettings={footerProps}
    >
      {children}
    </UserRouteShell>
  );
}
