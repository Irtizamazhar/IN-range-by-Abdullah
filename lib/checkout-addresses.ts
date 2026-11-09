import { normalizePakistanMobile, PAKISTAN_MOBILE_ERROR } from "@/lib/pakistan-phone";
import { normalizePersonName, personNameError } from "@/lib/validation/person-name";

/** Persist checkout addresses in the existing order-created event, without new columns. */
export function checkoutAddresses(body: Record<string, unknown>) {
  const text = (value: unknown, label: string, max: number, optional = false) => {
    if (optional && (value == null || value === "")) return "";
    if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`Please enter a valid ${label}.`);
    return value.trim();
  };
  const personName = (value: unknown, label: string) => {
    const error = personNameError(value, label);
    if (error) throw new Error(error);
    return normalizePersonName(String(value));
  };
  const mobile = (value: unknown, optional = false) => {
    if (optional && (value == null || value === "")) return "";
    const normalized = typeof value === "string" ? normalizePakistanMobile(value) : null;
    if (!normalized) throw new Error(PAKISTAN_MOBILE_ERROR);
    return normalized;
  };
  const country = (value: unknown) => {
    if (value != null && value !== "Pakistan") throw new Error("Delivery and billing addresses must be in Pakistan.");
    return "Pakistan";
  };
  const shipping = { name: personName(body.customerName, "Delivery name"), phone: mobile(body.customerPhone), address: text(body.customerAddress, "delivery address", 1000), city: text(body.city, "delivery city", 120), country: country(body.country), postalCode: text(body.postalCode, "postal code", 20, true) };
  if (body.sameBillingAddress != null && typeof body.sameBillingAddress !== "boolean") throw new Error("Please select a valid billing address option.");
  const sameBillingAddress = body.sameBillingAddress !== false;
  if (sameBillingAddress) return { shipping, sameBillingAddress, billing: { ...shipping } };
  const raw = body.billingAddress;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Please complete your billing address.");
  const billing = raw as Record<string, unknown>;
  return { shipping, sameBillingAddress, billing: { name: personName(billing.name, "Billing name"), address: text(billing.address, "billing address", 1000), city: text(billing.city, "billing city", 120), country: country(billing.country), postalCode: text(billing.postalCode, "billing postal code", 20, true), phone: mobile(billing.phone, true) } };
}
