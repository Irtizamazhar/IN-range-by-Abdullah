import { ApiError } from "@/lib/marketplace-api";
import { customerRegistrationSameOrigin } from "@/lib/customer-registration-origin";

/** Vendor forms are browser-only; require Origin before applying the shared proxy-safe check. */
export function vendorRegistrationSameOrigin(request: Request): void {
  if (!request.headers.get("origin")) throw new ApiError(403, "Please refresh and sign up from the official JORO website.");
  customerRegistrationSameOrigin(request);
}
