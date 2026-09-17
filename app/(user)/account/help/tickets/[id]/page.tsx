import { AccountPrivate } from "@/components/user/AccountPrivate";
import { TicketDetail } from "@/components/support/TicketDetail";

export default function CustomerTicketDetailPage({ params }: { params: { id: string } }) {
  return <main><AccountPrivate><TicketDetail apiBase="/api/account/support" ticketId={params.id} /></AccountPrivate></main>;
}
