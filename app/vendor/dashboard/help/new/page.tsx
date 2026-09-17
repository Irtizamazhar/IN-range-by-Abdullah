import { CreateTicketForm } from "@/components/support/CreateTicketForm";
import { VENDOR_CATEGORIES, VENDOR_RESOURCE_TYPES } from "@/lib/support-service";

export default function VendorNewTicketPage() {
  return <main className="p-4 sm:p-6"><CreateTicketForm apiBase="/api/vendor/support" categories={VENDOR_CATEGORIES} resourceTypes={VENDOR_RESOURCE_TYPES} ticketsHref="/vendor/dashboard/help/tickets" /></main>;
}
