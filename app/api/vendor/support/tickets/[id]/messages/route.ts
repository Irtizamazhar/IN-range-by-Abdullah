import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { consumeOrReject, createSupportMessageRateLimiter } from "@/lib/security/rate-limit";
import { parseSupportAttachment } from "@/lib/support-attachment";
import { createMessageInput, postOwnerMessage } from "@/lib/support-service";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };

const messageLimiter = createSupportMessageRateLimiter();

export async function POST(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const session = await getVendorFromSession();
  if (!session) throw new ApiError(401, "Please sign in as a vendor.");
  const limited = await consumeOrReject(messageLimiter, `support-message:VENDOR:${session.vendor.id}`);
  if (!limited.ok) throw new ApiError(429, "Too many messages sent recently. Please try again later.");
  const form = await request.formData();
  const { body } = createMessageInput.parse({ body: form.get("body") });
  const attachment = await parseSupportAttachment(form).catch(e => { throw new ApiError(400, e instanceof Error ? e.message : "Invalid attachment."); });
  const message = await postOwnerMessage({ actorType: "VENDOR", actorId: session.vendor.id, ticketId: params.id, body, attachment });
  return { message: { id: message.id, senderType: message.senderType, body: message.body, attachmentUrl: message.attachmentUrl ? `/api/private/support-attachments/${message.id}` : null, createdAt: message.createdAt } };
}); }
