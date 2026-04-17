import dynamic from "next/dynamic";

const VendorRegisterWizard = dynamic(
  () =>
    import("@/components/vendor/VendorRegisterWizard").then((mod) => ({
      default: mod.VendorRegisterWizard,
    })),
  { ssr: false }
);

export const metadata = {
  title: "Registration As Seller | In Range",
};

export default function VendorRegisterPage() {
  return <VendorRegisterWizard />;
}
