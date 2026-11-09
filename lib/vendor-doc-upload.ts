import { randomUUID } from "node:crypto";
import type { VendorDocumentType } from "@prisma/client";
import { imageExtension } from "@/lib/security/image-signature";
import { prisma } from "@/lib/prisma";
import { privatePath, writePrivateFile } from "@/lib/private-storage";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export type SavedVendorDocument = { id: string; documentType: VendorDocumentType };

/**
 * Stores one identity document in persistent private storage and records it. Every upload creates a
 * new row (earlier uploads stay for the audit trail); the newest row of each type is the current one.
 */
export async function saveVendorDocumentBuffer(
  vendorId: string,
  documentType: VendorDocumentType,
  buffer: Buffer,
  mimeRaw: string
): Promise<SavedVendorDocument> {
  const mime = mimeRaw.toLowerCase().split(";")[0].trim();
  const normalized = mime === "image/jpg" ? "image/jpeg" : mime;
  if (!ALLOWED.has(normalized) || buffer.length === 0 || buffer.length > MAX_BYTES || !imageExtension(buffer, normalized) || !/^[A-Za-z0-9_-]+$/.test(vendorId)) {
    throw new Error(`Invalid document image: ${documentType}`);
  }
  const ext = normalized === "image/png" ? "png" : normalized === "image/webp" ? "webp" : "jpg";
  const fileName = `${documentType}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const relative = await writePrivateFile(privatePath("vendor-docs", vendorId, fileName), buffer);
  const row = await prisma.vendorDocument.create({
    data: { vendorId, documentType, fileUrl: relative },
    select: { id: true, documentType: true },
  });
  return row;
}
