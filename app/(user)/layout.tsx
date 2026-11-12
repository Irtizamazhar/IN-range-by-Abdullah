import { readPublicSettings } from "@/lib/settings-db";
import { fallbackSettings } from "@/lib/default-settings-public";
import { UserRouteShell } from "@/components/user/UserRouteShell";
import { incrementalFeatures } from "@/lib/incremental-features";

export const dynamic = "force-dynamic";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let footerProps = fallbackSettings;

  try {
    footerProps =
      await readPublicSettings();
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
      chatEnabled={incrementalFeatures().chat}
      newsletterEnabled={incrementalFeatures().newsletter}
    >
      {children}
    </UserRouteShell>
  );
}
