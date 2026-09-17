import { TicketDetail } from "@/components/support/TicketDetail";

export default function VendorTicketDetailPage({ params }: { params: { id: string } }) {
  return <main><TicketDetail apiBase="/api/vendor/support" ticketId={params.id} /></main>;
}
