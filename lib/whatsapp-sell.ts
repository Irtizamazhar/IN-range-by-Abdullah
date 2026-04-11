/** WhatsApp deep link for “Sell Now” CTAs (prefilled message). */
export function sellOnWhatsappUrl(wa: string) {
  const digits = wa.replace(/\D/g, "");
  if (!digits) return "https://wa.me/";
  const text = encodeURIComponent(
    "Hi, I want to sell on In Range By Abdullah"
  );
  return `https://wa.me/${digits}?text=${text}`;
}
