import { HelpCenterBody } from "@/components/support/HelpCenter";
import { VENDOR_FAQS } from "@/lib/support-faq";
import { VENDOR_CATEGORIES } from "@/lib/support-service";

export default function VendorHelpPage() {
  return <HelpCenterBody categories={VENDOR_CATEGORIES} faqs={VENDOR_FAQS} newTicketHref="/vendor/dashboard/help/new" ticketsHref="/vendor/dashboard/help/tickets" />;
}
