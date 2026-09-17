import { HelpCenterBody } from "@/components/support/HelpCenter";
import { CUSTOMER_FAQS } from "@/lib/support-faq";
import { CUSTOMER_CATEGORIES } from "@/lib/support-service";

export default function CustomerHelpPage() {
  return <HelpCenterBody categories={CUSTOMER_CATEGORIES} faqs={CUSTOMER_FAQS} newTicketHref="/account/help/new" ticketsHref="/account/help/tickets" />;
}
