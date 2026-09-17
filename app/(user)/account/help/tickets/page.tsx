import { AccountPrivate } from "@/components/user/AccountPrivate";
import { TicketList } from "@/components/support/TicketList";

export default function CustomerTicketsPage() {
  return <main><AccountPrivate><TicketList apiBase="/api/account/support" ticketsHref="/account/help/tickets" newTicketHref="/account/help/new" /></AccountPrivate></main>;
}
