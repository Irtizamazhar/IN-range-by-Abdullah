import { AccountPrivate } from "@/components/user/AccountPrivate";
import { CreateTicketForm } from "@/components/support/CreateTicketForm";
import { CUSTOMER_CATEGORIES, CUSTOMER_RESOURCE_TYPES } from "@/lib/support-service";

export default function CustomerNewTicketPage() {
  return <main className="p-4 sm:p-6"><AccountPrivate><CreateTicketForm apiBase="/api/account/support" categories={CUSTOMER_CATEGORIES} resourceTypes={CUSTOMER_RESOURCE_TYPES} ticketsHref="/account/help/tickets" /></AccountPrivate></main>;
}
