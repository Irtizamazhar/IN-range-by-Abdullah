import { VendorAuthProvider } from "@/context/VendorAuthContext";

export default function VendorSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-neutral-50 text-neutral-900">
      <VendorAuthProvider>{children}</VendorAuthProvider>
    </div>
  );
}
