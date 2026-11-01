/** Old seeded default; it is nobody's support line, so treat it as "not configured". */
const PLACEHOLDER_WHATSAPP = "923001234567";

/** Digits for a wa.me link, or "" when no real WhatsApp number is configured. */
export function whatsappDigits(wa: string | null | undefined) {
  const digits = (wa ?? "").replace(/\D/g, "");
  return digits === PLACEHOLDER_WHATSAPP ? "" : digits;
}

/** WhatsApp deep link for “Sell Now” CTAs (prefilled message). */
export function sellOnWhatsappUrl(wa: string) {
  const digits = whatsappDigits(wa);
  if (!digits) return "https://wa.me/";
  const text = encodeURIComponent(
    "Hi, I want to sell on In Range By Abdullah"
  );
  return `https://wa.me/${digits}?text=${text}`;
}
