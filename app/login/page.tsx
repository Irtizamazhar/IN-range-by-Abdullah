import { LoginExperience } from "@/components/auth/LoginExperience";
import { customerProviderAvailability } from "@/lib/auth-provider-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign In | JORO.pk" };

export default function LoginPage({ searchParams }: { searchParams: { role?: string; mode?: string } }) {
  const providers = customerProviderAvailability();

  return (
    <LoginExperience
      initialRole={searchParams.role === "vendor" ? "vendor" : "customer"}
      initialMode={searchParams.mode === "signup" ? "signup" : "signin"}
      googleEnabled={providers.google}
      development={process.env.NODE_ENV !== "production"}
    />
  );
}