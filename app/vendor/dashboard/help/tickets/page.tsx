import { TicketList } from "@/components/support/TicketList";

export default function VendorTicketsPage() {
  return <main><TicketList apiBase="/api/vendor/support" ticketsHref="/vendor/dashboard/help/tickets" newTicketHref="/vendor/dashboard/help/new" /></main>;
}
