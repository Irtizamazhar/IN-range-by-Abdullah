import { VerifyEmailClient } from "./VerifyEmailClient";

export const metadata = {
  title: "Verify email | Vendor",
};

export default function VendorVerifyEmailPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  return <VerifyEmailClient initialStatus={searchParams.status} />;
}
