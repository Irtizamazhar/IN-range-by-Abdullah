import { promises as fs } from "fs";
import path from "path";
import type { VendorDocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_BYTES = 5 * 1024 * 1024;

const DATA_URL =
  /^data:(image\/(?:jpeg|jpg|png|webp));base64,([0-9a-z+/=\s]+)$/i;

export function parseVendorDocDataUrl(
  dataUrl: string
): { mime: string; buffer: Buffer } | null {
  const trimmed = dataUrl.trim().replace(/\s/g, "");
  const m = DATA_URL.exec(trimmed);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime;
  if (!ALLOWED.has(normalizedMime)) return null;
  try {
    const buffer = Buffer.from(m[2], "base64");
    if (buffer.length > MAX_BYTES || buffer.length === 0) return null;
    return { mime: normalizedMime, buffer };
  } catch {
    return null;
  }
}

export async function saveVendorDocumentBuffer(
  vendorId: string,
  documentType: VendorDocumentType,
  buffer: Buffer,
  mimeRaw: string
): Promise<void> {
  const mime = mimeRaw.toLowerCase().split(";")[0].trim();
  const normalized = mime === "image/jpg" ? "image/jpeg" : mime;
  if (!ALLOWED.has(normalized) || buffer.length === 0 || buffer.length > MAX_BYTES) {
    throw new Error(`Invalid document image: ${documentType}`);
  }
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "vendor-docs",
    vendorId
  );
  await fs.mkdir(dir, { recursive: true });
  const ext =
    normalized === "image/png"
      ? "png"
      : normalized === "image/webp"
        ? "webp"
        : "jpg";
  const random =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const fileName = `${documentType}-${Date.now()}-${random}.${ext}`;
  const full = path.join(dir, fileName);
  await fs.writeFile(full, buffer);
  const publicPath = `/uploads/vendor-docs/${vendorId}/${fileName}`;
  await prisma.vendorDocument.create({
    data: {
      vendorId,
      documentType,
      fileUrl: publicPath,
    },
  });
}

export async function saveVendorRegistrationDocuments(
  vendorId: string,
  docs: { type: VendorDocumentType; dataUrl: string }[]
): Promise<void> {
  for (const doc of docs) {
    const parsed = parseVendorDocDataUrl(doc.dataUrl);
    if (!parsed) {
      throw new Error(`Invalid document image: ${doc.type}`);
    }
    await saveVendorDocumentBuffer(
      vendorId,
      doc.type,
      parsed.buffer,
      parsed.mime
    );
  }
}
