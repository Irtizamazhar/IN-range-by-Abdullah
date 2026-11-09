import { privatePath, writePrivateFile } from "@/lib/private-storage";
import {imageExtension} from "@/lib/security/image-signature";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export type ParsedAttachment = { mime: string; buffer: Buffer };

/** Reads and validates an optional `attachment` field from ticket/message form data. Returns null if absent. */
export async function parseSupportAttachment(form: FormData): Promise<ParsedAttachment | null> {
  const file = form.get("attachment");
  if (!(file instanceof File) || file.size === 0) return null;
  const mime = file.type.toLowerCase().split(";")[0].trim();
  const normalized = mime === "image/jpg" ? "image/jpeg" : mime;
  if (!ALLOWED.has(normalized)) throw new Error("Attachments must be JPG, PNG, or WebP images.");
  if (file.size > MAX_BYTES) throw new Error("Attachment must be 5MB or smaller.");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!imageExtension(buffer, normalized)) throw new Error("Image bytes do not match the declared type.");
  return { mime: normalized, buffer };
}

/** Private (non-public) persistent storage, see lib/private-storage.ts. Never under /public. */
export async function saveSupportAttachment(ticketId: string, messageId: string, parsed: ParsedAttachment): Promise<string> {
  const ext = parsed.mime === "image/png" ? "png" : parsed.mime === "image/webp" ? "webp" : "jpg";
  return writePrivateFile(privatePath("support", ticketId, `${messageId}.${ext}`), parsed.buffer);
}
