import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { consumeOrReject, createSupportMessageRateLimiter } from "@/lib/security/rate-limit";
import { parseSupportAttachment } from "@/lib/support-attachment";
import { createMessageInput, postAdminMessage } from "@/lib/support-service";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };

const messageLimiter = createSupportMessageRateLimiter();

export async function POST(request: Request, { params }: Context) {
  const auth = await requireAdminPermission("support.manage");
  if ("response" in auth) return auth.response;
  const admin = auth.admin;
  return api(async () => {
    sameOrigin(request);
    const limited = await consumeOrReject(messageLimiter, `support-message:ADMIN:${admin.id}`);
    if (!limited.ok) throw new ApiError(429, "Too many messages sent recently. Please try again later.");
    const form = await request.formData();
    const { body } = createMessageInput.parse({ body: form.get("body") });
    const isInternalNote = form.get("isInternalNote") === "true";
    const attachment = await parseSupportAttachment(form).catch(e => { throw new ApiError(400, e instanceof Error ? e.message : "Invalid attachment."); });
    const message = await postAdminMessage({ ticketId: params.id, adminId: admin.id, body, isInternalNote, attachment });
    await writeAdminAudit(prisma, { adminId: admin.id, action: isInternalNote ? "SUPPORT_INTERNAL_NOTE_ADDED" : "SUPPORT_REPLY_SENT", entityType: "SupportTicket", entityId: params.id });
    return { message: { id: message.id, senderType: message.senderType, body: message.body, isInternalNote: message.isInternalNote, attachmentUrl: message.attachmentUrl ? `/api/private/support-attachments/${message.id}` : null, createdAt: message.createdAt } };
  });
}
