import { Suspense } from "react";

import { getOrCreateSettings } from "@/lib/settings-db";
import { fallbackSettings } from "@/lib/default-settings-public";
import { UserRouteShell } from "@/components/user/UserRouteShell";

export const dynamic = "force-dynamic";

function UserShellFallback({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-brand-background">
      {children}
    </div>
  );
}

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
    <Suspense
      fallback={
        <UserShellFallback>
          {children}
        </UserShellFallback>
      }
    >
      <UserRouteShell
        whatsappNumber={
          whatsappNumber
        }
        footerSettings={
          footerProps
        }
      >
        {children}
      </UserRouteShell>
    </Suspense>
  );
}